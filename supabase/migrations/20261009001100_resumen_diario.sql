-- =============================================================================
-- Resumen diario por correo (diseño §19 y §30)
-- =============================================================================
-- Un correo por creador y día, con lo ocurrido el día anterior en su zona horaria.
-- El contenido se calcula a partir del log en el momento de enviarlo: no se guardan
-- copias de datos personales en una cola.
--
-- Flujo:
--   pg_cron (15 min) → enqueue_daily_digests() crea la fila del día
--                    → trigger_digest_sender() llama a la Edge Function send-digests
--   Edge Function    → claim_daily_digests() → digest_content_for() → proveedor de correo
--                    → complete_daily_digest()

create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- Contenido
-- -----------------------------------------------------------------------------
-- Para el día p_date (zona horaria del creador): por cada rifa activa o cerrada,
-- totales del tablero, movimientos del día y cobros por vencer (fecha límite en
-- 3 días o menos, o ya vencida).
create function private.digest_content(p_user_id uuid, p_date date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_time_zone text;
  v_include_phone boolean;
  v_from timestamptz;
  v_to timestamptz;
  v_today date := p_date + 1;  -- el día en que se lee el resumen
  v_raffles jsonb;
begin
  select time_zone, digest_include_phone into v_time_zone, v_include_phone
    from public.profiles
   where id = p_user_id;
  if not found then
    return null;
  end if;

  v_from := (p_date::timestamp) at time zone v_time_zone;
  v_to := ((p_date + 1)::timestamp) at time zone v_time_zone;

  select coalesce(jsonb_agg(item order by created_at), '[]'::jsonb)
    into v_raffles
    from (
      select r.created_at,
             jsonb_build_object(
               'name', r.name,
               'status', r.status,
               'currency', r.currency,
               'price_minor', r.price_minor,
               'draw_date', r.draw_date,
               'payment_deadline', r.payment_deadline,
               'deadline_in_days', r.payment_deadline - v_today,
               'closes_on', r.draw_date + 2,
               'deleted_on', r.draw_date + 4,
               'totals', (
                 select coalesce(jsonb_object_agg(t.status, t.total), '{}'::jsonb)
                   from (select n.status, count(*) as total
                           from public.raffle_numbers n
                          where n.raffle_id = r.id
                          group by n.status) as t
               ),
               'movements', (
                 select coalesce(jsonb_agg(
                          jsonb_build_object(
                            'at', e.occurred_at,
                            'action', e.action,
                            'actor', e.actor_label,
                            'collaborator', c.display_name,
                            'number', e.number,
                            'to_status', e.to_status,
                            'reason', e.details ->> 'reason',
                            'buyer_name', s.buyer_name,
                            'buyer_alias', s.buyer_alias,
                            'buyer_phone', case when v_include_phone then s.buyer_phone_e164 end
                          ) order by e.id), '[]'::jsonb)
                   from public.audit_events e
                   left join public.sales s on s.id = e.sale_id
                   left join public.collaborators c on c.id = e.collaborator_id
                  where e.raffle_id = r.id
                    and e.occurred_at >= v_from
                    and e.occurred_at < v_to
                    and (e.action like 'sale.%'
                         or e.action in ('access.activated', 'access.pin_locked', 'raffle.auto_closed'))
               ),
               'to_collect', (
                 select coalesce(jsonb_agg(
                          jsonb_build_object(
                            'number', s.number,
                            'status', s.status,
                            'collaborator', c.display_name,
                            'buyer_name', s.buyer_name,
                            'buyer_alias', s.buyer_alias,
                            'buyer_phone', case when v_include_phone then s.buyer_phone_e164 end
                          ) order by s.number), '[]'::jsonb)
                   from public.sales s
                   join public.collaborators c on c.id = s.collaborator_id
                  where s.raffle_id = r.id
                    and s.status in ('pending_payment', 'overdue')
                    and r.payment_deadline - v_today <= 3
               )
             ) as item
        from public.raffles r
       where r.owner_id = p_user_id
         and r.status in ('active', 'closed')
    ) as raffles;

  return jsonb_build_object(
    'date', p_date,
    'time_zone', v_time_zone,
    'raffles', v_raffles
  );
end;
$$;

-- El organizador puede ver su resumen en la app (también sin correo configurado).
create function public.get_daily_digest(p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
begin
  return private.digest_content(v_actor.user_id, p_date);
end;
$$;

grant execute on function public.get_daily_digest(date) to authenticated;

-- -----------------------------------------------------------------------------
-- Funciones para la Edge Function (solo con la clave secreta: rol service_role)
-- -----------------------------------------------------------------------------
-- Reserva resúmenes pendientes. FOR UPDATE SKIP LOCKED: si dos ejecuciones se
-- solapan, cada una toma filas distintas. locked_until libera las filas de una
-- ejecución que se cayó a mitad.
create function public.claim_daily_digests(p_limit integer default 20)
returns table (user_id uuid, digest_date date, email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with claimed as (
    select d.user_id, d.digest_date
      from public.daily_digests d
      join public.profiles p on p.id = d.user_id
     where p.digest_enabled
       and d.next_attempt_at <= now()
       and (d.status = 'pending' or (d.status = 'sending' and d.locked_until < now()))
     order by d.next_attempt_at
     limit p_limit
       for update of d skip locked
  )
  update public.daily_digests d
     set status = 'sending',
         attempts = d.attempts + 1,
         locked_until = now() + interval '5 minutes'
    from claimed c
    join auth.users u on u.id = c.user_id
   where d.user_id = c.user_id
     and d.digest_date = c.digest_date
  returning d.user_id, d.digest_date, u.email::text;
end;
$$;

create function public.digest_content_for(p_user_id uuid, p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.digest_content(p_user_id, p_date);
$$;

-- Resultado del envío:
--   sent   → enviado (se guarda el id del proveedor)
--   empty  → no había nada que contar
--   retry  → error temporal (429, 5xx, red): se reintenta con espera creciente
--   failed → error definitivo
create function public.complete_daily_digest(
  p_user_id uuid,
  p_date date,
  p_outcome text,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts smallint;
begin
  select attempts into v_attempts
    from public.daily_digests
   where user_id = p_user_id and digest_date = p_date
     for update;

  if p_outcome = 'retry' and v_attempts >= 5 then
    p_outcome := 'failed';
  end if;

  update public.daily_digests
     set status = case p_outcome
                    when 'sent' then 'sent'::public.digest_status
                    when 'empty' then 'empty'::public.digest_status
                    when 'retry' then 'pending'::public.digest_status
                    else 'failed'::public.digest_status
                  end,
         sent_at = case when p_outcome = 'sent' then now() end,
         provider_message_id = p_provider_message_id,
         -- Solo un texto corto y técnico: nunca el cuerpo del correo ni datos personales.
         last_error = left(p_error, 500),
         locked_until = null,
         -- Espera creciente: 5, 15, 60 y 180 minutos.
         next_attempt_at = case
                             when p_outcome = 'retry'
                               then now() + (array[5, 15, 60, 180])[least(v_attempts, 4)] * interval '1 minute'
                             else next_attempt_at
                           end
   where user_id = p_user_id and digest_date = p_date;
end;
$$;

grant execute on function public.claim_daily_digests(integer) to service_role;
grant execute on function public.digest_content_for(uuid, date) to service_role;
grant execute on function public.complete_daily_digest(uuid, date, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- Llamada programada a la Edge Function
-- -----------------------------------------------------------------------------
-- La URL de la función y el secreto compartido se guardan en Supabase Vault (por
-- entorno). Si no están configurados (desarrollo local, o producción sin dominio
-- de correo todavía), no se llama a nada y los resúmenes quedan visibles en la app.
create function private.trigger_digest_sender()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'digest_function_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'digest_function_secret';

  if v_url is null or v_secret is null then
    return false;
  end if;
  if not exists (
    select 1 from public.daily_digests
     where status in ('pending', 'sending') and next_attempt_at <= now()
  ) then
    return false;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-digest-secret', v_secret),
    body := '{}'::jsonb
  );
  return true;
end;
$$;

create or replace function private.run_frequent_jobs()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_overdue integer := private.process_due_payments();
  v_closed integer := private.close_finished_raffles();
  v_deleted integer := private.delete_expired_raffles();
  v_digests integer := private.enqueue_daily_digests();
  v_sender boolean := private.trigger_digest_sender();
begin
  return jsonb_build_object(
    'payments_updated', v_overdue,
    'raffles_closed', v_closed,
    'raffles_deleted', v_deleted,
    'digests_enqueued', v_digests,
    'digest_sender_called', v_sender
  );
end;
$$;
