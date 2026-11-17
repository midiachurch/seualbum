begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('c1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portal-1@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('c1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portal-2@example.invalid','{"role":"fotografo"}','{}',now(),now());
insert into public.clientes(id,fotografo_id,nome,email) values
('c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Cliente portal sintético','portal-c1@example.invalid'),
('c3000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','Outro sintético','portal-c2@example.invalid');
insert into public.projetos(id,nome,cliente_id,fotografo_id,status) values
('c2000000-0000-4000-8000-000000000001','Galeria privada','c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','em_diagramacao'),
('c2000000-0000-4000-8000-000000000002','Outra galeria','c3000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','em_diagramacao');
insert into public.fotos(id,projeto_id,storage_path,nome_original,bucket) values
('c4000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','projetos/c2000000-0000-4000-8000-000000000001/fotos/original.jpg','casamento.jpg','r2'),
('c4000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000002','projetos/c2000000-0000-4000-8000-000000000002/fotos/original.jpg','outro.jpg','r2');
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}',true); set local role authenticated;
select throws_ok($$select public.gerir_portal('c2000000-0000-4000-8000-000000000002',repeat('a',64),'12345678')$$,'42501',null,'outro fotógrafo não gere portal');
select throws_ok($$select public.gerir_portal('c2000000-0000-4000-8000-000000000001',repeat('a',64),'123')$$,'22023',null,'código curto rejeitado');
select lives_ok($$select public.gerir_portal('c2000000-0000-4000-8000-000000000001',repeat('a',64),'12345678')$$,'dono gera acesso');
select throws_ok('select * from public.portal_acessos','42501',null,'hashes não legíveis diretamente');
reset role; set local role anon;
select throws_ok($$select public.gerir_portal('c2000000-0000-4000-8000-000000000001',repeat('b',64),'12345678')$$,'42501',null,'anon não gere portal');
select is(public.abrir_portal(repeat('a',64),'errado',repeat('b',64)),false,'código incorreto negado sem exceção');
reset role;
select is((select tentativas from public.portal_acessos where link_hash=repeat('a',64)),1,'tentativa incorreta persistida');
set local role anon;
select is(public.abrir_portal(repeat('a',64),'12345678',repeat('b',64)),true,'código correto cria sessão sem Auth');
select is(public.portal_projeto(repeat('b',64))->>'nome','Galeria privada','sessão lê somente galeria concedida');
select is(jsonb_array_length(public.portal_projeto(repeat('b',64))->'fotos'),1,'fotos limitadas ao projeto');
select ok(not ((public.portal_projeto(repeat('b',64))->'fotos'->0) ? 'storage_path'),'listagem não expõe chave de objeto');
select throws_ok($$select public.portal_projeto(repeat('c',64))$$,'42501',null,'sessão inventada negada');
select throws_ok($$select public.portal_foto(repeat('b',64),'c4000000-0000-4000-8000-000000000002')$$,'42501',null,'troca de foto para outro projeto negada');
select is(public.portal_foto(repeat('b',64),'c4000000-0000-4000-8000-000000000001')->>'nome','casamento.jpg','foto autorizada preserva nome');
select is(public.portal_favorito(repeat('b',64),'c4000000-0000-4000-8000-000000000001',true),true,'favorito por capacidade');
select is(public.portal_favorito(repeat('b',64),'c4000000-0000-4000-8000-000000000001',true),true,'favorito retry idempotente');
select throws_ok($$select public.portal_favorito(repeat('b',64),'c4000000-0000-4000-8000-000000000002',false)$$,'42501',null,'favorito cruzado negado');
select is(public.portal_entregar(repeat('b',64),array['c4000000-0000-4000-8000-000000000001'::uuid],0,'c5000000-0000-4000-8000-000000000001')->>'revisao','1','portal entrega snapshot revisão1');
select is(public.portal_entregar(repeat('b',64),array['c4000000-0000-4000-8000-000000000001'::uuid],0,'c5000000-0000-4000-8000-000000000001')->>'revisao','1','retry entrega retorna mesma revisão');
select is(public.portal_favorito(repeat('b',64),'c4000000-0000-4000-8000-000000000001',false),true,'rascunho posterior não altera entrega');
select is(public.portal_entregar(repeat('b',64),array['c4000000-0000-4000-8000-000000000001'::uuid],0,'c5000000-0000-4000-8000-000000000001')->>'revisao','1','retry dos IDs confirmados independe do rascunho posterior');
select throws_ok($$select public.portal_entregar(repeat('b',64),array['c4000000-0000-4000-8000-000000000002'::uuid],1,gen_random_uuid())$$,'42501',null,'entrega não pode incluir foto de outro projeto');
select is(jsonb_array_length(public.portal_projeto(repeat('b',64))->'eventos'),2,'timeline deduplica entrega e não expõe notas internas');
select is((select count(*)::integer from public.fotos where id in ('c4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002')),0,'RLS nega leitura anon direta de fotos privadas');
select throws_ok($$select private.entregar_selecao_core('c2000000-0000-4000-8000-000000000001',null,gen_random_uuid(),array['c4000000-0000-4000-8000-000000000001'::uuid],1,gen_random_uuid())$$,'42501',null,'anon não chama core');
reset role;
select is((select count(*)::integer from public.selecao_notificacoes where destinatario_id='c1000000-0000-4000-8000-000000000001'),1,'notificação interna única ao fotógrafo');
select is((select count(*)::integer from public.projeto_atividades where projeto_id='c2000000-0000-4000-8000-000000000001' and mensagem like 'Favorito manual pelo portal%'),2,'evento de favorito só na mudança');
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
select lives_ok($$select public.gerir_portal('c2000000-0000-4000-8000-000000000001',repeat('d',64),'87654321')$$,'renovar acesso revoga anterior');
reset role;set local role anon;
select throws_ok($$select public.portal_projeto(repeat('b',64))$$,'42501',null,'sessão anterior negada após rotação');
select is(public.abrir_portal(repeat('a',64),'12345678',repeat('e',64)),false,'link antigo não abre nova sessão');
select is(public.abrir_portal(repeat('d',64),'87654321',repeat('e',64)),true,'novo acesso funciona');
reset role;
update public.portal_sessoes set expira_em=now()-interval '1 second' where hash=repeat('e',64);
set local role anon;
select throws_ok($$select public.portal_projeto(repeat('e',64))$$,'42501',null,'sessão expirada negada');
-- Dez erros acumulam bloqueio; um código correto não contorna a janela.
select public.abrir_portal(repeat('d',64),'00000000',repeat('f',64)) from generate_series(1,10);
select is(public.abrir_portal(repeat('d',64),'87654321',repeat('f',64)),false,'limite atômico bloqueia login correto até expirar janela');
reset role;
select is((select tentativas from public.portal_acessos where link_hash=repeat('d',64)),10,'dez falhas preservadas');
update public.portal_acessos set bloqueado_ate=null,tentativas=0 where link_hash=repeat('d',64);
set local role anon;
select is(public.abrir_portal(repeat('d',64),'87654321',repeat('f',64)),true,'sessão nova após janela de bloqueio');
reset role;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
select lives_ok($$select public.gerir_portal('c2000000-0000-4000-8000-000000000001',null,null,true)$$,'dono revoga explicitamente');
reset role;set local role anon;
select throws_ok($$select public.portal_favorito(repeat('f',64),'c4000000-0000-4000-8000-000000000001',false)$$,'42501',null,'revogação bloqueia nova escrita');
select throws_ok($$select public.portal_foto(repeat('f',64),'c4000000-0000-4000-8000-000000000001')$$,'42501',null,'revogação bloqueia assinatura de imagem');
select throws_ok($$select public.portal_entregar(repeat('f',64),array['c4000000-0000-4000-8000-000000000001'::uuid],1,gen_random_uuid())$$,'42501',null,'revogação bloqueia entrega');
reset role;
select is((select count(*)::integer from public.selecoes_entregues where projeto_id='c2000000-0000-4000-8000-000000000001'),1,'tentativas revogadas não alteram snapshot');
select finish(); rollback;
