-- =============================================================================
-- Datos de ejemplo para desarrollo LOCAL (`npm run db:reset`)
-- =============================================================================
-- Nunca se ejecutan en producción. Credenciales de prueba:
--   correo:     demo@rifas4all.local
--   contraseña: rifas4all-demo
--
-- Los datos se crean con las mismas funciones que usa la app (create_raffle,
-- register_sale…), así el seed también comprueba que el flujo completo funciona.

-- Organizadora de demo -----------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'demo@rifas4all.local',
  extensions.crypt('rifas4all-demo', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  'email',
  '{"sub": "d0000000-0000-4000-8000-000000000001", "email": "demo@rifas4all.local", "email_verified": true}',
  now(), now(), now()
);

-- A partir de aquí, las funciones se ejecutan "como" la organizadora.
select set_config(
  'request.jwt.claims',
  '{"sub": "d0000000-0000-4000-8000-000000000001", "role": "authenticated", "is_anonymous": false}',
  false
);

select public.update_profile('Juan', 'America/Costa_Rica', true, true);

-- Rifa activa con ventas en varios estados ---------------------------------------------
do $$
declare
  v_raffle_id uuid;
  v_sale record;
begin
  v_raffle_id := public.create_raffle(
    'Canasta Navideña', 200000, 'CRC', current_date + 30, current_date + 20,
    'America/Costa_Rica', 'Canasta con productos de la pulpería del barrio.'
  );

  perform public.set_collaborators(v_raffle_id, '[
    {"display_name": "Carlos", "phone_e164": "+50688880001", "pin_enabled": true},
    {"display_name": "María",  "phone_e164": "+50688880002"},
    {"display_name": "José"}
  ]');
  perform public.preview_distribution(v_raffle_id, 'ordered');
  perform public.confirm_distribution(v_raffle_id);

  -- Carlos: 00–33 · María: 34–66 · José: 67–99
  for v_sale in
    select * from (values
      (3,  'paid',            'Ana Mora',     '+50670000003'),
      (7,  'pending_payment', 'Beto Solís',   '+50670000007'),
      (12, 'reserved',        'Cata Rojas',   '+50670000012'),
      (40, 'paid',            'Dani Vargas',  '+50670000040'),
      (45, 'pending_payment', 'Eva Jiménez',  '+50670000045'),
      (70, 'reserved',        'Fer Castro',   '+50670000070'),
      (88, 'paid',            'Gabi Quesada', '+50670000088')
    ) as t (number, status, buyer_name, phone)
  loop
    perform public.register_sale(
      v_raffle_id, v_sale.number::smallint, v_sale.status::public.sale_status,
      v_sale.buyer_name, v_sale.phone, 1, gen_random_uuid()
    );
  end loop;
end;
$$;

-- Rifa en borrador -----------------------------------------------------------------
do $$
declare
  v_raffle_id uuid;
begin
  v_raffle_id := public.create_raffle(
    'Rifa del Kínder', 100000, 'CRC', current_date + 45, current_date + 40
  );
  perform public.set_collaborators(v_raffle_id, '[
    {"display_name": "Lucía"},
    {"display_name": "Pedro"}
  ]');
end;
$$;

select set_config('request.jwt.claims', '', false);

-- Para probar el flujo del colaborador, los enlaces de la rifa activa se consultan
-- en Supabase Studio (http://127.0.0.1:54323 → SQL Editor):
--
--   select c.display_name, 'http://localhost:5173/i#' || s.token as enlace, s.pin
--     from public.collaborators c
--     join private.collaborator_secrets s on s.collaborator_id = c.id
--    order by c.position;
