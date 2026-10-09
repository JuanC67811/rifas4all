-- =============================================================================
-- El organizador también puede vender: su propia lista en el reparto
-- =============================================================================
-- Pedido tras probar la app: el organizador puede llevar la rifa solo (se queda los
-- 100 números) o repartir con sus colaboradores incluyéndose él (con 1 colaborador,
-- 50 y 50). Su lista es una fila de `collaborators` marcada con is_organizer:
--   - siempre en la posición 1 (recibe uno de los números sobrantes, si los hay);
--   - sin enlace, PIN ni teléfono: entra con su cuenta y ya puede actuar sobre todo.
-- Hasta 12 colaboradores externos, así que puede haber hasta 13 listas.

alter table public.collaborators
  add column is_organizer boolean not null default false;

alter table public.collaborators drop constraint collaborators_position_check;
alter table public.collaborators
  add constraint collaborators_position_check check (position between 1 and 13);

alter table public.collaborators
  add constraint collaborators_organizer_without_access
  check (not is_organizer or (phone_e164 is null and not pin_enabled and position = 1));

create unique index collaborators_one_organizer_idx
  on public.collaborators (raffle_id)
  where is_organizer;

-- -----------------------------------------------------------------------------
-- set_collaborators: nuevo parámetro p_organizer_sells
-- -----------------------------------------------------------------------------
drop function public.set_collaborators(uuid, jsonb);

create function public.set_collaborators(
  p_raffle_id uuid,
  p_collaborators jsonb,
  p_organizer_sells boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle public.raffles := private.lock_owned_raffle(p_raffle_id);
  v_count integer;
  v_organizer_name text;
  v_offset integer := case when coalesce(p_organizer_sells, false) then 1 else 0 end;
begin
  if v_raffle.status <> 'draft' then
    perform private.fail('R4A_RAFFLE_STATE', 'Los colaboradores solo se cambian en borrador.');
  end if;
  if p_collaborators is null or jsonb_typeof(p_collaborators) <> 'array' then
    perform private.fail('R4A_VALIDATION', 'Lista de colaboradores no válida.');
  end if;

  v_count := jsonb_array_length(p_collaborators);
  if v_count > 12 then
    perform private.fail('R4A_VALIDATION', 'Como máximo 12 colaboradores.');
  end if;
  if v_count + v_offset < 1 then
    perform private.fail('R4A_VALIDATION', 'Agrega al menos un colaborador o vende tú los números.');
  end if;

  delete from public.raffle_numbers where raffle_id = p_raffle_id;
  delete from public.collaborators where raffle_id = p_raffle_id;

  if v_offset = 1 then
    select coalesce(nullif(btrim(display_name), ''), 'Organizador') into v_organizer_name
      from public.profiles where id = v_actor.user_id;
    insert into public.collaborators (raffle_id, position, display_name, is_organizer)
    values (p_raffle_id, 1, v_organizer_name, true);
  end if;

  insert into public.collaborators (raffle_id, position, display_name, phone_e164, pin_enabled)
  select p_raffle_id,
         item.ordinality + v_offset,
         btrim(item.value ->> 'display_name'),
         nullif(btrim(item.value ->> 'phone_e164'), ''),
         coalesce((item.value ->> 'pin_enabled')::boolean, false)
    from jsonb_array_elements(p_collaborators) with ordinality as item(value, ordinality);

  update public.raffles set distribution_method = null where id = p_raffle_id;

  perform private.log_event(p_raffle_id, v_actor, 'collaborator.list_saved',
                            p_details => jsonb_build_object('count', v_count,
                                                            'organizer_sells', v_offset = 1));
end;
$$;

grant execute on function public.set_collaborators(uuid, jsonb, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- El resumen del reparto indica cuál es la lista del organizador
-- -----------------------------------------------------------------------------
create or replace function public.get_distribution_summary(p_raffle_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'collaborator_id', c.id,
               'display_name', c.display_name,
               'position', c.position,
               'is_organizer', c.is_organizer,
               'count', coalesce(array_length(nums.numbers, 1), 0),
               'numbers', to_jsonb(coalesce(nums.numbers, '{}'::smallint[]))
             )
             order by c.position
           ),
           '[]'::jsonb
         )
    from public.collaborators c
    left join lateral (
      select array_agg(rn.number order by rn.number) as numbers
        from public.raffle_numbers rn
       where rn.raffle_id = c.raffle_id
         and rn.collaborator_id = c.id
    ) as nums on true
   where c.raffle_id = p_raffle_id
     and private.owns_raffle(p_raffle_id);
$$;

-- -----------------------------------------------------------------------------
-- Al confirmar, solo los colaboradores externos reciben enlace y PIN
-- -----------------------------------------------------------------------------
create or replace function public.confirm_distribution(p_raffle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle public.raffles := private.lock_owned_raffle(p_raffle_id);
  v_numbers integer;
  v_collaborators integer;
  v_owners integer;
  v_min integer;
  v_max integer;
begin
  if v_raffle.status <> 'draft' then
    perform private.fail('R4A_RAFFLE_STATE', 'La rifa ya fue activada.');
  end if;
  if v_raffle.distribution_method is null then
    perform private.fail('R4A_VALIDATION', 'Genera la vista previa del reparto antes de confirmar.');
  end if;
  if v_raffle.draw_date < private.local_today(v_raffle.time_zone) then
    perform private.fail('R4A_VALIDATION', 'La fecha del sorteo ya pasó.');
  end if;

  select count(*) into v_collaborators from public.collaborators where raffle_id = p_raffle_id;

  select count(*), count(distinct collaborator_id)
    into v_numbers, v_owners
    from public.raffle_numbers
   where raffle_id = p_raffle_id;

  select min(total), max(total) into v_min, v_max
    from (select count(*) as total
            from public.raffle_numbers
           where raffle_id = p_raffle_id
           group by collaborator_id) as sizes;

  -- Defensa en profundidad: el reparto debe cubrir 00–99, incluir a todos los
  -- colaboradores y ser equitativo, aunque la vista previa ya lo garantice.
  if v_numbers <> 100 or v_owners <> v_collaborators or v_max - v_min > 1 then
    perform private.fail('R4A_VALIDATION', 'El reparto no es válido. Genera la vista previa de nuevo.');
  end if;

  insert into private.collaborator_secrets (collaborator_id, token, pin)
  select c.id,
         private.new_access_token(),
         case when c.pin_enabled then private.new_pin() end
    from public.collaborators c
   where c.raffle_id = p_raffle_id
     and not c.is_organizer;  -- el organizador entra con su cuenta: no necesita enlace

  update public.raffles
     set status = 'active',
         distribution_confirmed_at = now(),
         activated_at = now()
   where id = p_raffle_id;

  perform private.log_event(p_raffle_id, v_actor, 'distribution.confirmed',
                            p_details => jsonb_build_object('method', v_raffle.distribution_method,
                                                            'collaborators', v_collaborators));
  perform private.log_event(p_raffle_id, v_actor, 'raffle.activated',
                            p_from_status => 'draft', p_to_status => 'active');
end;
$$;
