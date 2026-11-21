begin; create extension if not exists pgtap with schema extensions; select plan(68);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f4000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f4-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f4000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f4-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f4000000-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f4-c@example.invalid','{"role":"designer"}','{}',now(),now()),
('f4000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f4-d@example.invalid','{"role":"designer"}','{}',now(),now()),
('f4000000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f4-e@example.invalid','{"role":"cliente"}','{}',now(),now()),
('f4000000-0000-4000-8000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f4-f@example.invalid','{"role":"designer"}','{}',now(),now());
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
do $$ begin
  perform public.criar_galeria_digital('f4100000-0000-4000-8000-000000000001','Galeria Um','Cliente Um','um@example.invalid');
end $$;
select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'st-f4-c@example.invalid','editor');
select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'st-f4-d@example.invalid','visualizador');
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.criar_galeria_digital('f4100000-0000-4000-8000-000000000003','Galeria B','Cliente B','b@example.invalid'); end $$;
reset role;
insert into public.orcamentos(fotografo_id,cliente_final_nome) values('f4000000-0000-4000-8000-00000000000b','Orcamento Alheio');
insert into public.orcamentos(fotografo_id,cliente_final_nome) values('f4000000-0000-4000-8000-00000000000a','Orcamento Proprio');
select set_config('t.orgA',(select id::text from public.organizacoes where dono_id='f4000000-0000-4000-8000-00000000000a'),true),
       set_config('t.orgB',(select id::text from public.organizacoes where dono_id='f4000000-0000-4000-8000-00000000000b'),true),
       set_config('t.cli1',(select cliente_id::text from public.projetos where id='f4100000-0000-4000-8000-000000000001'),true),
       set_config('t.cliB',(select cliente_id::text from public.projetos where id='f4100000-0000-4000-8000-000000000003'),true),
       set_config('t.orcB',(select id::text from public.orcamentos where fotografo_id='f4000000-0000-4000-8000-00000000000b'),true),
       set_config('t.orcA',(select id::text from public.orcamentos where fotografo_id='f4000000-0000-4000-8000-00000000000a'),true),
       set_config('t.hoje',(((now() at time zone 'America/Sao_Paulo')::date + time '23:59:59') at time zone 'America/Sao_Paulo')::text,true);

-- Criação, vínculos e idempotência
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select ok(set_config('t.n1',public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0001','Casamento Um',null,null,null,'site',1000,current_setting('t.cli1')::uuid)::text,true) is not null,'negócio de apoio');
select ok(set_config('t.t1',public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0001','Ligar para o cliente','f4000000-0000-4000-8000-00000000000c',now()-interval '3 days','alta',current_setting('t.cli1')::uuid)::text,true) is not null,'dono cria tarefa atrasada para o editor');
select is(public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0001','Ligar para o cliente','f4000000-0000-4000-8000-00000000000c',now()-interval '3 days','alta',current_setting('t.cli1')::uuid),current_setting('t.t1')::uuid,'retry com a mesma chave devolve a mesma tarefa');
select is((select count(*)::integer from public.studio_tarefas),1,'retry não duplica tarefa');
select ok(set_config('t.t2',public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0002','Enviar proposta',null,current_setting('t.hoje')::timestamptz,'media',p_negocio=>current_setting('t.n1')::uuid)::text,true) is not null,'tarefa para hoje; responsável padrão é quem cria');
select is((select cliente_id from public.studio_tarefas where id=current_setting('t.t2')::uuid),current_setting('t.cli1')::uuid,'vínculo com o negócio herda o cliente');
select is((select responsavel_id from public.studio_tarefas where id=current_setting('t.t2')::uuid),auth.uid(),'responsável padrão é o autor');
select ok(set_config('t.t3',public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0003','Revisar contrato',null,now()+interval '10 days','baixa',p_projeto=>'f4100000-0000-4000-8000-000000000001',p_orcamento=>current_setting('t.orcA')::uuid)::text,true) is not null,'tarefa com projeto e orçamento do estúdio');
select ok(set_config('t.t4',public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0004','Pensar em upsell','f4000000-0000-4000-8000-00000000000c',null)::text,true) is not null,'tarefa sem prazo');
select throws_ok($$select public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0005','Tarefa X','f4000000-0000-4000-8000-00000000000f')$$,'22023','O responsável precisa ser membro ativo da equipe.','responsável fora da equipe rejeitado');
select throws_ok($$select public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0006','Tarefa X',null,null,'media',current_setting('t.cliB')::uuid)$$,'22023',null,'cliente de outro estúdio rejeitado');
select throws_ok($$select public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0007','Tarefa X',null,null,'media',null,null,null,current_setting('t.orcB')::uuid)$$,'22023',null,'orçamento de outro estúdio rejeitado');
select throws_ok($$select public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0008','Tarefa X',null,null,'urgentissima')$$,'22023',null,'prioridade inválida rejeitada');
select throws_ok($$select public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0009','X')$$,'22023',null,'título curto rejeitado');
select throws_ok($$select public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'curta','Tarefa X')$$,'22023',null,'chave curta rejeitada');

-- Filtros
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid)),4,'abertas lista as quatro');
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'atrasadas')),1,'atrasadas traz só a vencida');
select is((select titulo from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'atrasadas')),'Ligar para o cliente','atrasada é a tarefa vencida');
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'hoje')),1,'hoje traz só a de hoje');
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'minhas')),2,'minhas do dono');
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'responsavel','f4000000-0000-4000-8000-00000000000c')),2,'por responsável');
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'abertas',null,current_setting('t.cli1')::uuid)),2,'por cliente');
select throws_ok($$select * from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'responsavel')$$,'22023',null,'filtro por responsável exige o responsável');
select throws_ok($$select * from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'qualquer')$$,'22023',null,'filtro inválido rejeitado');
select is((select responsavel_nome is not null and prazo is not null from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'atrasadas')),true,'responsável e prazo visíveis');

-- Próxima ação por cliente (derivada das tarefas abertas)
select is((select proxima_acao_titulo from public.listar_funil_studio(current_setting('t.orgA')::uuid) where id=current_setting('t.n1')::uuid),'Ligar para o cliente','próxima ação é a tarefa aberta mais antiga do cliente');
select is((select tarefas_abertas||'/'||tarefas_atrasadas from public.listar_funil_studio(current_setting('t.orgA')::uuid) where id=current_setting('t.n1')::uuid),'2/1','funil conta abertas e atrasadas do cliente');

-- Editor: só mexe no que é seu
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'minhas')),2,'editor vê as próprias tarefas');
select is((select pode_editar from public.listar_tarefas_studio(current_setting('t.orgA')::uuid) where id=current_setting('t.t1')::uuid),true,'tarefa do editor: pode editar');
select is((select pode_editar from public.listar_tarefas_studio(current_setting('t.orgA')::uuid) where id=current_setting('t.t2')::uuid),false,'tarefa de outro: não pode editar');
select throws_ok($$select public.mudar_status_tarefa_studio(current_setting('t.t2')::uuid,'concluida')$$,'42501',null,'editor não conclui tarefa alheia');
select throws_ok($$select public.atualizar_tarefa_studio(current_setting('t.t2')::uuid,'Título novo',auth.uid(),null,'alta')$$,'42501',null,'editor não altera tarefa alheia');
select is(public.atualizar_tarefa_studio(current_setting('t.t1')::uuid,'Ligar hoje',auth.uid(),now()+interval '1 day','media','detalhe'),true,'editor altera a própria tarefa');
select is(public.mudar_status_tarefa_studio(current_setting('t.t1')::uuid,'concluida'),true,'editor conclui a própria tarefa');
select is(public.mudar_status_tarefa_studio(current_setting('t.t1')::uuid,'concluida'),false,'concluir de novo é inofensivo');
select ok((select concluida_em is not null and concluida_por=auth.uid() from public.studio_tarefas where id=current_setting('t.t1')::uuid),'conclusão registra quando e quem');
select throws_ok($$select public.atualizar_tarefa_studio(current_setting('t.t1')::uuid,'Outro título',auth.uid(),null,'alta')$$,'22023','Tarefa já encerrada.','tarefa concluída não é editada');
select is(public.mudar_status_tarefa_studio(current_setting('t.t1')::uuid,'aberta'),true,'editor reabre a própria tarefa');
select is((select concluida_em from public.studio_tarefas where id=current_setting('t.t1')::uuid),null,'reabrir limpa a conclusão');
select is(public.mudar_status_tarefa_studio(current_setting('t.t1')::uuid,'concluida'),true,'concluída de novo');
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'concluidas')),1,'filtro de concluídas');
select throws_ok($$select public.mudar_status_tarefa_studio(current_setting('t.t4')::uuid,'inexistente')$$,'22023',null,'status inválido rejeitado');

-- Próxima ação muda quando a tarefa conclui
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is((select proxima_acao_titulo from public.listar_funil_studio(current_setting('t.orgA')::uuid) where id=current_setting('t.n1')::uuid),'Enviar proposta','concluir tarefa avança a próxima ação');
select is(public.atualizar_tarefa_studio(current_setting('t.t4')::uuid,'Pensar em upsell','f4000000-0000-4000-8000-00000000000a',null,'baixa'),true,'dono altera e reatribui tarefa do editor');
select is(public.mudar_status_tarefa_studio(current_setting('t.t3')::uuid,'cancelada'),true,'dono cancela tarefa');
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid)),2,'canceladas e concluídas saem das abertas');

-- Visualizador: só lê
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.listar_tarefas_studio(current_setting('t.orgA')::uuid,'todas')),4,'visualizador lê todas');
select throws_ok($$select public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0010','Tarefa X')$$,'42501',null,'visualizador não cria');
select throws_ok($$select public.mudar_status_tarefa_studio(current_setting('t.t2')::uuid,'concluida')$$,'42501',null,'visualizador não conclui');
select throws_ok($$select public.atualizar_tarefa_studio(current_setting('t.t2')::uuid,'Título novo','f4000000-0000-4000-8000-00000000000a',null,'alta')$$,'42501',null,'visualizador não altera');
select throws_ok($$update public.studio_tarefas set status='concluida'$$,'42501',null,'sem UPDATE direto');
select throws_ok($$insert into public.studio_tarefas(organizacao_id,titulo) values (current_setting('t.orgA')::uuid,'Direto')$$,'42501',null,'sem INSERT direto');
select throws_ok($$delete from public.studio_tarefas$$,'42501',null,'sem DELETE direto');

-- Responsável precisa ser membro ativo (trigger, inclusive fora das RPCs)
reset role;
select throws_ok($$insert into public.studio_tarefas(organizacao_id,titulo,responsavel_id) values (current_setting('t.orgA')::uuid,'Direta','f4000000-0000-4000-8000-00000000000f')$$,'22023','O responsável precisa ser membro ativo da equipe.','trigger exige responsável membro ativo');
select throws_ok($$insert into public.studio_tarefas(organizacao_id,titulo,cliente_id) values (current_setting('t.orgA')::uuid,'Direta',current_setting('t.cliB')::uuid)$$,'22023',null,'trigger barra cliente de outro estúdio');
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.remover_membro_organizacao(current_setting('t.orgA')::uuid,'f4000000-0000-4000-8000-00000000000c'),true,'dono remove o editor');
select throws_ok($$select public.atualizar_tarefa_studio(current_setting('t.t4')::uuid,'Pensar em upsell','f4000000-0000-4000-8000-00000000000c',null,'baixa')$$,'22023','O responsável precisa ser membro ativo da equipe.','não se atribui a membro removido');
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select * from public.listar_tarefas_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'membro removido perde a leitura');
select throws_ok($$select public.mudar_status_tarefa_studio(current_setting('t.t4')::uuid,'concluida')$$,'42501',null,'membro removido não altera tarefas');

-- Isolamento
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.studio_tarefas),0,'outro estúdio não enxerga tarefas');
select throws_ok($$select * from public.listar_tarefas_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'outro estúdio não lista tarefas alheias');
select throws_ok($$select public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0011','Tarefa X')$$,'42501',null,'outro estúdio não cria na organização alheia');
select throws_ok($$select public.mudar_status_tarefa_studio(current_setting('t.t2')::uuid,'concluida')$$,'42501',null,'outro estúdio não conclui tarefa alheia');
select throws_ok($$select public.atualizar_tarefa_studio(current_setting('t.t2')::uuid,'Título','f4000000-0000-4000-8000-00000000000b',null,'alta')$$,'42501',null,'outro estúdio não altera tarefa alheia');
reset role;select set_config('request.jwt.claims','{"sub":"f4000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select * from public.listar_tarefas_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'cliente final não é membro: não lista tarefas');
select throws_ok($$select public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0012','Tarefa X')$$,'42501',null,'cliente final não cria tarefas');
reset role; set local role anon;
select throws_ok($$select public.criar_tarefa_studio(gen_random_uuid(),'chave-tar-0013','Tarefa X')$$,'42501',null,'anon não cria tarefas');
select throws_ok($$select * from public.listar_tarefas_studio(gen_random_uuid())$$,'42501',null,'anon não lista tarefas');
select finish(); rollback;
