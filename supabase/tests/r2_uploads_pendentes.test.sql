-- =============================================================================
-- Migration 0040: reservas de envio do R2 e chaves sem referência.
-- Rodar contra o banco LOCAL: `supabase start` + `supabase test db`.
--
-- Cada papel age como na API (role `authenticated` + `request.jwt.claims`);
-- a reserva é feita como o servidor faz (service_role).
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create function pg_temp.entrar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.servidor() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f1@teste.local',    '{"role":"fotografo"}', '{"estudio":"Estúdio Um"}', now(), now()),
  ('f2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f2@teste.local',    '{"role":"fotografo"}', '{"estudio":"Estúdio Dois"}', now(), now()),
  ('c1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'casal@teste.local', '{"role":"cliente"}',   '{}', now(), now());

insert into public.clientes (id, user_id, fotografo_id, nome, email)
values ('cc000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
        'f1000000-0000-4000-8000-000000000001', 'Ana e Bruno', 'casal@teste.local');

insert into public.projetos (id, nome, cliente_id, fotografo_id)
values ('e1000000-0000-4000-8000-000000000001', 'Projeto 1', 'cc000000-0000-4000-8000-000000000001',
        'f1000000-0000-4000-8000-000000000001');

-- Chaves usadas abaixo.
create temp table k as select
  'projetos/e1000000-0000-4000-8000-000000000001/fotos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-noiva.jpg'::text as k1,
  'projetos/e1000000-0000-4000-8000-000000000001/fotos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-expirada.jpg'::text as k2,
  'projetos/e1000000-0000-4000-8000-000000000001/fotos/cccccccc-cccc-4ccc-8ccc-cccccccccccc-copia.jpg'::text as k3;
grant select on k to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. Reservar: só o servidor; a primeira pessoa fica com a chave
-- -----------------------------------------------------------------------------
select pg_temp.servidor();
select ok(public.reservar_upload_r2((select k1 from k), 'c1000000-0000-4000-8000-000000000001'),
  'servidor reserva a chave para o cliente final que pediu o envio');
select ok(not public.reservar_upload_r2((select k1 from k), 'f1000000-0000-4000-8000-000000000001'),
  'a chave já reservada não passa para outra pessoa (nem para o estúdio dono)');
select ok(public.reservar_upload_r2((select k1 from k), 'c1000000-0000-4000-8000-000000000001'),
  'quem reservou pode renovar (assinar de novo)');
select ok(not public.reservar_upload_r2('pedidos/f1000000-0000-4000-8000-000000000001/x/y.jpg', 'f1000000-0000-4000-8000-000000000001'),
  'chave fora da pasta de fotos do projeto não é reservada');
select ok(not public.reservar_upload_r2('projetos/e1000000-0000-4000-8000-000000000001/fotos/../versoes/x.jpg', 'f1000000-0000-4000-8000-000000000001'),
  'chave com .. não é reservada');
reset role;

select pg_temp.entrar('f2000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.reservar_upload_r2((select k1 from k), 'f2000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'pela sessão do usuário (PostgREST) não dá para reservar');
select throws_ok(
  $$ insert into public.r2_uploads_pendentes (r2_key, user_id, expira_em) values ('projetos/x/fotos/y', auth.uid(), now() + interval '1 day') $$,
  '42501', null, 'nem gravar direto na tabela de reservas');
reset role;

select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.r2_uploads_pendentes), 1, 'o cliente final vê a própria reserva');
reset role;
select pg_temp.entrar('f1000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.r2_uploads_pendentes), 0, 'o estúdio não vê a reserva de outra pessoa');

-- -----------------------------------------------------------------------------
-- 2. Confirmar (INSERT em `fotos`): só quem reservou, uma vez
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('e1000000-0000-4000-8000-000000000001', (select k1 from k), 'r2', auth.uid()) $$,
  '23514', null, 'a corrida: o estúdio não confirma a chave que o cliente final enviou');
select throws_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('e1000000-0000-4000-8000-000000000001', (select k1 from k), 'r2', 'c1000000-0000-4000-8000-000000000001') $$,
  '23514', null, 'nem em nome de quem reservou');
reset role;

select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('e1000000-0000-4000-8000-000000000001', (select k1 from k), 'r2', 'f1000000-0000-4000-8000-000000000001') $$,
  '23514', null, 'quem reservou também não grava em nome de outra pessoa');
select lives_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('e1000000-0000-4000-8000-000000000001', (select k1 from k), 'r2', auth.uid()) $$,
  'quem reservou confirma');
select is((select count(*)::int from public.r2_uploads_pendentes), 0, 'a confirmação consome a reserva');
select throws_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('e1000000-0000-4000-8000-000000000001', (select k1 from k), 'r2', auth.uid()) $$,
  '23514', null, 'a mesma chave não é confirmada de novo');
reset role;

select pg_temp.servidor();
select ok(not public.reservar_upload_r2((select k1 from k), 'f1000000-0000-4000-8000-000000000001'),
  'chave já registrada em `fotos` não é reservada de novo');
reset role;

-- Apagada a foto, ninguém a "ressuscita" pela chave.
select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
delete from public.fotos where storage_path = (select k1 from k);
select is((select count(*)::int from public.fotos where storage_path = (select k1 from k)), 0, 'o cliente final apaga a própria foto');
select throws_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('e1000000-0000-4000-8000-000000000001', (select k1 from k), 'r2', auth.uid()) $$,
  '23514', null, 'nem quem enviou reconfirma a foto apagada sem novo envio');
reset role;
select pg_temp.entrar('f1000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('e1000000-0000-4000-8000-000000000001', (select k1 from k), 'r2', auth.uid()) $$,
  '23514', null, 'nem outra pessoa que conhecia a chave');
reset role;

-- Reserva vencida não vale.
insert into public.r2_uploads_pendentes (r2_key, user_id, expira_em)
values ((select k2 from k), 'c1000000-0000-4000-8000-000000000001', now() - interval '1 minute');
select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('e1000000-0000-4000-8000-000000000001', (select k2 from k), 'r2', auth.uid()) $$,
  '23514', null, 'reserva vencida não confirma');
reset role;

-- O servidor (script de cópia) grava sem reserva, como antes.
select pg_temp.servidor();
select lives_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('e1000000-0000-4000-8000-000000000001', (select k3 from k), 'r2', null) $$,
  'service_role grava chave da pasta do projeto sem reserva');
reset role;

-- -----------------------------------------------------------------------------
-- 3. Chaves sem referência (varredura do Cron)
-- -----------------------------------------------------------------------------
insert into public.design_versions (id, projeto_id, numero, status)
values ('e1100000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 1, 'enviada');
insert into public.versoes_laminas (versao_id, ordem, bucket, storage_path)
values ('e1100000-0000-4000-8000-000000000001', 1, 'r2',
        'projetos/e1000000-0000-4000-8000-000000000001/versoes/11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd-l1.jpg');
insert into public.media_assets (storage_path, nome, bucket, url)
values ('vitrine/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee-banner.webp', 'banner', 'r2',
        'https://midia.exemplo/vitrine/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee-banner.webp');
update public.fotografos set logo_path = 'logos/f1000000-0000-4000-8000-000000000001/ffffffff-ffff-4fff-8fff-ffffffffffff-logo.png', logo_bucket = 'r2'
 where id = 'f1000000-0000-4000-8000-000000000001';
-- Caminhos dentro de JSON (como os do editor) e uma pasta inteira citada.
update public.projetos
   set album_config = '{"fotos":[{"path":"albuns/99999999-9999-4999-8999-999999999999/12121212-1212-4121-8121-121212121212-a.jpg"}],"lote":"projetos/e1000000-0000-4000-8000-000000000001/versoes/22222222-2222-4222-8222-222222222222"}'
 where id = 'e1000000-0000-4000-8000-000000000001';
insert into public.pedidos_fotos_r2 (client_id, chave_idempotencia, r2_key, nome_original, tamanho, content_type)
values ('f1000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333',
        'pedidos/f1000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444-a.jpg',
        'a.jpg', 10, 'image/jpeg');

select pg_temp.servidor();
select results_eq(
  $$ select * from public.r2_chaves_sem_referencia(array[
       (select k3 from k),                                                                       -- em fotos
       (select k1 from k),                                                                       -- foto apagada: órfã
       (select k2 from k),                                                                       -- reserva (mesmo vencida) ainda cita
       'projetos/e1000000-0000-4000-8000-000000000001/versoes/11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd-l1.jpg',
       'projetos/e1000000-0000-4000-8000-000000000001/versoes/22222222-2222-4222-8222-222222222222/x-l2.jpg', -- pasta citada
       'projetos/e1000000-0000-4000-8000-000000000001/versoes/55555555-5555-4555-8555-555555555555/x-l3.jpg', -- órfã
       'vitrine/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee-banner.webp',
       'vitrine/abababab-abab-4aba-8aba-abababababab-velho.webp',                                 -- órfã
       'logos/f1000000-0000-4000-8000-000000000001/ffffffff-ffff-4fff-8fff-ffffffffffff-logo.png',
       'albuns/99999999-9999-4999-8999-999999999999/12121212-1212-4121-8121-121212121212-a.jpg',
       'albuns/99999999-9999-4999-8999-999999999999/derivados/x-mini.jpg',                       -- órfã
       'pedidos/f1000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444-a.jpg',
       'outra-coisa/arquivo.jpg',                                                                -- fora do app: fica
       'projetos/e1000000-0000-4000-8000-000000000001/fotos/x y.jpg',                            -- formato estranho: fica
       'projetos/../fotos/a.jpg'
     ]) $$,
  $$ values
       ('albuns/99999999-9999-4999-8999-999999999999/derivados/x-mini.jpg'::text),
       ('projetos/e1000000-0000-4000-8000-000000000001/fotos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-noiva.jpg'),
       ('projetos/e1000000-0000-4000-8000-000000000001/versoes/55555555-5555-4555-8555-555555555555/x-l3.jpg'),
       ('vitrine/abababab-abab-4aba-8aba-abababababab-velho.webp') $$,
  'só as chaves que nenhuma coluna cita (nem a pasta acima) saem; formatos estranhos ficam'
);
select is((select count(*)::int from public.r2_chaves_sem_referencia('{}')), 0, 'lista vazia não devolve nada');
reset role;

select pg_temp.entrar('f1000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.r2_chaves_sem_referencia(array['vitrine/x.jpg']) $$,
  '42501', null, 'só o servidor consulta referências');
reset role;

select pg_temp.servidor();
select throws_ok(
  $$ select public.r2_chaves_sem_referencia(array_fill('vitrine/x.jpg'::text, array[10001])) $$,
  '54000', null, 'no máximo 10000 chaves por chamada');
reset role;

select * from finish();
rollback;
