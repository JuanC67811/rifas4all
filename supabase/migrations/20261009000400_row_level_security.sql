-- =============================================================================
-- Row Level Security: quién puede LEER qué
-- =============================================================================
-- Los clientes solo reciben SELECT. Toda escritura pasará por funciones que
-- validan permisos, estado y versión (fase 2.3), así que aquí no hay políticas
-- de INSERT, UPDATE ni DELETE: sin política, la operación se deniega.
--
-- Dos identidades posibles detrás del rol `authenticated` (diseño §5):
--   - Creador: usuario NO anónimo. Ve todo lo de sus rifas.
--   - Colaborador: usuario anónimo con una sesión activa en `collaborator_sessions`.
--     Ve el tablero completo de su rifa, pero solo las ventas y eventos de su lista.

-- -----------------------------------------------------------------------------
-- Helpers de seguridad (esquema privado)
-- -----------------------------------------------------------------------------
-- Son SECURITY DEFINER para poder consultar tablas que el propio usuario no puede
-- leer (por ejemplo, un colaborador no puede leer `collaborator_sessions`) sin
-- provocar recursión entre políticas. Viven en `private`, que la API no expone:
-- solo se pueden invocar desde las políticas, no como RPC.

-- ¿La petición viene de un creador? Un usuario anónimo tiene el rol `authenticated`,
-- así que hay que mirar el claim `is_anonymous` del JWT (revisión crítica H-02).
create function private.is_creator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- ¿El creador autenticado es el dueño de esta rifa?
create function private.owns_raffle(p_raffle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_creator()
     and exists (
       select 1
         from public.raffles r
        where r.id = p_raffle_id
          and r.owner_id = auth.uid()
     );
$$;

-- Colaborador con el que actúa este navegador en esta rifa, o NULL si no hay
-- acceso válido. Un acceso es válido si la sesión no está revocada, el
-- colaborador no está pausado y la rifa está activa o cerrada (solo lectura).
-- Al pausar o revocar, este helper devuelve NULL en la siguiente petición.
create function private.current_collaborator_id(p_raffle_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.collaborator_id
    from public.collaborator_sessions s
    join public.collaborators c on c.id = s.collaborator_id
    join public.raffles r on r.id = s.raffle_id
   where s.raffle_id = p_raffle_id
     and s.auth_user_id = auth.uid()
     and s.revoked_at is null
     and not c.is_paused
     and r.status in ('active', 'closed')
   limit 1;
$$;

-- Las políticas se evalúan con los privilegios de quien consulta, así que
-- `authenticated` necesita poder ejecutar estos tres helpers (y nada más del
-- esquema privado: sus tablas siguen sin ningún permiso).
grant usage on schema private to authenticated;
grant execute on function private.is_creator() to authenticated;
grant execute on function private.owns_raffle(uuid) to authenticated;
grant execute on function private.current_collaborator_id(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Permisos de lectura y políticas
-- -----------------------------------------------------------------------------
-- `anon` (sin sesión) no recibe nada. La única vía para un visitante con enlace
-- será la función de vista previa de la invitación (fase 2.3).

grant select on public.profiles to authenticated;
create policy "El creador lee su propio perfil"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) and (select private.is_creator()));

grant select on public.raffles to authenticated;
create policy "El creador lee sus rifas"
  on public.raffles for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_creator()));
-- El colaborador no lee esta tabla directamente: recibe solo los campos que
-- necesita mediante get_collaborator_home() (revisión crítica H-05).

grant select on public.collaborators to authenticated;
create policy "El creador lee los colaboradores de sus rifas"
  on public.collaborators for select to authenticated
  using (private.owns_raffle(raffle_id));
-- Contiene teléfonos de colaboradores: el colaborador tampoco la lee directamente.

grant select on public.collaborator_sessions to authenticated;
create policy "El creador lee las sesiones de sus rifas"
  on public.collaborator_sessions for select to authenticated
  using (private.owns_raffle(raffle_id));

grant select on public.raffle_numbers to authenticated;
create policy "Creador y colaboradores leen el tablero de la rifa"
  on public.raffle_numbers for select to authenticated
  using (
    private.owns_raffle(raffle_id)
    or private.current_collaborator_id(raffle_id) is not null
  );

grant select on public.sales to authenticated;
create policy "Creador: todas las ventas; colaborador: las de su lista"
  on public.sales for select to authenticated
  using (
    private.owns_raffle(raffle_id)
    or collaborator_id = private.current_collaborator_id(raffle_id)
  );

grant select on public.audit_events to authenticated;
create policy "Creador: todo el log; colaborador: eventos de su lista"
  on public.audit_events for select to authenticated
  using (
    private.owns_raffle(raffle_id)
    or collaborator_id = private.current_collaborator_id(raffle_id)
  );

grant select on public.daily_digests to authenticated;
create policy "El creador lee el estado de sus resúmenes diarios"
  on public.daily_digests for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_creator()));

-- -----------------------------------------------------------------------------
-- Vista del colaborador
-- -----------------------------------------------------------------------------
-- Devuelve lo mínimo que la pantalla del colaborador necesita: datos públicos de
-- la rifa, su propia identidad y los nombres de los demás colaboradores solo si
-- el creador decidió mostrarlos. Nunca teléfonos ni configuración interna.
create function public.get_collaborator_home(p_raffle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_collaborator_id uuid := private.current_collaborator_id(p_raffle_id);
  v_result jsonb;
begin
  if v_collaborator_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'R4A_FORBIDDEN',
      detail = 'No tienes un acceso válido a esta rifa.';
  end if;

  select jsonb_build_object(
           'raffle', jsonb_build_object(
             'id', r.id,
             'name', r.name,
             'description', r.description,
             'status', r.status,
             'draw_date', r.draw_date,
             'payment_deadline', r.payment_deadline,
             'time_zone', r.time_zone,
             'price_minor', r.price_minor,
             'currency', r.currency,
             'reminder_template', r.reminder_template
           ),
           'me', jsonb_build_object(
             'id', me.id,
             'display_name', me.display_name,
             'position', me.position
           ),
           'collaborators', (
             select coalesce(
                      jsonb_agg(
                        jsonb_build_object('id', c.id, 'display_name', c.display_name)
                        order by c.position
                      ),
                      '[]'::jsonb
                    )
               from public.collaborators c
              where c.raffle_id = r.id
                and (r.show_collaborator_names or c.id = me.id)
           )
         )
    into v_result
    from public.raffles r
    join public.collaborators me on me.id = v_collaborator_id
   where r.id = p_raffle_id;

  return v_result;
end;
$$;

grant execute on function public.get_collaborator_home(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Tiempo real
-- -----------------------------------------------------------------------------
-- Solo se difunde el tablero público (sin datos personales). Realtime aplica las
-- políticas de arriba a cada suscriptor. `sales` NO se publica (diseño §29).
alter publication supabase_realtime add table public.raffle_numbers;
