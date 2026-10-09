-- =============================================================================
-- Ajustes señalados por `supabase db lint` (plpgsql_check)
-- =============================================================================

-- private.fail solo lanza un error: no lee ni escribe datos. Marcarla STABLE permite
-- usarla desde funciones STABLE (require_creator, get_invitation_preview) sin que el
-- analizador lo señale como una contradicción de volatilidad.
alter function private.fail(text, text) stable;

-- update_buyer: el arreglo de campos cambiados se inicializa con un literal tipado.
create or replace function public.update_buyer(
  p_raffle_id uuid,
  p_number smallint,
  p_buyer_name text,
  p_buyer_phone_e164 text,
  p_expected_version integer,
  p_request_id uuid,
  p_buyer_alias text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor;
  v_number public.raffle_numbers;
  v_sale public.sales;
  v_fields text[] := '{}'::text[];
  v_name text := btrim(p_buyer_name);
  v_phone text := btrim(p_buyer_phone_e164);
  v_alias text := nullif(btrim(p_buyer_alias), '');
  v_note text := nullif(btrim(p_note), '');
begin
  perform private.require_request_id(p_request_id);
  v_actor := private.resolve_sale_actor(p_raffle_id);
  v_number := private.lock_number(p_raffle_id, p_number, v_actor);

  if private.already_applied(v_actor, p_request_id) then
    return private.number_result(p_raffle_id, p_number, true);
  end if;
  perform private.check_version(v_number, p_expected_version);

  select * into v_sale from public.sales where id = v_number.current_sale_id for update;
  if not found then
    perform private.fail('R4A_INVALID_TRANSITION', 'Ese número no tiene una venta.');
  end if;

  if v_name is distinct from v_sale.buyer_name then v_fields := array_append(v_fields, 'buyer_name'); end if;
  if v_phone is distinct from v_sale.buyer_phone_e164 then v_fields := array_append(v_fields, 'buyer_phone'); end if;
  if v_alias is distinct from v_sale.buyer_alias then v_fields := array_append(v_fields, 'buyer_alias'); end if;
  if v_note is distinct from v_sale.note then v_fields := array_append(v_fields, 'buyer_note'); end if;

  if cardinality(v_fields) = 0 then
    return private.number_result(p_raffle_id, p_number, false);
  end if;

  update public.sales
     set buyer_name = v_name, buyer_phone_e164 = v_phone, buyer_alias = v_alias, note = v_note
   where id = v_sale.id;

  perform private.log_event(
    p_raffle_id, v_actor, 'sale.buyer_updated',
    p_collaborator_id => v_number.collaborator_id,
    p_number => p_number,
    p_sale_id => v_sale.id,
    p_details => jsonb_build_object('fields', to_jsonb(v_fields)),
    p_request_id => p_request_id
  );

  return private.number_result(p_raffle_id, p_number, false);
end;
$$;
