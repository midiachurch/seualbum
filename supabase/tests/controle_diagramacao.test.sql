-- =============================================================================
-- Controle do diagramador (migration 0038) contra o banco LOCAL:
-- `supabase start` + `supabase test db`.
--
--   * View `diagramacao_itens`: só a equipe vê linhas; etapas, atraso,
--     apontamentos abertos e link de aprovação do avulso.
--   * Trava: só admin/gestor mudam prioridade, espera e (no avulso)
--     responsável/prazo — o designer continua mexendo no resto.
--   * RPC `diagramacao_resumo`: KPIs, carga por diagramador e urgentes.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

create function pg_temp.entrar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000038', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gestor-38@teste.local',  '{"role":"gestor"}',    '{"nome_completo":"Gestora"}', now(), now()),
  ('d1000000-0000-4000-8000-000000000038', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd1-38@teste.local',      '{"role":"designer"}',  '{"nome_completo":"Diana"}', now(), now()),
  ('d2000000-0000-4000-8000-000000000038', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd2-38@teste.local',      '{"role":"designer"}',  '{"nome_completo":"Davi"}', now(), now()),
  ('f1000000-0000-4000-8000-000000000038', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f1-38@teste.local',      '{"role":"fotografo"}', '{"estudio":"Estúdio 38"}', now(), now()),
  ('c1000000-0000-4000-8000-000000000038', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'casal-38@teste.local',   '{"role":"cliente"}',   '{}', now(), now());

insert into public.clientes (id, user_id, fotografo_id, nome, email)
values ('cc000000-0000-4000-8000-000000000038', 'c1000000-0000-4000-8000-000000000038',
        'f1000000-0000-4000-8000-000000000038', 'Ana e Bruno', 'casal-38@teste.local');

-- P1: em diagramação com a Diana, prazo vencido → atrasado.
-- P2: com o cliente (v1 liberada), prazo de aprovação vencido, 2 pins abertos.
-- P3: aprovado pelo cliente agora.
-- P4: aguardando fotos → fora do controle.
-- P5: a diagramar, sem responsável, prazo vencido (vira "em espera" no teste).
insert into public.projetos (id, nome, cliente_id, fotografo_id, status, responsavel_id, data_limite_producao, data_limite_aprovacao)
values
  ('e1000000-0000-4000-8000-000000000038', 'Projeto Um',     'cc000000-0000-4000-8000-000000000038', 'f1000000-0000-4000-8000-000000000038', 'em_diagramacao',               'd1000000-0000-4000-8000-000000000038', now() - interval '2 days', null),
  ('e2000000-0000-4000-8000-000000000038', 'Projeto Dois',   'cc000000-0000-4000-8000-000000000038', 'f1000000-0000-4000-8000-000000000038', 'em_revisao_interna',           'd1000000-0000-4000-8000-000000000038', now() + interval '5 days', now() - interval '1 day'),
  ('e3000000-0000-4000-8000-000000000038', 'Projeto Três',   'cc000000-0000-4000-8000-000000000038', 'f1000000-0000-4000-8000-000000000038', 'aguardando_aprovacao_cliente', 'd2000000-0000-4000-8000-000000000038', now() + interval '5 days', null),
  ('e4000000-0000-4000-8000-000000000038', 'Projeto Quatro', 'cc000000-0000-4000-8000-000000000038', 'f1000000-0000-4000-8000-000000000038', 'aguardando_fotos',             null,                                    now() - interval '9 days', null),
  ('e5000000-0000-4000-8000-000000000038', 'Projeto Cinco',  'cc000000-0000-4000-8000-000000000038', 'f1000000-0000-4000-8000-000000000038', 'pronto_para_diagramacao',      null,                                    now() - interval '1 day', null);

insert into public.design_versions (id, projeto_id, numero, status)
values
  ('e2100000-0000-4000-8000-000000000038', 'e2000000-0000-4000-8000-000000000038', 1, 'aprovada'),
  ('e3100000-0000-4000-8000-000000000038', 'e3000000-0000-4000-8000-000000000038', 1, 'aprovada');

-- P2 vai para o cliente (prazo de aprovação já vencido, fixado depois do trigger da 0007).
update public.projetos set status = 'aguardando_aprovacao_cliente' where id = 'e2000000-0000-4000-8000-000000000038';
update public.projetos set data_limite_aprovacao = now() - interval '1 day' where id = 'e2000000-0000-4000-8000-000000000038';

insert into public.prova_comentarios (projeto_id, page_index, versao, texto, resolvido, resolvido_em)
values
  ('e2000000-0000-4000-8000-000000000038', 0, 1, 'Trocar a foto', false, null),
  ('e2000000-0000-4000-8000-000000000038', 1, 1, 'Clarear', false, null),
  ('e2000000-0000-4000-8000-000000000038', 2, 1, 'Já feito', true, now());

-- P3: o cliente aprova (trigger move o status para aprovado).
insert into public.aprovacoes (projeto_id, versao, status) values ('e3000000-0000-4000-8000-000000000038', 1, 'aprovado');

-- Avulsos: A1 rascunho; A2 com link de aprovação aberto e 1 comentário.
insert into public.album_layouts (id, nome, formato, orientacao, status, cliente_nome)
values
  ('ab100000-0000-4000-8000-000000000038', 'Avulso Um',   '30x30', 'quadrado', 'rascunho', 'Carla'),
  ('ab200000-0000-4000-8000-000000000038', 'Avulso Dois', '30x30', 'quadrado', 'enviado_aprovacao', 'Duda');

insert into public.album_aprovacoes (id, layout_id, numero, laminas)
values ('ab210000-0000-4000-8000-000000000038', 'ab200000-0000-4000-8000-000000000038', 1, '[{"path":"x.jpg"}]');

insert into public.album_aprovacao_comentarios (aprovacao_id, lamina_indice, texto, autor_nome)
values ('ab210000-0000-4000-8000-000000000038', 0, 'Mais claro', 'Duda');

-- -----------------------------------------------------------------------------
-- Quem vê a view
-- -----------------------------------------------------------------------------

set local role anon;
select throws_ok($$ select count(*) from public.diagramacao_itens $$, '42501', null, 'anon não lê a view');
select throws_ok($$ select public.diagramacao_resumo() $$, '42501', null, 'anon não chama o resumo');
reset role;

select pg_temp.entrar('f1000000-0000-4000-8000-000000000038');
select is((select count(*)::int from public.diagramacao_itens), 0, 'fotógrafo dono não vê linhas (só a equipe)');
select throws_ok($$ select public.diagramacao_resumo() $$, '42501', null, 'fotógrafo não chama o resumo');
reset role;

select pg_temp.entrar('d2000000-0000-4000-8000-000000000038');
select is((select count(*)::int from public.diagramacao_itens where id::text like '%000000000038'), 6, 'designer (equipe) vê os 6 itens em diagramação');
reset role;

-- -----------------------------------------------------------------------------
-- Conteúdo das linhas
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-4000-8000-000000000038');
select is((select count(*)::int from public.diagramacao_itens where id = 'e4000000-0000-4000-8000-000000000038'), 0, 'aguardando fotos fica fora');
select is((select etapa from public.diagramacao_itens where id = 'e1000000-0000-4000-8000-000000000038'), 'em_diagramacao', 'P1 em diagramação');
select is((select atrasado from public.diagramacao_itens where id = 'e1000000-0000-4000-8000-000000000038'), true, 'P1 com prazo vencido = atrasado');
select is((select responsavel_nome from public.diagramacao_itens where id = 'e1000000-0000-4000-8000-000000000038'), 'Diana', 'nome do responsável');
select is((select estudio from public.diagramacao_itens where id = 'e1000000-0000-4000-8000-000000000038'), 'Estúdio 38', 'estúdio do projeto');
select results_eq(
  $$ select etapa, versao_atual, apontamentos_abertos, cliente_atrasado, atrasado from public.diagramacao_itens where id = 'e2000000-0000-4000-8000-000000000038' $$,
  $$ values ('aguardando_cliente'::text, 1, 2, true, false) $$,
  'P2: com o cliente, v1, 2 pins abertos, cliente atrasado (não conta como atraso da equipe)'
);
select is((select etapa from public.diagramacao_itens where id = 'e3000000-0000-4000-8000-000000000038'), 'aprovado', 'P3 aprovado entra (últimos 30 dias)');
select results_eq(
  $$ select tipo, etapa, apontamentos_abertos, aprovacao_token is not null, cliente_nome from public.diagramacao_itens where id = 'ab200000-0000-4000-8000-000000000038' $$,
  $$ values ('avulso'::text, 'aguardando_cliente'::text, 1, true, 'Duda'::text) $$,
  'avulso com link: etapa, pins abertos, token e cliente'
);
select is((select etapa from public.diagramacao_itens where id = 'ab100000-0000-4000-8000-000000000038'), 'a_diagramar', 'avulso em rascunho = a diagramar');
reset role;

-- -----------------------------------------------------------------------------
-- Trava de admin/gestor
-- -----------------------------------------------------------------------------

select pg_temp.entrar('d1000000-0000-4000-8000-000000000038');
select throws_ok(
  $$ update public.projetos set prioridade = 'urgente' where id = 'e1000000-0000-4000-8000-000000000038' $$,
  '42501', null, 'designer não prioriza'
);
select throws_ok(
  $$ update public.projetos set em_espera = true where id = 'e1000000-0000-4000-8000-000000000038' $$,
  '42501', null, 'designer não pausa'
);
select throws_ok(
  $$ update public.album_layouts set responsavel_id = 'd1000000-0000-4000-8000-000000000038' where id = 'ab100000-0000-4000-8000-000000000038' $$,
  '42501', null, 'designer não se atribui um avulso'
);
select lives_ok(
  $$ update public.projetos set status = 'em_revisao_interna' where id = 'e1000000-0000-4000-8000-000000000038' $$,
  'designer continua mudando o status do projeto'
);
reset role;
update public.projetos set status = 'em_diagramacao' where id = 'e1000000-0000-4000-8000-000000000038';

select pg_temp.entrar('a0000000-0000-4000-8000-000000000038');
select lives_ok(
  $$ update public.projetos set em_espera = true, em_espera_motivo = 'Aguardando briefing', em_espera_desde = '2000-01-01'
     where id = 'e5000000-0000-4000-8000-000000000038' $$,
  'gestor pausa'
);
select ok(
  (select em_espera_desde > now() - interval '1 minute' from public.projetos where id = 'e5000000-0000-4000-8000-000000000038'),
  'o banco carimba o "desde" (ignora o enviado)'
);
select is((select atrasado from public.diagramacao_itens where id = 'e5000000-0000-4000-8000-000000000038'), false, 'em espera não conta como atrasado');
select lives_ok(
  $$ update public.album_layouts set responsavel_id = 'd2000000-0000-4000-8000-000000000038', prazo = now() - interval '1 hour', prioridade = 'alta'
     where id = 'ab100000-0000-4000-8000-000000000038' $$,
  'gestor atribui, dá prazo e prioriza o avulso'
);

-- -----------------------------------------------------------------------------
-- Resumo
-- -----------------------------------------------------------------------------

create temp table resumo as select public.diagramacao_resumo(10) as r;
select results_eq(
  $$ select (r->'kpis'->>'atrasados')::int, (r->'kpis'->>'aguardando_cliente')::int, (r->'kpis'->>'em_espera')::int,
            (r->'kpis'->>'aprovados_30d')::int, (r->'kpis'->>'cliente_atrasado')::int
       from resumo $$,
  $$ values (2, 2, 1, 1, 1) $$,
  'KPIs: 2 atrasados (P1 e avulso), 2 com o cliente, 1 em espera, 1 aprovado, 1 cliente atrasado'
);
select is(
  (select (d->>'atribuidos')::int from resumo, jsonb_array_elements(r->'designers') d where d->>'id' = 'd1000000-0000-4000-8000-000000000038'),
  2, 'Diana tem 2 álbuns atribuídos'
);
select ok(
  (select r->'urgentes'->0->>'id' from resumo) in ('e1000000-0000-4000-8000-000000000038', 'ab100000-0000-4000-8000-000000000038')
  and (select r->'urgentes'->0->>'atrasado' from resumo) = 'true',
  'o mais urgente é um atrasado'
);
select is(
  (select count(*)::int from resumo, jsonb_array_elements(r->'urgentes') u where u->>'id' = 'e5000000-0000-4000-8000-000000000038'),
  0, 'em espera fica fora dos urgentes'
);
reset role;

select * from finish();
rollback;
