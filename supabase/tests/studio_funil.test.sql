begin; create extension if not exists pgtap with schema extensions; select plan(71);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f3000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f3-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f3000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f3-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f3000000-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f3-c@example.invalid','{"role":"designer"}','{}',now(),now()),
('f3000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f3-d@example.invalid','{"role":"designer"}','{}',now(),now()),
('f3000000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f3-e@example.invalid','{"role":"cliente"}','{}',now(),now()),
('f3000000-0000-4000-8000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f3-f@example.invalid','{"role":"designer"}','{}',now(),now());
reset role;select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
do $$ begin
  perform public.criar_galeria_digital('f3100000-0000-4000-8000-000000000001','Galeria Um','Cliente Um','um@example.invalid');
  perform public.criar_galeria_digital('f3100000-0000-4000-8000-000000000002','Galeria Dois','Cliente Dois','dois@example.invalid');
end $$;
select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'st-f3-c@example.invalid','editor');
select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'st-f3-d@example.invalid','visualizador');
reset role;select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.criar_galeria_digital('f3100000-0000-4000-8000-000000000003','Galeria B','Cliente B','b@example.invalid'); end $$;
reset role;
insert into public.orcamentos(fotografo_id,cliente_final_nome) values('f3000000-0000-4000-8000-00000000000b','Orcamento Alheio');
select set_config('t.orgA',(select id::text from public.organizacoes where dono_id='f3000000-0000-4000-8000-00000000000a'),true),
       set_config('t.orgB',(select id::text from public.organizacoes where dono_id='f3000000-0000-4000-8000-00000000000b'),true),
       set_config('t.cli1',(select cliente_id::text from public.projetos where id='f3100000-0000-4000-8000-000000000001'),true),
       set_config('t.cli2',(select cliente_id::text from public.projetos where id='f3100000-0000-4000-8000-000000000002'),true),
       set_config('t.cliB',(select cliente_id::text from public.projetos where id='f3100000-0000-4000-8000-000000000003'),true),
       set_config('t.orcB',(select id::text from public.orcamentos where fotografo_id='f3000000-0000-4000-8000-00000000000b'),true),
       set_config('t.status1',(select status::text from public.projetos where id='f3100000-0000-4000-8000-000000000001'),true);

-- Criação: reaproveita o cadastro de clientes (sem segundo cadastro)
reset role;select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select ok(set_config('t.n1',public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0001','Casamento Lead','Lead Novo','lead@example.invalid','11999990000','instagram',4500.50)::text,true) is not null,'dono cria negócio com cliente novo');
select is((select count(*)::integer from public.clientes where fotografo_id=auth.uid() and nome='Lead Novo'),1,'cliente nasce no cadastro existente');
select is((select count(*)::integer from public.studio_negocio_historico where negocio_id=current_setting('t.n1')::uuid and de_etapa is null and para_etapa='lead'),1,'histórico registra a entrada no funil');
select is(public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0001','Casamento Lead','Lead Novo','lead@example.invalid','11999990000','instagram',4500.50),current_setting('t.n1')::uuid,'retry com a mesma chave devolve o mesmo negócio');
select is((select count(*)::integer from public.studio_negocios where organizacao_id=current_setting('t.orgA')::uuid),1,'retry não duplica negócio');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0002','Outro','Lead Novo','LEAD@example.invalid',null,'site',10)$$,'22023','Este cliente já tem um negócio em andamento.','mesmo e-mail reaproveita o cliente e barra negócio duplicado');
select is((select count(*)::integer from public.clientes where fotografo_id=auth.uid() and lower(email)='lead@example.invalid'),1,'e-mail repetido não cria segundo cliente');
select ok(set_config('t.n2',public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0003','Ensaio Cliente Um',null,null,null,'indicacao',1200,current_setting('t.cli1')::uuid)::text,true) is not null,'negócio sobre cliente já existente');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0004','X Y','Nome','n@example.invalid',null,'invalida',1)$$,'22023',null,'origem inválida rejeitada');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgA')::uuid,'curta','X Y','Nome','n@example.invalid',null,'site',1)$$,'22023',null,'chave curta rejeitada');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0005','X Y','Nome','n@example.invalid',null,'site',-5)$$,'22023',null,'valor negativo rejeitado');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0006','X Y',null,null,null,'site',1,current_setting('t.cliB')::uuid)$$,'22023',null,'cliente de outro estúdio não é vinculável');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0007','X Y','Nome',null,null,'site',1,null,'f3000000-0000-4000-8000-00000000000f')$$,'22023','O responsável precisa ser membro ativo da equipe.','responsável fora da equipe rejeitado');

-- Vínculo cliente↔projeto sem duplicar cadastro nem tocar produção
select is(public.vincular_projeto_negocio_studio(current_setting('t.n2')::uuid,'f3100000-0000-4000-8000-000000000001'),true,'projeto do mesmo cliente vincula');
select throws_ok($$select public.vincular_projeto_negocio_studio(current_setting('t.n2')::uuid,'f3100000-0000-4000-8000-000000000002')$$,'22023',null,'projeto de outro cliente não vincula');
select throws_ok($$select public.vincular_projeto_negocio_studio(current_setting('t.n2')::uuid,'f3100000-0000-4000-8000-000000000003')$$,'22023',null,'projeto de outro estúdio não vincula');

-- Etapas: comando idempotente + histórico
select is(public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'contato','chave-etp-0001'),true,'lead → contato muda');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'contato','chave-etp-0001'),false,'retry com a mesma chave não muda de novo');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'contato','chave-etp-0002'),false,'mesma etapa com chave nova é no-op');
select is((select count(*)::integer from public.studio_negocio_historico where negocio_id=current_setting('t.n2')::uuid),2,'histórico tem exatamente criação e uma mudança');
select is((select de_etapa||'>'||para_etapa from public.studio_negocio_historico where negocio_id=current_setting('t.n2')::uuid and chave_idem='chave-etp-0001'),'lead>contato','histórico guarda de→para');
select is((select ator_id from public.studio_negocio_historico where negocio_id=current_setting('t.n2')::uuid and chave_idem='chave-etp-0001'),auth.uid(),'histórico guarda o ator');
select throws_ok($$select public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'perdido','chave-etp-0003')$$,'22023','Informe o motivo da perda.','perdido exige motivo');
select throws_ok($$select public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'perdido','chave-etp-0003','porque sim')$$,'22023',null,'motivo fora do catálogo rejeitado');
select throws_ok($$select public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'inexistente','chave-etp-0004')$$,'22023',null,'etapa inválida rejeitada');
select throws_ok($$select public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'proposta','curta')$$,'22023',null,'chave curta rejeitada na etapa');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'proposta','chave-etp-0005'),true,'contato → proposta muda');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'perdido','chave-etp-0006','preco','achou caro'),true,'proposta → perdido com motivo');
select is((select motivo_perda from public.studio_negocios where id=current_setting('t.n2')::uuid),'preco','motivo da perda gravado');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'contato','chave-etp-0007'),true,'negócio perdido pode ser reaberto');
select is((select motivo_perda from public.studio_negocios where id=current_setting('t.n2')::uuid),null,'reabrir limpa o motivo');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'fechado','chave-etp-0008'),true,'contato → fechado');
select ok((select fechado_em is not null from public.studio_negocios where id=current_setting('t.n2')::uuid),'fechado registra a data');
select is((select status::text from public.projetos where id='f3100000-0000-4000-8000-000000000001'),current_setting('t.status1'),'etapa comercial não altera o status de produção do projeto');
select throws_ok($$update public.studio_negocios set etapa='perdido' where id=current_setting('t.n2')::uuid$$,'42501',null,'sem UPDATE direto: perdido sem motivo nem passa');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n1')::uuid,'contato','chave-etp-0009'),true,'segundo negócio avança');
select ok(set_config('t.n3',public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0003b','Segundo Ensaio',null,null,null,'site',800,current_setting('t.cli1')::uuid)::text,true) is not null,'cliente com negócio fechado ganha novo negócio');
select throws_ok($$select public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'lead','chave-etp-0010')$$,'22023','Este cliente já tem outro negócio em andamento.','reabrir não duplica negócio ativo do mesmo cliente');

-- Dados do negócio
select is(public.atualizar_negocio_studio(current_setting('t.n1')::uuid,'Casamento Lead 2',9000,'indicacao',auth.uid()),true,'atualiza valor, origem e título');
select is((select valor_estimado from public.studio_negocios where id=current_setting('t.n1')::uuid),9000.00,'valor estimado gravado');
select throws_ok($$select public.atualizar_negocio_studio(current_setting('t.n1')::uuid,'Casamento Lead 2',9000,'indicacao','f3000000-0000-4000-8000-00000000000f')$$,'22023','O responsável precisa ser membro ativo da equipe.','responsável precisa ser membro ativo');
select throws_ok($$select public.atualizar_negocio_studio(current_setting('t.n1')::uuid,'Casamento Lead 2',9000,'indicacao',auth.uid(),current_setting('t.orcB')::uuid)$$,'22023',null,'orçamento de outro estúdio rejeitado');

-- Listagem do funil
select is((select count(*)::integer from public.listar_funil_studio(current_setting('t.orgA')::uuid)),3,'funil lista os negócios');
select is((select cliente_nome from public.listar_funil_studio(current_setting('t.orgA')::uuid) where id=current_setting('t.n1')::uuid),'Lead Novo','funil traz o cliente do cadastro existente');

-- Papéis: editor escreve, visualizador só lê
reset role;select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select is(public.mudar_etapa_negocio_studio(current_setting('t.n1')::uuid,'proposta','chave-etp-0011'),true,'editor muda etapa');
select is(public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0008','Retrato Editor','Cliente Editor','ed@example.invalid',null,'site',300) is not null,true,'editor cria negócio');
reset role;select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.listar_funil_studio(current_setting('t.orgA')::uuid)),4,'visualizador lê o funil');
select throws_ok($$select public.mudar_etapa_negocio_studio(current_setting('t.n1')::uuid,'contato','chave-etp-0012')$$,'42501',null,'visualizador não muda etapa');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0009','X Y','Nome',null,null,'site',1)$$,'42501',null,'visualizador não cria negócio');
select throws_ok($$select public.atualizar_negocio_studio(current_setting('t.n1')::uuid,'Titulo',1,'site',auth.uid())$$,'42501',null,'visualizador não atualiza negócio');
select throws_ok($$select public.vincular_projeto_negocio_studio(current_setting('t.n1')::uuid,null)$$,'42501',null,'visualizador não vincula projeto');
select throws_ok($$insert into public.studio_negocios(organizacao_id,cliente_id,titulo) values (current_setting('t.orgA')::uuid,current_setting('t.cli2')::uuid,'Direto')$$,'42501',null,'sem INSERT direto');
select throws_ok($$delete from public.studio_negocios$$,'42501',null,'sem DELETE direto');

-- Histórico imutável
reset role;select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$update public.studio_negocio_historico set para_etapa='lead'$$,'42501',null,'dono não altera histórico');
select throws_ok($$delete from public.studio_negocio_historico$$,'42501',null,'dono não apaga histórico');
reset role;
select throws_ok($$update public.studio_negocio_historico set para_etapa='lead'$$,'42501','Histórico é imutável.','trigger barra UPDATE até para superusuário');
select throws_ok($$delete from public.studio_negocio_historico$$,'42501','Histórico é imutável.','trigger barra DELETE direto');
select throws_ok($$truncate public.studio_negocio_historico$$,'42501','Histórico é imutável.','trigger barra TRUNCATE');

-- Isolamento entre organizações
reset role;select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.studio_negocios),0,'outro estúdio não enxerga negócios');
select is((select count(*)::integer from public.studio_negocio_historico),0,'outro estúdio não enxerga histórico');
select throws_ok($$select * from public.listar_funil_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'outro estúdio não lista o funil alheio');
select throws_ok($$select public.mudar_etapa_negocio_studio(current_setting('t.n1')::uuid,'contato','chave-etp-0013')$$,'42501',null,'outro estúdio não muda etapa alheia');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0010','X Y','Nome',null,null,'site',1)$$,'42501',null,'outro estúdio não cria negócio na organização alheia');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgB')::uuid,'chave-neg-0011','X Y',null,null,null,'site',1,current_setting('t.cli1')::uuid)$$,'22023',null,'não vincula cliente de outro estúdio à própria organização');
select throws_ok($$select public.vincular_projeto_negocio_studio(current_setting('t.n1')::uuid,null)$$,'42501',null,'outro estúdio não vincula projeto');

-- Cliente final e anônimo
reset role;select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.studio_negocios),0,'cliente final não lê negócios');
select throws_ok($$select public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0012','X Y','Nome',null,null,'site',1)$$,'42501',null,'cliente final não é membro: não cria negócio');
reset role; set local role anon;
select throws_ok($$select public.criar_negocio_studio(gen_random_uuid(),'chave-neg-0013','X Y','Nome',null,null,'site',1)$$,'42501',null,'anon não cria negócio');
select throws_ok($$select * from public.listar_funil_studio(gen_random_uuid())$$,'42501',null,'anon não lista o funil');

-- Exclusão de cliente leva negócio e histórico juntos (cascata passa pelo trigger)
reset role;
delete from public.clientes where id=current_setting('t.cli2')::uuid;
select is((select count(*)::integer from public.studio_negocios where cliente_id=current_setting('t.cli2')::uuid),0,'sem negócio para cliente excluído');
delete from public.clientes where id=current_setting('t.cli1')::uuid;
select is((select count(*)::integer from public.studio_negocio_historico where negocio_id=current_setting('t.n2')::uuid),0,'cascata remove o histórico do negócio (trigger permite ação referencial)');
select finish(); rollback;
