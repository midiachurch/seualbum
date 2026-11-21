begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('d1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','proof-1@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('d1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','proof-2@example.invalid','{"role":"fotografo"}','{}',now(),now());
insert into public.clientes(id,fotografo_id,nome,email) values
('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Cliente sintético','proof-c1@example.invalid'),
('d3000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','Outro sintético','proof-c2@example.invalid');
insert into public.projetos(id,nome,cliente_id,fotografo_id,status) values
('d2000000-0000-4000-8000-000000000001','Prova privada','d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','aguardando_aprovacao_cliente'),
('d2000000-0000-4000-8000-000000000002','Outra prova','d3000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','aguardando_aprovacao_cliente');
insert into public.design_versions(id,projeto_id,numero,status) values
('d4000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',1,'aprovada'),
('d4000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001',2,'aprovada'),
('d4000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000002',1,'aprovada');
insert into public.versoes_laminas(id,versao_id,ordem,bucket,storage_path) values
('d5000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001',1,'r2','projetos/d2000000-0000-4000-8000-000000000001/prova/antiga.jpg'),
('d5000000-0000-4000-8000-000000000002','d4000000-0000-4000-8000-000000000002',1,'r2','projetos/d2000000-0000-4000-8000-000000000001/prova/atual.jpg'),
('d5000000-0000-4000-8000-000000000003','d4000000-0000-4000-8000-000000000003',1,'r2','projetos/d2000000-0000-4000-8000-000000000002/prova/outra.jpg');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true); set local role authenticated;
select public.gerir_portal('d2000000-0000-4000-8000-000000000001',repeat('a',64),'12345678');
reset role; set local role anon;
select ok(public.abrir_portal(repeat('a',64),'12345678',repeat('b',64)),'abre sessão guest');
select is(public.portal_prova(repeat('b',64))->>'numero','2','somente última versão liberada');
select is(jsonb_array_length(public.portal_prova(repeat('b',64))->'laminas'),1,'somente lâminas da versão liberada');
select ok(not ((public.portal_prova(repeat('b',64))->'laminas'->0) ? 'storage_path'),'listagem não expõe chave de mídia');
select throws_ok($$select public.portal_prova(repeat('c',64))$$,'42501',null,'sessão inventada negada');
select throws_ok($$select public.portal_lamina(repeat('b',64),'d5000000-0000-4000-8000-000000000003')$$,'42501',null,'mídia de outro projeto negada');
select throws_ok($$select public.portal_lamina(repeat('b',64),'d5000000-0000-4000-8000-000000000001')$$,'42501',null,'mídia de versão superada negada');
select is(public.portal_lamina(repeat('b',64),'d5000000-0000-4000-8000-000000000002')->>'bucket','r2','mídia liberada acessível por capacidade');
select throws_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000003','d5000000-0000-4000-8000-000000000003','comentario','Cruzar projeto',gen_random_uuid())$$,'42501',null,'comentário de outro projeto negado');
select throws_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','comentario','Versão antiga',gen_random_uuid())$$,'42501',null,'comentário em versão antiga negado');
select throws_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000002','d5000000-0000-4000-8000-000000000003','comentario','Lâmina cruzada',gen_random_uuid())$$,'42501',null,'lâmina cruzada negada');
select throws_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000002',null,'aprovado','Aprovar',gen_random_uuid())$$,'22023',null,'aprovação não disponível nesta RPC');
select throws_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000002',null,'comentario','Sem lâmina',gen_random_uuid())$$,'22023',null,'comentário exige lâmina');
select lives_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000002','d5000000-0000-4000-8000-000000000002','comentario','Ajustar enquadramento','d6000000-0000-4000-8000-000000000001')$$,'comenta na versão publicada');
select lives_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000002','d5000000-0000-4000-8000-000000000002','comentario','Ajustar enquadramento','d6000000-0000-4000-8000-000000000001')$$,'retry de comentário idempotente');
select throws_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000002','d5000000-0000-4000-8000-000000000002','comentario','Outro texto','d6000000-0000-4000-8000-000000000001')$$,'22023',null,'retry com payload diferente negado');
select is(jsonb_array_length(public.portal_prova(repeat('b',64))->'comentarios'),1,'comentário não duplica');
select throws_ok('select * from public.portal_prova_acoes','42501',null,'trilha de capacidade não tem leitura anon direta');
select lives_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000002',null,'ajustes','Revisar enquadramento geral','d6000000-0000-4000-8000-000000000002')$$,'solicitação de ajustes usa fluxo existente');
select lives_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000002',null,'ajustes','Revisar enquadramento geral','d6000000-0000-4000-8000-000000000002')$$,'retry aceito após encerramento da revisão');
select is(public.portal_prova(repeat('b',64))->>'aberta','false','revisão encerra após ajustes');
reset role;
select is((select status::text from public.projetos where id='d2000000-0000-4000-8000-000000000001'),'alteracoes_solicitadas','status alterado pelo trigger existente');
select is((select count(*)::integer from public.prova_comentarios where projeto_id='d2000000-0000-4000-8000-000000000001'),1,'comentário disponível à equipe no fluxo existente');
select ok((select autor_id is null from public.prova_comentarios where projeto_id='d2000000-0000-4000-8000-000000000001'),'guest não cria identidade Auth fictícia');
select is((select count(*)::integer from public.faturas where projeto_id='d2000000-0000-4000-8000-000000000001'),0,'pedido de ajustes não cria cobrança');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true); set local role authenticated;
select public.gerir_portal('d2000000-0000-4000-8000-000000000001',null,null,true);
reset role; set local role anon;
select throws_ok($$select public.portal_prova(repeat('b',64))$$,'42501',null,'revogação nega leitura');
select throws_ok($$select public.portal_lamina(repeat('b',64),'d5000000-0000-4000-8000-000000000002')$$,'42501',null,'revogação nega mídia');
select throws_ok($$select public.portal_comentar_prova(repeat('b',64),'d4000000-0000-4000-8000-000000000002',null,'ajustes','Revisar enquadramento geral','d6000000-0000-4000-8000-000000000002')$$,'42501',null,'revogação nega inclusive retry');
reset role;
select finish(); rollback;
