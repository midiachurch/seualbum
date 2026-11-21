begin; create extension if not exists pgtap with schema extensions; select plan(34);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('c6000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cap-dono@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('c6000000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cap-editor@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('c6000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cap-visual@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('c6000000-0000-4000-8000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cap-fora@example.invalid','{"role":"fotografo"}','{}',now(),now());
select set_config('request.jwt.claims','{"sub":"c6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.criar_galeria_digital('c7000000-0000-4000-8000-000000000001','Galeria Cap','Cliente Cap','cap@example.invalid'); end $$;
do $$ begin perform public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'cap-editor@example.invalid','editor'); end $$;
do $$ begin perform public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'cap-visual@example.invalid','visualizador'); end $$;
reset role;
insert into public.fotos(id,projeto_id,storage_path,bucket,enviado_por,tamanho_bytes) values
('c8000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','projetos/c7000000-0000-4000-8000-000000000001/fotos/base.jpg','r2','c6000000-0000-4000-8000-00000000000a',1000),
('c8000000-0000-4000-8000-000000000002','c7000000-0000-4000-8000-000000000001','projetos/c7000000-0000-4000-8000-000000000001/fotos/outra.jpg','r2','c6000000-0000-4000-8000-00000000000a',1000);
insert into public.r2_uploads_pendentes(r2_key,user_id,expira_em) values
('projetos/c7000000-0000-4000-8000-000000000001/fotos/do-editor.jpg','c6000000-0000-4000-8000-00000000000e',now()+interval '1 hour'),
('projetos/c7000000-0000-4000-8000-000000000001/fotos/x.jpg','c6000000-0000-4000-8000-00000000000b',now()+interval '1 hour'),
('projetos/c7000000-0000-4000-8000-000000000001/fotos/falso.jpg','c6000000-0000-4000-8000-00000000000e',now()+interval '1 hour');

-- Visualizador: lê, não escreve
select set_config('request.jwt.claims','{"sub":"c6000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.projetos where id='c7000000-0000-4000-8000-000000000001'),1,'visualizador lê o projeto da organização');
select is((select count(*)::integer from public.fotos where projeto_id='c7000000-0000-4000-8000-000000000001'),2,'visualizador lê as fotos');
select is((select count(*)::integer from public.projeto_atividades where projeto_id='c7000000-0000-4000-8000-000000000001'),1,'visualizador lê a linha do tempo');
select is((select count(*)::integer from public.clientes),1,'visualizador lê os clientes do estúdio');
select is(public.pode_ver_projeto('c7000000-0000-4000-8000-000000000001'),false,'pode_ver_projeto existente permanece inalterado');
select is(public.pode_ler_projeto_org('c7000000-0000-4000-8000-000000000001'),true,'helper novo concede leitura');
select is(public.pode_editar_projeto_org('c7000000-0000-4000-8000-000000000001'),false,'helper novo nega edição ao visualizador');
select throws_ok($$insert into public.fotos(projeto_id,storage_path,bucket,enviado_por) values ('c7000000-0000-4000-8000-000000000001','projetos/c7000000-0000-4000-8000-000000000001/fotos/x.jpg','r2',auth.uid())$$,'42501',null,'leitura não implica upload');
delete from public.fotos where id='c8000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.fotos where id='c8000000-0000-4000-8000-000000000001'),1,'visualizador não apaga foto');
update public.projetos set nome='Hack' where id='c7000000-0000-4000-8000-000000000001';
select isnt((select nome from public.projetos where id='c7000000-0000-4000-8000-000000000001'),'Hack','visualizador não altera o projeto');
select throws_ok($$insert into public.projeto_atividades(projeto_id,autor_id,mensagem) values ('c7000000-0000-4000-8000-000000000001',auth.uid(),'x')$$,'42501',null,'visualizador não escreve na linha do tempo');
select throws_ok($$select public.gerir_portal('c7000000-0000-4000-8000-000000000001',repeat('a',64),'codigo-secreto-1')$$,'42501',null,'visualizador não gere o portal');
select throws_ok($$select public.franquia_permite_envio('c7000000-0000-4000-8000-000000000001',10)$$,'42501',null,'visualizador não consulta franquia de envio');
select is((select count(*)::integer from public.faturas),0,'financeiro segue fechado a membros');

-- Editor: produz
reset role;select set_config('request.jwt.claims','{"sub":"c6000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select is(public.pode_editar_projeto_org('c7000000-0000-4000-8000-000000000001'),true,'editor pode editar');
select lives_ok($$insert into public.fotos(projeto_id,storage_path,bucket,enviado_por,tamanho_bytes) values ('c7000000-0000-4000-8000-000000000001','projetos/c7000000-0000-4000-8000-000000000001/fotos/do-editor.jpg','r2',auth.uid(),500)$$,'editor envia foto (com reserva própria)');
select throws_ok($$insert into public.fotos(projeto_id,storage_path,bucket,enviado_por) values ('c7000000-0000-4000-8000-000000000001','projetos/c7000000-0000-4000-8000-000000000001/fotos/falso.jpg','r2','c6000000-0000-4000-8000-00000000000a')$$,'23514',null,'editor não envia em nome de outra pessoa (trava de banco, antes da RLS)');
update public.projetos set nome='Renomeado' where id='c7000000-0000-4000-8000-000000000001';
select is((select nome from public.projetos where id='c7000000-0000-4000-8000-000000000001'),'Renomeado','editor altera o projeto');
delete from public.fotos where id='c8000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.fotos where id='c8000000-0000-4000-8000-000000000002'),0,'editor apaga foto');
select lives_ok($$insert into public.projeto_atividades(projeto_id,autor_id,mensagem) values ('c7000000-0000-4000-8000-000000000001',auth.uid(),'Editor registrou')$$,'editor escreve na linha do tempo');
select is(public.franquia_permite_envio('c7000000-0000-4000-8000-000000000001',10),true,'editor consulta franquia');
select throws_ok($$update public.projetos set organizacao_id=(select id from public.organizacoes where dono_id='c6000000-0000-4000-8000-00000000000f') where id='c7000000-0000-4000-8000-000000000001'$$,'42501',null,'organização do projeto é imutável');
select isnt(public.gerir_portal('c7000000-0000-4000-8000-000000000001',repeat('b',64),'codigo-secreto-2'),null,'editor gere o portal');
reset role;
select is((select fotografo_id from public.portal_acessos where projeto_id='c7000000-0000-4000-8000-000000000001' and revogado_em is null),'c6000000-0000-4000-8000-00000000000a'::uuid,'portal fica ligado ao dono do projeto, não ao editor');
select set_config('request.jwt.claims','{"sub":"c6000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.faturas),0,'editor também não vê financeiro');

-- Fora da organização
reset role;select set_config('request.jwt.claims','{"sub":"c6000000-0000-4000-8000-00000000000f","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.projetos where id='c7000000-0000-4000-8000-000000000001'),0,'outro estúdio não vê o projeto');
select is((select count(*)::integer from public.fotos where projeto_id='c7000000-0000-4000-8000-000000000001'),0,'outro estúdio não vê as fotos');
select is((select count(*)::integer from public.clientes where email='cap@example.invalid'),0,'outro estúdio não vê os clientes');
select throws_ok($$select public.gerir_portal('c7000000-0000-4000-8000-000000000001',repeat('c',64),'codigo-secreto-3')$$,'42501',null,'outro estúdio não gere o portal');
select throws_ok($$insert into public.projetos(nome,cliente_id,fotografo_id,organizacao_id) values ('Cross',(select id from public.clientes limit 1),auth.uid(),(select id from public.organizacoes where dono_id='c6000000-0000-4000-8000-00000000000a'))$$,'42501',null,'projeto não pode apontar para a organização de outro estúdio');

-- Removido perde o acesso
reset role;select set_config('request.jwt.claims','{"sub":"c6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.remover_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'c6000000-0000-4000-8000-00000000000b'); end $$;
reset role;select set_config('request.jwt.claims','{"sub":"c6000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.projetos where id='c7000000-0000-4000-8000-000000000001'),0,'membro removido perde a leitura imediatamente');
select is(public.pode_ler_projeto_org('c7000000-0000-4000-8000-000000000001'),false,'helper nega após remoção');

-- Dono mantém tudo
reset role;select set_config('request.jwt.claims','{"sub":"c6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.fotos where projeto_id='c7000000-0000-4000-8000-000000000001'),2,'dono continua vendo tudo (base + foto do editor)');
reset role; set local role anon;
select throws_ok($$select public.pode_editar_projeto_org('c7000000-0000-4000-8000-000000000001')$$,'42501',null,'anon não usa os helpers');
reset role;
select finish(); rollback;
