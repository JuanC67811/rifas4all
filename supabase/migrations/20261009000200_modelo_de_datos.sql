-- =============================================================================
-- Modelo de datos: tipos, tablas, restricciones e índices
-- =============================================================================
-- Las reglas que pueden expresarse de forma declarativa viven aquí (CHECK, UNIQUE,
-- claves foráneas). Así se cumplen aunque una función futura tenga un error.
-- Row Level Security se activa en todas las tablas SIN políticas: hasta la
-- migración de políticas, ningún cliente puede leer ni escribir nada.

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.raffle_status as enum ('draft', 'active', 'closed');
create type public.distribution_method as enum ('ordered', 'random');
create type public.number_status as enum (
  'available', 'reserved', 'pending_payment', 'paid', 'overdue'
);
-- Una venta tiene los mismos estados que el número que ocupa, más `cancelled`.
-- "Cancelado" es un estado de la venta, nunca del número (diseño §21).
create type public.sale_status as enum (
  'reserved', 'pending_payment', 'paid', 'overdue', 'cancelled'
);
create type public.actor_type as enum ('creator', 'collaborator', 'system');
create type public.digest_status as enum ('pending', 'sending', 'sent', 'empty', 'failed');

-- -----------------------------------------------------------------------------
-- Funciones de validación usadas en restricciones
-- -----------------------------------------------------------------------------
-- Una zona horaria IANA es válida si PostgreSQL sabe convertir una fecha a ella.
create function private.is_valid_time_zone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform '2000-01-01 00:00:00+00'::timestamptz at time zone tz;
  return true;
exception
  when invalid_parameter_value then
    return false;
end;
$$;

-- Teléfono en formato E.164: "+" y entre 8 y 15 dígitos (ej. +50688887777).
-- La validación completa por país se hace en el cliente con libphonenumber-js.
create function private.is_e164_phone(phone text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select phone ~ '^\+[1-9][0-9]{7,14}$';
$$;

-- -----------------------------------------------------------------------------
-- Perfiles de creador
-- -----------------------------------------------------------------------------
-- Solo los creadores (usuarios NO anónimos) tienen perfil. Los colaboradores usan
-- usuarios anónimos de Supabase y no aparecen aquí.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default ''
    check (char_length(display_name) <= 60),
  time_zone text not null default 'America/Costa_Rica'
    check (private.is_valid_time_zone(time_zone)),
  digest_enabled boolean not null default true,
  digest_include_phone boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Creadores de rifas. Se crea automáticamente al registrarse un usuario no anónimo.';

-- -----------------------------------------------------------------------------
-- Rifas
-- -----------------------------------------------------------------------------
create table public.raffles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) between 3 and 80),
  description text
    check (char_length(description) <= 280),
  status public.raffle_status not null default 'draft',
  -- Preparado para el futuro, pero en el MVP toda rifa tiene exactamente 100 números.
  number_count smallint not null default 100
    check (number_count = 100),
  -- Dinero en unidades menores (céntimos) para evitar errores de coma flotante.
  price_minor bigint not null
    check (price_minor > 0),
  currency char(3) not null
    check (currency in ('CRC', 'USD')),
  draw_date date not null,
  payment_deadline date not null,
  time_zone text not null default 'America/Costa_Rica'
    check (private.is_valid_time_zone(time_zone)),
  distribution_method public.distribution_method,
  distribution_confirmed_at timestamptz,
  show_collaborator_names boolean not null default true,
  reminder_template text
    check (char_length(reminder_template) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  closed_at timestamptz,

  constraint raffles_payment_deadline_not_after_draw
    check (payment_deadline <= draw_date),
  -- Una rifa solo puede estar activa o cerrada si su reparto fue confirmado.
  constraint raffles_distribution_confirmed_before_activation
    check (
      status = 'draft'
      or (
        distribution_method is not null
        and distribution_confirmed_at is not null
        and activated_at is not null
      )
    ),
  constraint raffles_closed_at_matches_status
    check ((status = 'closed') = (closed_at is not null))
);

create index raffles_owner_status_idx on public.raffles (owner_id, status);
-- Para los jobs de cierre (sorteo + 2 días) y borrado (sorteo + 4 días).
create index raffles_status_draw_date_idx on public.raffles (status, draw_date);

comment on column public.raffles.price_minor is
  'Precio por número en unidades menores de la moneda (ej. ₡2 000 = 200000).';

-- -----------------------------------------------------------------------------
-- Colaboradores
-- -----------------------------------------------------------------------------
create table public.collaborators (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.raffles (id) on delete cascade,
  -- Posición 1..12, única por rifa: esto limita a 12 colaboradores sin triggers
  -- y define el orden del reparto (los primeros reciben los números sobrantes).
  position smallint not null
    check (position between 1 and 12),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  phone_e164 text
    check (private.is_e164_phone(phone_e164)),
  pin_enabled boolean not null default false,
  is_paused boolean not null default false,
  first_activated_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),

  constraint collaborators_position_unique unique (raffle_id, position),
  -- Destino de claves foráneas compuestas: garantiza que las referencias a un
  -- colaborador siempre sean de la misma rifa.
  constraint collaborators_raffle_id_unique unique (raffle_id, id)
);

-- Secretos de acceso: sin ningún permiso para clientes, en el esquema privado.
-- Se guardan legibles a propósito para que el creador pueda volver a copiar el
-- mensaje de acceso (diseño §27 y revisión crítica H-12). El PIN siempre lo genera
-- el sistema, así que no puede coincidir con un PIN que la persona use en otro sitio.
create table private.collaborator_secrets (
  collaborator_id uuid primary key references public.collaborators (id) on delete cascade,
  -- 32 bytes aleatorios en base64url = 43 caracteres.
  token text not null unique
    check (token ~ '^[A-Za-z0-9_-]{43}$'),
  pin char(4)
    check (pin ~ '^[0-9]{4}$'),
  pin_failed_attempts smallint not null default 0
    check (pin_failed_attempts >= 0),
  pin_locked_until timestamptz,
  rotated_at timestamptz not null default now()
);

-- Sesiones de dispositivo: un usuario anónimo de Supabase ligado a un colaborador.
create table public.collaborator_sessions (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null,
  collaborator_id uuid not null,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text
    check (revoked_reason in ('replaced_by_new_device', 'replaced_on_this_device', 'access_regenerated')),

  foreign key (raffle_id, collaborator_id)
    references public.collaborators (raffle_id, id) on delete cascade,
  constraint collaborator_sessions_revocation_consistent
    check ((revoked_at is null) = (revoked_reason is null))
);

-- Un navegador solo puede actuar como un colaborador por rifa.
create unique index collaborator_sessions_one_per_device_idx
  on public.collaborator_sessions (raffle_id, auth_user_id)
  where revoked_at is null;
-- Lo consultan las políticas RLS en cada petición de un colaborador.
create index collaborator_sessions_active_user_idx
  on public.collaborator_sessions (auth_user_id)
  where revoked_at is null;
create index collaborator_sessions_active_collaborator_idx
  on public.collaborator_sessions (collaborator_id)
  where revoked_at is null;

-- -----------------------------------------------------------------------------
-- Números y ventas
-- -----------------------------------------------------------------------------
-- Estado PÚBLICO de cada número. No contiene datos personales: es la tabla que
-- todos los participantes leen y la única que se difunde en tiempo real.
create table public.raffle_numbers (
  raffle_id uuid not null references public.raffles (id) on delete cascade,
  number smallint not null
    check (number between 0 and 99),
  collaborator_id uuid not null,
  status public.number_status not null default 'available',
  current_sale_id uuid,
  -- Concurrencia optimista: cada cambio incrementa la versión (diseño §28).
  version integer not null default 1
    check (version >= 1),
  updated_at timestamptz not null default now(),

  primary key (raffle_id, number),
  foreign key (raffle_id, collaborator_id)
    references public.collaborators (raffle_id, id) on delete cascade,
  -- Destino de la clave foránea de `sales`: una venta solo puede pertenecer al
  -- colaborador dueño del número.
  constraint raffle_numbers_owner_unique unique (raffle_id, number, collaborator_id),
  -- Un número libre no tiene venta; uno ocupado siempre la tiene.
  constraint raffle_numbers_sale_matches_status
    check ((status = 'available') = (current_sale_id is null))
);

create index raffle_numbers_collaborator_idx on public.raffle_numbers (raffle_id, collaborator_id);

-- Datos PRIVADOS de cada venta. Solo los leen el creador y el dueño del número.
-- Cancelar una venta no la borra: queda como historial y el número vuelve a estar
-- libre. Una venta nueva del mismo número crea otra fila.
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null,
  number smallint not null,
  collaborator_id uuid not null,
  status public.sale_status not null,
  buyer_name text not null
    check (char_length(btrim(buyer_name)) between 1 and 60),
  buyer_alias text
    check (char_length(btrim(buyer_alias)) between 1 and 30),
  buyer_phone_e164 text not null
    check (private.is_e164_phone(buyer_phone_e164)),
  note text
    check (char_length(note) <= 140),
  price_minor bigint not null
    check (price_minor > 0),
  currency char(3) not null,
  reserved_at timestamptz,
  committed_at timestamptz,
  paid_at timestamptz,
  paid_late boolean not null default false,
  ended_at timestamptz,
  end_reason text
    check (end_reason in ('cancelled', 'released')),
  created_at timestamptz not null default now(),
  created_by_actor public.actor_type not null,
  created_by_user_id uuid,

  -- El colaborador de la venta tiene que ser el dueño del número.
  foreign key (raffle_id, number, collaborator_id)
    references public.raffle_numbers (raffle_id, number, collaborator_id) on delete cascade,
  constraint sales_identity_unique unique (id, raffle_id, number),
  constraint sales_paid_has_paid_at
    check (status <> 'paid' or paid_at is not null),
  constraint sales_debt_has_committed_at
    check (status not in ('pending_payment', 'overdue') or committed_at is not null),
  constraint sales_cancelled_has_end
    check ((status = 'cancelled') = (ended_at is not null and end_reason is not null)),
  constraint sales_created_by_system_has_no_user
    check ((created_by_actor = 'system') = (created_by_user_id is null))
);

-- La garantía central contra la doble venta: como mucho UNA venta no cancelada
-- por número, sin importar cuántas pestañas, dispositivos o reintentos haya.
create unique index sales_one_active_per_number_idx
  on public.sales (raffle_id, number)
  where status <> 'cancelled';
create index sales_raffle_collaborator_status_idx
  on public.sales (raffle_id, collaborator_id, status);
create index sales_pending_payment_idx
  on public.sales (raffle_id)
  where status = 'pending_payment';

-- El número apunta a su venta actual. Al borrar la venta solo se vacía esa
-- columna (PostgreSQL 15+), no las que forman parte de la clave primaria.
alter table public.raffle_numbers
  add constraint raffle_numbers_current_sale_fk
  foreign key (current_sale_id, raffle_id, number)
  references public.sales (id, raffle_id, number)
  on delete set null (current_sale_id);

-- -----------------------------------------------------------------------------
-- Log de auditoría (append-only)
-- -----------------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  raffle_id uuid not null references public.raffles (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  actor_type public.actor_type not null,
  actor_user_id uuid,
  actor_collaborator_id uuid,
  -- Instantánea del nombre en el momento de la acción ("Carlos", "Administrador (Juan)").
  actor_label text not null
    check (char_length(actor_label) between 1 and 80),
  -- Lista afectada: permite que cada colaborador vea solo los eventos de la suya.
  collaborator_id uuid,
  action text not null
    check (action ~ '^[a-z_]+\.[a-z_]+$'),
  number smallint
    check (number between 0 and 99),
  sale_id uuid,
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  result text not null default 'success'
    check (result in ('success', 'pin_failed')),
  -- Idempotencia: un reintento con el mismo request_id choca con el índice único.
  request_id uuid,

  constraint audit_events_system_has_no_user
    check ((actor_type = 'system') = (actor_user_id is null)),
  constraint audit_events_collaborator_identified
    check (actor_type <> 'collaborator' or actor_collaborator_id is not null),
  constraint audit_events_details_is_object
    check (jsonb_typeof(details) = 'object'),
  -- Defensa adicional: el log nunca guarda datos del comprador ni credenciales.
  constraint audit_events_details_without_personal_data
    check (not (details ?| array['buyer_name', 'buyer_alias', 'buyer_phone_e164', 'note', 'token', 'pin']))
);

create unique index audit_events_request_idx
  on public.audit_events (actor_user_id, request_id)
  where request_id is not null;
create index audit_events_raffle_idx on public.audit_events (raffle_id, id desc);
create index audit_events_raffle_collaborator_idx
  on public.audit_events (raffle_id, collaborator_id, id desc);
create index audit_events_raffle_occurred_idx on public.audit_events (raffle_id, occurred_at);

-- -----------------------------------------------------------------------------
-- Resúmenes diarios por correo
-- -----------------------------------------------------------------------------
-- Uno por creador y día. No guarda el contenido del correo: se calcula desde el log.
create table public.daily_digests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  digest_date date not null,
  status public.digest_status not null default 'pending',
  attempts smallint not null default 0
    check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text
    check (char_length(last_error) <= 500),
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,

  primary key (user_id, digest_date),
  constraint daily_digests_sent_has_sent_at
    check ((status = 'sent') = (sent_at is not null))
);

create index daily_digests_pending_idx
  on public.daily_digests (next_attempt_at)
  where status in ('pending', 'sending');

-- -----------------------------------------------------------------------------
-- Row Level Security: activado en todo, sin políticas todavía (todo denegado)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.raffles enable row level security;
alter table public.collaborators enable row level security;
alter table public.collaborator_sessions enable row level security;
alter table public.raffle_numbers enable row level security;
alter table public.sales enable row level security;
alter table public.audit_events enable row level security;
alter table public.daily_digests enable row level security;
alter table private.collaborator_secrets enable row level security;
