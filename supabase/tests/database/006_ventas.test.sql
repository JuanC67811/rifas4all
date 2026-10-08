-- Ventas y pagos: máquina de estados, idempotencia, concurrencia optimista,
-- permisos por lista, rifa cerrada y ausencia de datos personales en el log.
begin;
create extension if not exists pgtap with schema extensions;

-- Cada archivo parte de una base vacía. Los datos del seed vuelven con el rollback final.
delete from auth.users;

select plan(36);

create function pg_temp.as_user(p_user_id uuid, p_is_anonymous boolean)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'is_anonymous', p_is_anonymous)::text,
    true);
$$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'creadora.a@test.local');
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', true),  -- Carlos: números 00–49
  ('00000000-0000-0000-0000-0000000000a2', true);  -- María: números 50–99

-- Escenario: rifa activa con reparto en orden y ambos colaboradores activados.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select public.create_raffle('Canasta Navideña', 200000, 'CRC', current_date + 30, current_date + 20) as raffle_id \gset
select public.set_collaborators(:'raffle_id', '[{"display_name": "Carlos"}, {"display_name": "María"}]');
select public.preview_distribution(:'raffle_id', 'ordered');
select public.confirm_distribution(:'raffle_id');

reset role;
select s.token as carlos_token from private.collaborator_secrets s
  join public.collaborators c on c.id = s.collaborator_id
 where c.raffle_id = :'raffle_id' and c.position = 1 \gset
select s.token as maria_token from private.collaborator_secrets s
  join public.collaborators c on c.id = s.collaborator_id
 where c.raffle_id = :'raffle_id' and c.position = 2 \gset

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select public.activate_access(:'maria_token', null);

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select public.activate_access(:'carlos_token', null);

-- -----------------------------------------------------------------------------
-- Registrar una venta (como Carlos)
-- -----------------------------------------------------------------------------
select is(
  public.register_sale(:'raffle_id', 10::smallint, 'reserved', 'Ana Mora', '+50670001111', 1,
                       '00000000-0000-0000-0000-000000000101'),
  '{"number": 10, "status": "reserved", "version": 2, "replayed": false}'::jsonb,
  'Carlos reserva el 10: el número sube a la versión 2'
);
select is(
  public.register_sale(:'raffle_id', 10::smallint, 'reserved', 'Ana Mora', '+50670001111', 1,
                       '00000000-0000-0000-0000-000000000101') ->> 'replayed',
  'true',
  'doble toque (mismo request_id): no repite la operación, devuelve el estado actual'
);
select is(
  (select count(*)::int from public.sales where number = 10),
  1,
  'tras el doble toque sigue habiendo una sola venta'
);
select throws_ok(
  format($$ select public.register_sale(%L, 10::smallint, 'reserved', 'Luis', '+50670002222', 1,
                                         '00000000-0000-0000-0000-000000000102') $$, :'raffle_id'),
  'P0001', 'R4A_CONFLICT',
  'otra pestaña con la versión vieja recibe CONFLICTO'
);
select throws_ok(
  format($$ select public.register_sale(%L, 10::smallint, 'reserved', 'Luis', '+50670002222', 2,
                                         '00000000-0000-0000-0000-000000000103') $$, :'raffle_id'),
  'P0001', 'R4A_INVALID_TRANSITION',
  'aun con la versión correcta, un número ocupado no se vuelve a vender'
);
select throws_ok(
  format($$ select public.register_sale(%L, 60::smallint, 'reserved', 'Luis', '+50670002222', 1,
                                         '00000000-0000-0000-0000-000000000104') $$, :'raffle_id'),
  'P0001', 'R4A_FORBIDDEN',
  'Carlos no puede vender un número de María'
);
select throws_ok(
  format($$ select public.register_sale(%L, 11::smallint, 'reserved', 'Luis', '8888-1111', 1,
                                         '00000000-0000-0000-0000-000000000105') $$, :'raffle_id'),
  '23514', null,
  'un teléfono que no está en formato E.164 se rechaza'
);
select throws_ok(
  format($$ select public.register_sale(%L, 11::smallint, 'reserved', 'Luis', '+50670002222', 1, null) $$, :'raffle_id'),
  'P0001', 'R4A_VALIDATION',
  'toda operación necesita un request_id'
);
select throws_ok(
  format($$ select public.register_sale(%L, 11::smallint, 'cancelled', 'Luis', '+50670002222', 1,
                                         '00000000-0000-0000-0000-000000000106') $$, :'raffle_id'),
  'P0001', 'R4A_VALIDATION',
  'una venta no puede nacer cancelada'
);

-- -----------------------------------------------------------------------------
-- Ciclo de vida del 10: reservado → pendiente → pagado → revertido → cancelado
-- -----------------------------------------------------------------------------
select is(
  public.change_sale_status(:'raffle_id', 10::smallint, 'commit', 2, '00000000-0000-0000-0000-000000000110') ->> 'status',
  'pending_payment',
  'reservado → pendiente de pago'
);
select is(
  public.change_sale_status(:'raffle_id', 10::smallint, 'confirm_payment', 3, '00000000-0000-0000-0000-000000000111') ->> 'status',
  'paid',
  'pendiente → pagado'
);
select throws_ok(
  format($$ select public.change_sale_status(%L, 10::smallint, 'cancel', 4, '00000000-0000-0000-0000-000000000112') $$, :'raffle_id'),
  'P0001', 'R4A_INVALID_TRANSITION',
  'una venta pagada no se cancela directamente'
);
select throws_ok(
  format($$ select public.change_sale_status(%L, 10::smallint, 'revert_payment', 4, '00000000-0000-0000-0000-000000000113') $$, :'raffle_id'),
  'P0001', 'R4A_VALIDATION',
  'revertir un pago exige un motivo'
);
select is(
  public.change_sale_status(:'raffle_id', 10::smallint, 'revert_payment', 4,
                            '00000000-0000-0000-0000-000000000114', 'Lo registré por error') ->> 'status',
  'pending_payment',
  'Carlos revierte el pago de su propio número'
);
select is(
  public.change_sale_status(:'raffle_id', 10::smallint, 'cancel', 5, '00000000-0000-0000-0000-000000000115') ->> 'status',
  'available',
  'pendiente → cancelado: el número vuelve a estar libre'
);
select is(
  public.register_sale(:'raffle_id', 10::smallint, 'paid', 'Beto Solís', '+50670003333', 6,
                       '00000000-0000-0000-0000-000000000116') ->> 'status',
  'paid',
  'el 10 se vuelve a vender, directamente pagado'
);
select throws_ok(
  format($$ select public.change_sale_status(%L, 10::smallint, 'regalar', 7, '00000000-0000-0000-0000-000000000117') $$, :'raffle_id'),
  'P0001', 'R4A_VALIDATION',
  'una acción desconocida se rechaza'
);

reset role;
select results_eq(
  format($$ select buyer_name, status::text, end_reason from public.sales
             where raffle_id = %L and number = 10 order by ended_at nulls last $$, :'raffle_id'),
  $$ values ('Ana Mora', 'cancelled', 'cancelled'), ('Beto Solís', 'paid', null) $$,
  'el historial conserva la venta cancelada y la nueva por separado'
);
select results_eq(
  format($$ select action from public.audit_events
             where raffle_id = %L and number = 10 order by id $$, :'raffle_id'),
  $$ values ('sale.reserved'), ('sale.committed'), ('sale.payment_confirmed'),
            ('sale.payment_reverted'), ('sale.cancelled'), ('sale.sold') $$,
  'el log registra cada paso, una sola vez'
);
select is(
  (select details ->> 'reason' from public.audit_events
    where raffle_id = :'raffle_id' and action = 'sale.payment_reverted'),
  'Lo registré por error',
  'el motivo de la reversión queda en el log'
);

-- -----------------------------------------------------------------------------
-- La creadora actúa sobre cualquier lista
-- -----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select is(
  public.register_sale(:'raffle_id', 60::smallint, 'pending_payment', 'Cata Rojas', '+50670004444', 1,
                       '00000000-0000-0000-0000-000000000120') ->> 'status',
  'pending_payment',
  'la creadora registra una venta en la lista de María'
);

reset role;
select results_eq(
  format($$ select actor_type::text, actor_label, collaborator_id = (select id from public.collaborators
                                                                     where raffle_id = %1$L and position = 2)
              from public.audit_events where raffle_id = %1$L and number = 60 $$, :'raffle_id'),
  $$ values ('creator', 'Administrador', true) $$,
  'el log atribuye la acción al Administrador y la asocia a la lista de María'
);

-- -----------------------------------------------------------------------------
-- Corregir datos del comprador (María, sobre el 60)
-- -----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select is(
  public.update_buyer(:'raffle_id', 60::smallint, 'Cata Rojas', '+50670004445', 2,
                      '00000000-0000-0000-0000-000000000130') ->> 'version',
  '3',
  'María corrige el teléfono del comprador'
);

reset role;
select results_eq(
  format($$ select details -> 'fields' from public.audit_events
             where raffle_id = %L and action = 'sale.buyer_updated' $$, :'raffle_id'),
  $$ values ('["buyer_phone"]'::jsonb) $$,
  'el log registra qué campo cambió, no su valor'
);

-- -----------------------------------------------------------------------------
-- Fecha límite vencida
-- -----------------------------------------------------------------------------
-- Dos días atrás: así la prueba no depende de la hora UTC frente a la de Costa Rica.
update public.raffles set payment_deadline = current_date - 2 where id = :'raffle_id';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select is(
  public.register_sale(:'raffle_id', 11::smallint, 'pending_payment', 'Dani', '+50670005555', 1,
                       '00000000-0000-0000-0000-000000000140') ->> 'status',
  'overdue',
  'una venta pendiente registrada después de la fecha límite nace vencida'
);
select is(
  public.change_sale_status(:'raffle_id', 11::smallint, 'confirm_payment', 2,
                            '00000000-0000-0000-0000-000000000141') ->> 'status',
  'paid',
  'un pago tardío se puede registrar'
);
select is(
  public.register_sale(:'raffle_id', 12::smallint, 'pending_payment', 'Eva', '+50670006666', 1,
                       '00000000-0000-0000-0000-000000000142') ->> 'status',
  'overdue',
  'otra venta vencida'
);
select is(
  public.change_sale_status(:'raffle_id', 12::smallint, 'cancel', 2,
                            '00000000-0000-0000-0000-000000000143') ->> 'status',
  'available',
  'una venta vencida se libera'
);

reset role;
select is(
  (select paid_late from public.sales where raffle_id = :'raffle_id' and number = 11),
  true,
  'el pago tardío queda marcado'
);
select is(
  (select end_reason from public.sales where raffle_id = :'raffle_id' and number = 12),
  'released',
  'liberar una venta vencida se registra como liberación'
);

-- -----------------------------------------------------------------------------
-- Accesos que dejan de ser válidos
-- -----------------------------------------------------------------------------
update public.collaborators set is_paused = true where raffle_id = :'raffle_id' and position = 1;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok(
  format($$ select public.register_sale(%L, 13::smallint, 'reserved', 'Fer', '+50670007777', 1,
                                         '00000000-0000-0000-0000-000000000150') $$, :'raffle_id'),
  'P0001', 'R4A_FORBIDDEN',
  'un colaborador pausado no puede vender'
);

reset role;
update public.collaborators set is_paused = false where raffle_id = :'raffle_id' and position = 1;
-- Pasó el sorteo + 2 días, pero el job de cierre todavía no corrió.
update public.raffles set draw_date = current_date - 3, payment_deadline = current_date - 4 where id = :'raffle_id';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok(
  format($$ select public.register_sale(%L, 13::smallint, 'reserved', 'Fer', '+50670007777', 1,
                                         '00000000-0000-0000-0000-000000000151') $$, :'raffle_id'),
  'P0001', 'R4A_RAFFLE_STATE',
  'pasada la hora de cierre no se vende, aunque el job aún no haya cerrado la rifa'
);

reset role;
update public.raffles set draw_date = current_date + 30, payment_deadline = current_date + 20 where id = :'raffle_id';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select public.close_raffle(:'raffle_id');
select throws_ok(
  format($$ select public.register_sale(%L, 13::smallint, 'reserved', 'Fer', '+50670007777', 1,
                                         '00000000-0000-0000-0000-000000000152') $$, :'raffle_id'),
  'P0001', 'R4A_RAFFLE_STATE',
  'con la rifa cerrada ni la creadora puede vender'
);
select throws_ok(
  format($$ select public.change_sale_status(%L, 60::smallint, 'confirm_payment', 3,
                                              '00000000-0000-0000-0000-000000000153') $$, :'raffle_id'),
  'P0001', 'R4A_RAFFLE_STATE',
  'con la rifa cerrada tampoco se registran pagos'
);

-- -----------------------------------------------------------------------------
-- Privacidad del log
-- -----------------------------------------------------------------------------
reset role;
select is(
  (select count(*)::int from public.audit_events
    where raffle_id = :'raffle_id'
      and (details::text like '%+506%' or details::text ilike '%Ana Mora%' or details::text ilike '%Cata%')),
  0,
  'ningún evento del log contiene nombres ni teléfonos de compradores'
);
select is(
  (select count(*)::int from public.audit_events
    where raffle_id = :'raffle_id' and action like 'sale.%'
      and actor_type <> 'system' and request_id is null),
  0,
  'todo evento de venta hecho por una persona guarda su request_id'
);

select * from finish();
rollback;
