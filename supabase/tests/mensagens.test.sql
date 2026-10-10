-- =============================================================================
-- Mensagens (migration 0037) contra o banco LOCAL: `supabase start` +
-- `supabase test db`.
--
--   * Estúdio ↔ equipe e cliente ↔ estúdio: quem abre, lê e escreve cada fio.
--   * Isolamento entre estúdios e entre clientes (até do mesmo estúdio).
--   * Designer só no fio do projeto atribuído; equipe só lê o fio do cliente.
--   * Autor/nome vêm do banco, lâmina só do próprio projeto, exclusão lógica.
--   * Não lidas, "lido até", leitura da equipe interna, mensagem de sistema.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(62);

create function pg_temp.entrar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Ids que só existem depois de abrir os fios.
create temp table ids (nome text primary key, id uuid);
grant select, insert on ids to authenticated;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000037', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op-37@teste.local',  '{"role":"operador"}',  '{"nome_completo":"Olga Operadora"}', now(), now()),
  ('d1000000-0000-4000-8000-000000000037', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd1-37@teste.local',  '{"role":"designer"}',  '{"nome_completo":"Davi Designer"}', now(), now()),
  ('d2000000-0000-4000-8000-000000000037', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd2-37@teste.local',  '{"role":"designer"}',  '{"nome_completo":"Dora Designer"}', now(), now()),
  ('f1000000-0000-4000-8000-000000000037', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f1-37@teste.local',  '{"role":"fotografo"}', '{"estudio":"Estúdio Um"}', now(), now()),
  ('f2000000-0000-4000-8000-000000000037', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f2-37@teste.local',  '{"role":"fotografo"}', '{"estudio":"Estúdio Dois"}', now(), now()),
  ('c1000000-0000-4000-8000-000000000037', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-37@teste.local',  '{"role":"cliente"}',   '{}', now(), now()),
  ('c2000000-0000-4000-8000-000000000037', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2-37@teste.local',  '{"role":"cliente"}',   '{}', now(), now()),
  ('c3000000-0000-4000-8000-000000000037', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c3-37@teste.local',  '{"role":"cliente"}',   '{}', now(), now());

insert into public.clientes (id, user_id, fotografo_id, nome, email) values
  ('cc100000-0000-4000-8000-000000000037', 'c1000000-0000-4000-8000-000000000037', 'f1000000-0000-4000-8000-000000000037', 'Ana e Bruno', 'c1-37@teste.local'),
  ('cc200000-0000-4000-8000-000000000037', 'c2000000-0000-4000-8000-000000000037', 'f1000000-0000-4000-8000-000000000037', 'Carla e Davi', 'c2-37@teste.local'),
  ('cc300000-0000-4000-8000-000000000037', 'c3000000-0000-4000-8000-000000000037', 'f2000000-0000-4000-8000-000000000037', 'Eva e Fábio', 'c3-37@teste.local');

insert into public.projetos (id, nome, cliente_id, fotografo_id, responsavel_id, status) values
  ('e1000000-0000-4000-8000-000000000037', 'Casamento Ana', 'cc100000-0000-4000-8000-000000000037', 'f1000000-0000-4000-8000-000000000037', 'd1000000-0000-4000-8000-000000000037', 'em_revisao_interna'),
  ('e2000000-0000-4000-8000-000000000037', 'Casamento Carla', 'cc200000-0000-4000-8000-000000000037', 'f1000000-0000-4000-8000-000000000037', null, 'em_diagramacao'),
  ('e3000000-0000-4000-8000-000000000037', 'Casamento Eva', 'cc300000-0000-4000-8000-000000000037', 'f2000000-0000-4000-8000-000000000037', null, 'em_diagramacao');

insert into public.design_versions (id, projeto_id, numero, status) values
  ('e1100000-0000-4000-8000-000000000037', 'e1000000-0000-4000-8000-000000000037', 1, 'aprovada'),
  ('e3100000-0000-4000-8000-000000000037', 'e3000000-0000-4000-8000-000000000037', 1, 'aprovada');

insert into public.versoes_laminas (id, versao_id, ordem, storage_path) values
  ('11100000-0000-4000-8000-000000000037', 'e1100000-0000-4000-8000-000000000037', 1, 'x/1.jpg'),
  ('33300000-0000-4000-8000-000000000037', 'e3100000-0000-4000-8000-000000000037', 1, 'y/1.jpg');

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'mensagens'),
  'mensagens está na publicação do Realtime'
);

-- -----------------------------------------------------------------------------
-- Abrir fios
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f1000000-0000-4000-8000-000000000037');
insert into ids values
  ('geral_f1', public.abrir_conversa('estudio_equipe')),
  ('equipe_p1', public.abrir_conversa('estudio_equipe', null, 'e1000000-0000-4000-8000-000000000037')),
  ('cliente_p1', public.abrir_conversa('cliente_estudio', null, 'e1000000-0000-4000-8000-000000000037'));
select is(public.abrir_conversa('estudio_equipe'), (select id from ids where nome = 'geral_f1'), 'abrir de novo devolve o mesmo fio geral');
select is(
  public.abrir_conversa('cliente_estudio', null, 'e1000000-0000-4000-8000-000000000037'),
  (select id from ids where nome = 'cliente_p1'),
  'abrir de novo devolve o mesmo fio do cliente'
);
select throws_ok($$ select public.abrir_conversa('cliente_estudio') $$, '22023', null, 'fio com o cliente exige projeto');
select throws_ok($$ select public.abrir_conversa('outro') $$, '22023', null, 'canal inválido');
select throws_ok(
  $$ select public.abrir_conversa('estudio_equipe', null, 'e3000000-0000-4000-8000-000000000037') $$,
  '42501', null, 'estúdio não abre fio de projeto de outro estúdio'
);
insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'geral_f1'), 'Oi equipe, dúvida sobre prazos');
insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'cliente_p1'), 'Olá Ana! Sua prova sai esta semana.');
reset role;

select pg_temp.entrar('f2000000-0000-4000-8000-000000000037');
select throws_ok(
  $$ select public.abrir_conversa('estudio_equipe', 'f1000000-0000-4000-8000-000000000037') $$,
  '42501', null, 'estúdio não abre o fio geral de outro estúdio'
);
select throws_ok(
  $$ select public.abrir_conversa('cliente_estudio', null, 'e1000000-0000-4000-8000-000000000037') $$,
  '42501', null, 'estúdio não abre o fio do cliente de outro estúdio'
);
insert into ids values ('geral_f2', public.abrir_conversa('estudio_equipe'));
insert into ids values ('cliente_p3', public.abrir_conversa('cliente_estudio', null, 'e3000000-0000-4000-8000-000000000037'));
insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'cliente_p3'), 'Mensagem do Estúdio Dois');
reset role;

-- -----------------------------------------------------------------------------
-- Isolamento entre estúdios
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f2000000-0000-4000-8000-000000000037');
select is((select count(*)::int from public.conversas where fotografo_id = 'f1000000-0000-4000-8000-000000000037'), 0, 'estúdio 2 não vê fios do estúdio 1');
select is(
  (select count(*)::int from public.mensagens m join ids on ids.id = m.conversa_id where ids.nome in ('geral_f1', 'equipe_p1', 'cliente_p1')),
  0, 'estúdio 2 não lê mensagens do estúdio 1'
);
select is((select count(*)::int from public.listar_conversas(null, 'f1000000-0000-4000-8000-000000000037')), 0, 'listar_conversas filtrando outro estúdio volta vazio');
select is((select count(*)::int from public.listar_conversas()), 2, 'estúdio 2 lista só os próprios 2 fios');
select throws_ok(
  $$ insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'geral_f1'), 'intruso') $$,
  '42501', null, 'estúdio 2 não escreve no fio do estúdio 1'
);
select throws_ok(
  $$ select public.marcar_conversa_lida((select id from ids where nome = 'cliente_p1')) $$,
  '42501', null, 'estúdio 2 não marca leitura em fio alheio'
);
reset role;

-- -----------------------------------------------------------------------------
-- Cliente final
-- -----------------------------------------------------------------------------

select pg_temp.entrar('c1000000-0000-4000-8000-000000000037');
select is(
  public.abrir_conversa('cliente_estudio', null, 'e1000000-0000-4000-8000-000000000037'),
  (select id from ids where nome = 'cliente_p1'),
  'cliente abre o mesmo fio do projeto dele'
);
select throws_ok(
  $$ select public.abrir_conversa('estudio_equipe', null, 'e1000000-0000-4000-8000-000000000037') $$,
  '42501', null, 'cliente não abre o fio do estúdio com a equipe'
);
select throws_ok(
  $$ select public.abrir_conversa('cliente_estudio', null, 'e2000000-0000-4000-8000-000000000037') $$,
  '42501', null, 'cliente não abre fio de outro projeto do mesmo estúdio'
);
select is((select count(*)::int from public.conversas), 1, 'cliente vê só o próprio fio');
select is((select count(*)::int from public.mensagens), 1, 'cliente lê só as mensagens do próprio fio');
select is(public.total_mensagens_nao_lidas(), 1, 'cliente tem 1 não lida (do estúdio)');
select is(
  (select estudio from public.listar_conversas()),
  'Estúdio Um', 'o fio do cliente vem com a marca do estúdio'
);
select throws_ok(
  $$ insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'equipe_p1'), 'oi equipe') $$,
  '42501', null, 'cliente não escreve no fio do estúdio com a equipe'
);
-- Autor, lado e nome vêm do banco, não do navegador.
insert into public.mensagens (conversa_id, corpo, autor_id, autor_nome, autor_papel)
values ((select id from ids where nome = 'cliente_p1'), '  Oba, obrigada!  ', 'f1000000-0000-4000-8000-000000000037', 'Equipe', 'equipe');
select results_eq(
  $$ select autor_id::text, autor_papel, autor_nome, corpo from public.mensagens where corpo like 'Oba%' $$,
  $$ values ('c1000000-0000-4000-8000-000000000037', 'cliente', 'Ana e Bruno', 'Oba, obrigada!') $$,
  'autor, lado e nome forçados pelo banco; corpo aparado'
);
select throws_ok(
  $$ insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'cliente_p1'), '   ') $$,
  '23514', null, 'mensagem vazia é recusada'
);
select throws_ok(
  $$ insert into public.mensagens (conversa_id, corpo, lamina_id) values ((select id from ids where nome = 'cliente_p1'), 'esta', '33300000-0000-4000-8000-000000000037') $$,
  '23514', null, 'cliente não cita lâmina de outro projeto'
);
insert into public.mensagens (conversa_id, corpo, lamina_id)
values ((select id from ids where nome = 'cliente_p1'), 'Gostei desta lâmina', '11100000-0000-4000-8000-000000000037');
select is(
  (select versao_id::text from public.mensagens where corpo = 'Gostei desta lâmina'),
  'e1100000-0000-4000-8000-000000000037', 'lâmina do próprio projeto vincula a versão'
);
reset role;

select pg_temp.entrar('c2000000-0000-4000-8000-000000000037');
select is((select count(*)::int from public.conversas), 0, 'outro cliente do mesmo estúdio não vê o fio');
select is((select count(*)::int from public.mensagens), 0, 'outro cliente do mesmo estúdio não lê as mensagens');
select is(public.total_mensagens_nao_lidas(), 0, 'outro cliente não tem não lidas');
select throws_ok(
  $$ insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'cliente_p1'), 'intrusa') $$,
  '42501', null, 'outro cliente não escreve no fio'
);
reset role;

select pg_temp.entrar('c3000000-0000-4000-8000-000000000037');
select is((select count(*)::int from public.mensagens), 1, 'cliente do estúdio 2 lê só o fio dele');
select is((select count(*)::int from public.listar_conversas()), 1, 'cliente do estúdio 2 lista só o fio dele');
reset role;

-- -----------------------------------------------------------------------------
-- Equipe: operação e designer
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-4000-8000-000000000037');
select is(public.total_mensagens_nao_lidas(), 1, 'operação: 1 não lida (estúdio 1 no fio geral); fio do cliente não conta');
select is((select count(*)::int from public.mensagens m join ids on ids.id = m.conversa_id where ids.nome = 'cliente_p1'), 3, 'operação lê o fio do cliente (suporte)');
select throws_ok(
  $$ insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'cliente_p1'), 'suporte') $$,
  '42501', null, 'operação não escreve no fio do cliente'
);
select throws_ok(
  $$ select public.abrir_conversa('cliente_estudio', null, 'e2000000-0000-4000-8000-000000000037') $$,
  '42501', null, 'operação não abre fio de cliente'
);
insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'geral_f1'), 'Oi! Prazo de 10 dias úteis.');
select is(
  (select autor_papel || '/' || autor_nome from public.mensagens where corpo like 'Oi! Prazo%'),
  'equipe/Olga Operadora', 'equipe assina com o próprio nome'
);
select is(public.total_mensagens_nao_lidas(), 0, 'responder marca o fio como lido');
select is(public.abrir_conversa('estudio_equipe', 'f2000000-0000-4000-8000-000000000037'), (select id from ids where nome = 'geral_f2'), 'operação abre o fio geral de qualquer estúdio');
select lives_ok($$ select public.marcar_conversa_lida((select id from ids where nome = 'cliente_p1')) $$, 'operação marca leitura no fio do cliente');
reset role;

select pg_temp.entrar('d1000000-0000-4000-8000-000000000037');
select is(
  (select array_agg(ids.nome order by ids.nome) from public.conversas c join ids on ids.id = c.id),
  array['equipe_p1'], 'designer atribuído vê só o fio do projeto dele com a equipe'
);
select is((select count(*)::int from public.mensagens m join ids on ids.id = m.conversa_id where ids.nome = 'cliente_p1'), 0, 'designer não lê o fio do cliente');
select is((select cliente_nome from public.listar_conversas()), null, 'designer não recebe o nome do cliente final');
select lives_ok(
  $$ insert into public.mensagens (conversa_id, corpo) values ((select id from ids where nome = 'equipe_p1'), 'Subi a versão 1') $$,
  'designer atribuído escreve no fio do projeto'
);
select throws_ok($$ select public.abrir_conversa('estudio_equipe', 'f1000000-0000-4000-8000-000000000037') $$, '42501', null, 'designer não abre fio geral');
reset role;

select pg_temp.entrar('d2000000-0000-4000-8000-000000000037');
select is((select count(*)::int from public.conversas), 0, 'designer sem atribuição não vê fios');
select throws_ok(
  $$ select public.abrir_conversa('estudio_equipe', null, 'e1000000-0000-4000-8000-000000000037') $$,
  '42501', null, 'designer sem atribuição não abre o fio do projeto'
);
reset role;

-- -----------------------------------------------------------------------------
-- Leituras, não lidas e exclusão lógica
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f1000000-0000-4000-8000-000000000037');
select is(
  (select nao_lidas from public.contar_mensagens_nao_lidas() n join ids on ids.id = n.conversa_id where ids.nome = 'cliente_p1'),
  2, 'estúdio: 2 não lidas do cliente'
);
select is(public.total_mensagens_nao_lidas(), 4, 'estúdio: 2 do cliente + 1 da equipe + 1 do designer');
select is(
  (select count(*)::int from public.conversa_leituras l join ids on ids.id = l.conversa_id
    where ids.nome = 'cliente_p1' and l.usuario_id = 'a0000000-0000-4000-8000-000000000037'),
  0, 'estúdio não vê que a equipe leu o fio do cliente'
);
select is(
  (select count(*)::int from public.conversa_leituras l join ids on ids.id = l.conversa_id
    where ids.nome = 'geral_f1' and l.usuario_id = 'a0000000-0000-4000-8000-000000000037'),
  1, 'estúdio vê o "visto" da equipe no fio com a equipe'
);
select lives_ok($$ select public.marcar_conversa_lida((select id from ids where nome = 'cliente_p1')) $$, 'estúdio marca o fio do cliente como lido');
select is(public.total_mensagens_nao_lidas(), 2, 'sobram as 2 do fio com a equipe');
reset role;

select pg_temp.entrar('c1000000-0000-4000-8000-000000000037');
select is(
  (select count(*)::int from public.conversa_leituras where usuario_id = 'a0000000-0000-4000-8000-000000000037'),
  0, 'cliente não vê a leitura da equipe'
);
select is(
  (select count(*)::int from public.conversa_leituras where usuario_id = 'f1000000-0000-4000-8000-000000000037'),
  1, 'cliente vê o "visto" do estúdio'
);
-- Só apagar a própria mensagem; mensagem do estúdio fica intacta.
update public.mensagens set apagada_em = now() where corpo like 'Olá Ana%';
select is(
  (select apagada_em is null from public.mensagens where corpo like 'Olá Ana%'),
  true, 'cliente não apaga mensagem do estúdio'
);
select throws_ok(
  $$ update public.mensagens set corpo = 'editada' where corpo = 'Oba, obrigada!' $$,
  '23514', null, 'mensagem não pode ser editada, só apagada'
);
update public.mensagens set apagada_em = now() where corpo = 'Oba, obrigada!';
select results_eq(
  $$ select corpo, apagada_por::text from public.mensagens where apagada_em is not null $$,
  $$ values ('', 'c1000000-0000-4000-8000-000000000037') $$,
  'exclusão lógica: a linha fica, o corpo some'
);
reset role;

-- -----------------------------------------------------------------------------
-- Mensagem de sistema nos marcos da prova
-- -----------------------------------------------------------------------------

update public.projetos set status = 'aguardando_aprovacao_cliente' where id = 'e1000000-0000-4000-8000-000000000037';
select results_eq(
  $$ select m.tipo, m.autor_papel, m.corpo from public.mensagens m join ids on ids.id = m.conversa_id
     where ids.nome = 'equipe_p1' and m.tipo = 'sistema' $$,
  $$ values ('sistema', 'sistema', 'Prova publicada — versão 1. Aguardando a aprovação.') $$,
  'prova publicada vira mensagem de sistema no fio do projeto com a equipe'
);
update public.projetos set status = 'alteracoes_solicitadas' where id = 'e1000000-0000-4000-8000-000000000037';
select is(
  (select count(*)::int from public.mensagens m join ids on ids.id = m.conversa_id where ids.nome = 'equipe_p1' and m.tipo = 'sistema'),
  2, 'ajustes solicitados também viram mensagem de sistema'
);
select is(
  (select count(*)::int from public.mensagens m join ids on ids.id = m.conversa_id where ids.nome = 'cliente_p1' and m.tipo = 'sistema'),
  0, 'nada de mensagem de sistema no fio do cliente'
);

-- -----------------------------------------------------------------------------
-- Anônimo
-- -----------------------------------------------------------------------------

set local role anon;
select throws_ok($$ select count(*) from public.mensagens $$, '42501', null, 'anon não lê mensagens');
reset role;

select * from finish();
rollback;
