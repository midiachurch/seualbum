begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f9100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','aprovacao-1@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f9100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','aprovacao-2@example.invalid','{"role":"fotografo"}','{}',now(),now());
insert into public.clientes(id,fotografo_id,nome,email) values
('f9200000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000001','Cliente sintético','cliente-1@example.invalid'),
('f9200000-0000-4000-8000-000000000002','f9100000-0000-4000-8000-000000000002','Outro cliente','cliente-2@example.invalid');
insert into public.projetos(id,nome,cliente_id,fotografo_id,status,laminas_inclusas,preco_lamina_extra) values
('f9300000-0000-4000-8000-000000000001','Prova sem extras','f9200000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000001','aguardando_aprovacao_cliente',10,12),
('f9300000-0000-4000-8000-000000000002','Prova cruzada','f9200000-0000-4000-8000-000000000002','f9100000-0000-4000-8000-000000000002','aguardando_aprovacao_cliente',10,12),
('f9300000-0000-4000-8000-000000000003','Prova com extras','f9200000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000001','aguardando_aprovacao_cliente',1,12),
('f9300000-0000-4000-8000-000000000004','Prova vazia','f9200000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000001','aguardando_aprovacao_cliente',10,12);
insert into public.design_versions(id,projeto_id,numero,status) values
('f9400000-0000-4000-8000-000000000001','f9300000-0000-4000-8000-000000000001',1,'aprovada'),
('f9400000-0000-4000-8000-000000000002','f9300000-0000-4000-8000-000000000001',2,'aprovada'),
('f9400000-0000-4000-8000-000000000003','f9300000-0000-4000-8000-000000000002',1,'aprovada'),
('f9400000-0000-4000-8000-000000000004','f9300000-0000-4000-8000-000000000003',1,'aprovada'),
('f9400000-0000-4000-8000-000000000005','f9300000-0000-4000-8000-000000000004',1,'aprovada');
insert into public.versoes_laminas(versao_id,ordem,storage_path) values
('f9400000-0000-4000-8000-000000000002',1,'teste/atual.jpg'),
('f9400000-0000-4000-8000-000000000003',1,'teste/outra.jpg'),
('f9400000-0000-4000-8000-000000000004',1,'teste/extra-1.jpg'),
('f9400000-0000-4000-8000-000000000004',2,'teste/extra-2.jpg');
select set_config('request.jwt.claims','{"sub":"f9100000-0000-4000-8000-000000000001","role":"authenticated"}',true); set local role authenticated;
select public.gerir_portal('f9300000-0000-4000-8000-000000000001',repeat('1',64),'12345678');
select public.gerir_portal('f9300000-0000-4000-8000-000000000003',repeat('3',64),'12345678');
select public.gerir_portal('f9300000-0000-4000-8000-000000000004',repeat('4',64),'12345678');
reset role; set local role anon;
select ok(public.abrir_portal(repeat('1',64),'12345678',repeat('a',64)),'sessão da prova normal');
select ok(public.abrir_portal(repeat('3',64),'12345678',repeat('b',64)),'sessão da prova com extras');
select ok(public.abrir_portal(repeat('4',64),'12345678',repeat('c',64)),'sessão da prova vazia');
select throws_ok($$select public.portal_aprovar_prova(repeat('d',64),'f9400000-0000-4000-8000-000000000002',gen_random_uuid())$$,'42501',null,'sessão inventada não aprova');
select throws_ok($$select public.portal_aprovar_prova(repeat('a',64),'f9400000-0000-4000-8000-000000000003',gen_random_uuid())$$,'42501',null,'projeto cruzado não aprova');
select throws_ok($$select public.portal_aprovar_prova(repeat('a',64),'f9400000-0000-4000-8000-000000000001',gen_random_uuid())$$,'42501',null,'versão superada não aprova');
select throws_ok($$select public.portal_aprovar_prova(repeat('c',64),'f9400000-0000-4000-8000-000000000005',gen_random_uuid())$$,'42501',null,'prova vazia não aprova');
select throws_ok($$select public.portal_aprovar_prova(repeat('a',64),'f9400000-0000-4000-8000-000000000002',null)$$,'22023',null,'chave obrigatória');
select is(public.portal_aprovar_prova(repeat('a',64),'f9400000-0000-4000-8000-000000000002','f9500000-0000-4000-8000-000000000001')->>'status','aprovado','aprova sem extras pelo fluxo existente');
select is(public.portal_aprovar_prova(repeat('a',64),'f9400000-0000-4000-8000-000000000002','f9500000-0000-4000-8000-000000000001')->>'status','aprovado','retry permanece idempotente depois do fechamento');
select throws_ok($$select public.portal_aprovar_prova(repeat('a',64),'f9400000-0000-4000-8000-000000000001','f9500000-0000-4000-8000-000000000001')$$,'22023',null,'chave não pode ser reaproveitada em outra versão');
select throws_ok($$select public.portal_aprovar_prova(repeat('a',64),'f9400000-0000-4000-8000-000000000002',gen_random_uuid())$$,'42501',null,'outra chave não duplica decisão fechada');
select is(public.portal_prova(repeat('a',64))->>'aberta','false','prova fecha após aprovação');
select ok(public.portal_prova(repeat('a',64))->'aprovacao'->>'data' is not null,'resumo informa data real da decisão');
select is(public.portal_prova(repeat('a',64))->'aprovacao'->>'aguardaFechamento','false','sem extras não há fechamento pendente');
select is(public.portal_aprovar_prova(repeat('b',64),'f9400000-0000-4000-8000-000000000004','f9500000-0000-4000-8000-000000000002')->>'status','aprovado_aguardando_pagamento','excedentes mantêm gate financeiro');
select is(public.portal_prova(repeat('b',64))->'aprovacao'->>'aguardaFechamento','true','cliente vê fechamento pendente sem dados financeiros internos');
select throws_ok('select * from public.portal_prova_aprovacoes','42501',null,'sem leitura anônima direta da trilha');
select throws_ok($$select private.portal_prova_base(repeat('a',64))$$,'42501',null,'leitura base não fica exposta por outro nome');
reset role;
select is((select count(*)::integer from public.portal_prova_aprovacoes),2,'uma trilha por decisão');
select is((select count(*)::integer from public.aprovacoes where projeto_id='f9300000-0000-4000-8000-000000000001'),1,'retry não duplica aprovação');
select ok((select usuario_id is null from public.aprovacoes where projeto_id='f9300000-0000-4000-8000-000000000001'),'nenhuma identidade Auth fictícia');
select is((select count(*)::integer from public.faturas where projeto_id='f9300000-0000-4000-8000-000000000001'),0,'sem extras não inventa cobrança');
select is((select valor_total from public.faturas where projeto_id='f9300000-0000-4000-8000-000000000003'),12::numeric,'preço do excedente vem do banco');
select is((select count(*)::integer from public.fatura_itens i join public.faturas f on f.id=i.fatura_id where f.projeto_id='f9300000-0000-4000-8000-000000000003' and i.tipo='laminas_extras'),1,'excedente integra fechamento existente');
select throws_ok($$update public.portal_prova_aprovacoes set chave=gen_random_uuid()$$,'42501',null,'trilha imutável');
select set_config('request.jwt.claims','{"sub":"f9100000-0000-4000-8000-000000000001","role":"authenticated"}',true); set local role authenticated;
select public.gerir_portal('f9300000-0000-4000-8000-000000000001',null,null,true);
reset role; set local role anon;
select throws_ok($$select public.portal_aprovar_prova(repeat('a',64),'f9400000-0000-4000-8000-000000000002','f9500000-0000-4000-8000-000000000001')$$,'42501',null,'revogação nega inclusive retry de aprovação');
reset role;
select * from finish();
rollback;
