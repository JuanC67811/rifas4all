-- =============================================================================
-- Reparto de los 100 números (diseño §13 y §14)
-- =============================================================================
-- Regla de sobrantes, igual para ambos métodos:
--   base  = floor(100 / n)      resto = 100 mod n
--   los primeros `resto` colaboradores por posición reciben base + 1.
-- Ejemplo con 3: 34, 33, 33 → en orden: 00–33, 34–66, 67–99.
--
-- Método "ordered": bloques contiguos desde 00.
-- Método "random":  se baraja 00–99 en el servidor y se reparte en el mismo orden
--                   de posiciones. No se guarda semilla: lo auditable es el
--                   resultado, que queda guardado y en el log.

-- Vista previa: genera (o regenera) la asignación de un borrador y la devuelve.
create function public.preview_distribution(p_raffle_id uuid, p_method public.distribution_method)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle public.raffles := private.lock_owned_raffle(p_raffle_id);
  v_collaborators integer;
begin
  if v_raffle.status <> 'draft' then
    perform private.fail('R4A_RAFFLE_STATE', 'El reparto solo se puede cambiar en borrador.');
  end if;
  if p_method is null then
    perform private.fail('R4A_VALIDATION', 'Elige un método de reparto.');
  end if;

  select count(*) into v_collaborators from public.collaborators where raffle_id = p_raffle_id;
  if v_collaborators = 0 then
    perform private.fail('R4A_VALIDATION', 'Agrega al menos un colaborador antes de repartir.');
  end if;

  delete from public.raffle_numbers where raffle_id = p_raffle_id;

  with collaborator_slots as (
    -- Para cada colaborador: tamaño de su lista y primera "casilla" que le toca.
    -- idx = 0, 1, 2… según la posición (no se asume que las posiciones sean contiguas).
    select id,
           (100 / total) + case when idx < (100 % total) then 1 else 0 end as size,
           idx * (100 / total) + least(idx, 100 % total) as first_slot
      from (select c.id,
                   (row_number() over (order by c.position) - 1)::int as idx,
                   (count(*) over ())::int as total
              from public.collaborators c
             where c.raffle_id = p_raffle_id) as ordered
  ),
  slots as (
    -- Orden de los 100 números: natural (en orden) o barajado (aleatorio).
    select number::smallint as number,
           row_number() over (
             order by case when p_method = 'random' then pg_catalog.gen_random_uuid() end, number
           ) - 1 as slot
      from generate_series(0, 99) as number
  )
  insert into public.raffle_numbers (raffle_id, number, collaborator_id)
  select p_raffle_id, s.number, cs.id
    from slots s
    join collaborator_slots cs
      on s.slot >= cs.first_slot
     and s.slot < cs.first_slot + cs.size;

  update public.raffles set distribution_method = p_method where id = p_raffle_id;

  perform private.log_event(p_raffle_id, v_actor, 'distribution.previewed',
                            p_details => jsonb_build_object('method', p_method));

  return public.get_distribution_summary(p_raffle_id);
end;
$$;

-- Resumen por colaborador: cuántos números y cuáles. Lo usa la pantalla de
-- confirmación y también sirve para revisar el reparto de una rifa activa.
create function public.get_distribution_summary(p_raffle_id uuid)
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

-- Confirmación: valida el reparto, genera los accesos y activa la rifa, todo en
-- una transacción. Después ya no se pueden cambiar colaboradores ni reparto.
create function public.confirm_distribution(p_raffle_id uuid)
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
   where c.raffle_id = p_raffle_id;

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
