-- =============================================================================
-- Migration 0039: checklist de lâminas do painel de aprovação do cliente e
-- marca do estúdio. Rodar com `supabase start` + `supabase test db` (LOCAL).
--
-- Cada papel age como na API (role `authenticated` + `request.jwt.claims`),
-- então as policies de RLS e as checagens de `auth.uid()` valem de verdade.
--
--   P1: casal 1 (estúdio 1), aguardando aprovação; v1 e v2 liberadas, v3 rascunho.
--   P2: casal 2 (estúdio 2), aguardando aprovação.
--   P3: casal 1, em ajustes (prova fechada para decisão).
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

create function pg_temp.entrar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000039', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-39@teste.local',  '{"role":"admin"}',     '{}', now(), now()),
  ('f1000000-0000-4000-8000-000000000039', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f1-39@teste.local',     '{"role":"fotografo"}', '{"estudio":"Estúdio Um"}', now(), now()),
  ('f2000000-0000-4000-8000-000000000039', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f2-39@teste.local',     '{"role":"fotografo"}', '{"estudio":"Estúdio Dois"}', now(), now()),
  ('c1000000-0000-4000-8000-000000000039', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'casal1-39@teste.local', '{"role":"cliente"}',   '{}', now(), now()),
  ('c2000000-0000-4000-8000-000000000039', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'casal2-39@teste.local', '{"role":"cliente"}',   '{}', now(), now());

update public.fotografos set logo_url = 'https://midia.teste/logos/um.png' where id = 'f1000000-0000-4000-8000-000000000039';

insert into public.clientes (id, user_id, fotografo_id, nome, email) values
  ('cc100000-0000-4000-8000-000000000039', 'c1000000-0000-4000-8000-000000000039', 'f1000000-0000-4000-8000-000000000039', 'Ana e Bruno', 'casal1-39@teste.local'),
  ('cc200000-0000-4000-8000-000000000039', 'c2000000-0000-4000-8000-000000000039', 'f2000000-0000-4000-8000-000000000039', 'Carla e Davi', 'casal2-39@teste.local');

insert into public.projetos (id, nome, cliente_id, fotografo_id, status) values
  ('e1000000-0000-4000-8000-000000000039', 'Projeto 1', 'cc100000-0000-4000-8000-000000000039', 'f1000000-0000-4000-8000-000000000039', 'aguardando_aprovacao_cliente'),
  ('e2000000-0000-4000-8000-000000000039', 'Projeto 2', 'cc200000-0000-4000-8000-000000000039', 'f2000000-0000-4000-8000-000000000039', 'aguardando_aprovacao_cliente'),
  ('e3000000-0000-4000-8000-000000000039', 'Projeto 3', 'cc100000-0000-4000-8000-000000000039', 'f1000000-0000-4000-8000-000000000039', 'em_ajustes');

insert into public.design_versions (id, projeto_id, numero, status) values
  ('d1100000-0000-4000-8000-000000000039', 'e1000000-0000-4000-8000-000000000039', 1, 'aprovada'),
  ('d1200000-0000-4000-8000-000000000039', 'e1000000-0000-4000-8000-000000000039', 2, 'aprovada'),
  ('d1300000-0000-4000-8000-000000000039', 'e1000000-0000-4000-8000-000000000039', 3, 'em_producao'),
  ('d2100000-0000-4000-8000-000000000039', 'e2000000-0000-4000-8000-000000000039', 1, 'aprovada'),
  ('d3100000-0000-4000-8000-000000000039', 'e3000000-0000-4000-8000-000000000039', 1, 'aprovada');

-- Lâmina "bVO": b + versão + ordem (b12x = versão 2 do P1, ordem x).
insert into public.versoes_laminas (id, versao_id, ordem, storage_path) values
  ('b1110000-0000-4000-8000-000000000039', 'd1100000-0000-4000-8000-000000000039', 1, 'x/1.jpg'),
  ('b1210000-0000-4000-8000-000000000039', 'd1200000-0000-4000-8000-000000000039', 1, 'x/1.jpg'),
  ('b1220000-0000-4000-8000-000000000039', 'd1200000-0000-4000-8000-000000000039', 2, 'x/2.jpg'),
  ('b1230000-0000-4000-8000-000000000039', 'd1200000-0000-4000-8000-000000000039', 3, 'x/3.jpg'),
  ('b1310000-0000-4000-8000-000000000039', 'd1300000-0000-4000-8000-000000000039', 1, 'x/1.jpg'),
  ('b2110000-0000-4000-8000-000000000039', 'd2100000-0000-4000-8000-000000000039', 1, 'x/1.jpg'),
  ('b3110000-0000-4000-8000-000000000039', 'd3100000-0000-4000-8000-000000000039', 1, 'x/1.jpg');

-- =============================================================================
-- Casal 1 marca as lâminas da versão atual
-- =============================================================================
select pg_temp.entrar('c1000000-0000-4000-8000-000000000039');

-- Projeto e versão errados de propósito: o banco usa os da lâmina.
select lives_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao, estado)
     values ('e2000000-0000-4000-8000-000000000039', 'b1210000-0000-4000-8000-000000000039', 99, 'vista') $$,
  'casal marca a lâmina da versão atual como vista'
);
select results_eq(
  $$ select projeto_id, versao, usuario_id, estado, aprovada_em is null
       from public.prova_laminas_revisao where lamina_id = 'b1210000-0000-4000-8000-000000000039' $$,
  $$ values ('e1000000-0000-4000-8000-000000000039'::uuid, 2, 'c1000000-0000-4000-8000-000000000039'::uuid, 'vista'::text, true) $$,
  'projeto, versão e autor vêm da lâmina e da sessão, não do navegador'
);

select throws_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao)
     values ('e1000000-0000-4000-8000-000000000039', 'b1210000-0000-4000-8000-000000000039', 2) $$,
  '23505', null, 'uma linha por lâmina e pessoa (o app usa upsert)'
);

-- Upsert do app para "Esta lâmina está ok".
select lives_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao, estado)
     values ('e1000000-0000-4000-8000-000000000039', 'b1210000-0000-4000-8000-000000000039', 2, 'aprovada')
     on conflict (lamina_id, usuario_id) do update set estado = excluded.estado $$,
  'casal aprova a lâmina (upsert)'
);
select is(
  (select aprovada_em is not null from public.prova_laminas_revisao where lamina_id = 'b1210000-0000-4000-8000-000000000039'),
  true, 'o banco carimba aprovada_em'
);

select lives_ok(
  $$ update public.prova_laminas_revisao set estado = 'vista', vista_em = now() + interval '1 day'
      where lamina_id = 'b1210000-0000-4000-8000-000000000039' $$,
  'casal desfaz o "ok"'
);
select results_eq(
  $$ select estado, aprovada_em is null, vista_em < now() + interval '1 hour'
       from public.prova_laminas_revisao where lamina_id = 'b1210000-0000-4000-8000-000000000039' $$,
  $$ values ('vista'::text, true, true) $$,
  'desfazer limpa aprovada_em; vista_em não muda pelo navegador'
);

select lives_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao, estado)
     values ('e1000000-0000-4000-8000-000000000039', 'b1220000-0000-4000-8000-000000000039', 2, 'aprovada') $$,
  'casal aprova direto uma lâmina que ainda não tinha linha'
);

select throws_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao)
     values ('e1000000-0000-4000-8000-000000000039', 'b1110000-0000-4000-8000-000000000039', 1) $$,
  '42501', null, 'versão antiga (v1) não entra no checklist'
);
select throws_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao)
     values ('e1000000-0000-4000-8000-000000000039', 'b1310000-0000-4000-8000-000000000039', 3) $$,
  '42501', null, 'rascunho interno (v3 não liberada) não entra no checklist'
);
select throws_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao)
     values ('e2000000-0000-4000-8000-000000000039', 'b2110000-0000-4000-8000-000000000039', 1) $$,
  '42501', null, 'casal 1 não marca lâmina do projeto de outro casal'
);
select throws_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao)
     values ('e3000000-0000-4000-8000-000000000039', 'b3110000-0000-4000-8000-000000000039', 1) $$,
  '42501', null, 'prova fora de "aguardando aprovação" não aceita marcação'
);
select throws_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao, usuario_id)
     values ('e1000000-0000-4000-8000-000000000039', 'b1230000-0000-4000-8000-000000000039', 2, 'c2000000-0000-4000-8000-000000000039') $$,
  '42501', null, 'não grava em nome de outra pessoa'
);
select throws_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao)
     values ('e1000000-0000-4000-8000-000000000039', 'b9990000-0000-4000-8000-000000000039', 2) $$,
  'P0002', null, 'lâmina inexistente'
);

select results_eq(
  $$ select estudio, logo_url from public.marca_do_estudio_cliente() $$,
  $$ values ('Estúdio Um'::text, 'https://midia.teste/logos/um.png'::text) $$,
  'casal 1 vê só a marca do próprio estúdio'
);
select is_empty(
  $$ select 1 from public.fotografos $$,
  'a tabela fotografos continua fechada para o casal'
);

-- =============================================================================
-- Outros papéis
-- =============================================================================
select pg_temp.entrar('c2000000-0000-4000-8000-000000000039');
select is((select count(*) from public.prova_laminas_revisao), 0::bigint, 'casal 2 não vê o checklist do casal 1');
select is_empty(
  $$ update public.prova_laminas_revisao set estado = 'aprovada' returning 1 $$,
  'casal 2 não altera o checklist do casal 1'
);
select is_empty(
  $$ delete from public.prova_laminas_revisao returning 1 $$,
  'casal 2 não apaga o checklist do casal 1'
);
select results_eq(
  $$ select estudio from public.marca_do_estudio_cliente() $$,
  $$ values ('Estúdio Dois'::text) $$,
  'casal 2 vê a marca do estúdio 2'
);

select pg_temp.entrar('f1000000-0000-4000-8000-000000000039');
select is((select count(*) from public.prova_laminas_revisao), 2::bigint, 'o estúdio acompanha o checklist do casal');
select throws_ok(
  $$ insert into public.prova_laminas_revisao (projeto_id, lamina_id, versao)
     values ('e1000000-0000-4000-8000-000000000039', 'b1230000-0000-4000-8000-000000000039', 2) $$,
  '42501', null, 'o estúdio não marca lâmina pelo casal'
);
select is_empty(
  $$ update public.prova_laminas_revisao set estado = 'aprovada' returning 1 $$,
  'o estúdio não altera o checklist do casal'
);

select pg_temp.entrar('a0000000-0000-4000-8000-000000000039');
select is((select count(*) from public.prova_laminas_revisao), 2::bigint, 'a equipe vê o checklist');

-- =============================================================================
-- Prova decidida: o checklist congela
-- =============================================================================
reset role;
update public.projetos set status = 'aprovado' where id = 'e1000000-0000-4000-8000-000000000039';

select pg_temp.entrar('c1000000-0000-4000-8000-000000000039');
select is_empty(
  $$ update public.prova_laminas_revisao set estado = 'vista' returning 1 $$,
  'depois da decisão o casal não mexe mais no checklist'
);
select is((select count(*) from public.prova_laminas_revisao), 2::bigint, 'mas continua vendo o que marcou');

reset role;
set local role anon;
select throws_ok($$ select * from public.marca_do_estudio_cliente() $$, '42501', null, 'anon não consulta a marca');

reset role;
select * from finish();
rollback;
