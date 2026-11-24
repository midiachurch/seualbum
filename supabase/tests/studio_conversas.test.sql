begin; create extension if not exists pgtap with schema extensions; select plan(49);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f5000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f5-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f5000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f5-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f5000000-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f5-c@example.invalid','{"role":"designer"}','{}',now(),now()),
('f5000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f5-d@example.invalid','{"role":"designer"}','{}',now(),now()),
('f5000000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f5-e@example.invalid','{"role":"cliente"}','{}',now(),now()),
('f5000000-0000-4000-8000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f5-f@example.invalid','{"role":"designer"}','{}',now(),now());
reset role;select set_config('request.jwt.claims','{"sub":"f5000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
do $$ begin
  perform public.criar_galeria_digital('f5100000-0000-4000-8000-000000000001','Galeria Um','Cliente Um','um@example.invalid');
end $$;
select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'st-f5-c@example.invalid','editor');
select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'st-f5-d@example.invalid','visualizador');
reset role;select set_config('request.jwt.claims','{"sub":"f5000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.criar_galeria_digital('f5100000-0000-4000-8000-000000000003','Galeria B','Cliente B','b@example.invalid'); end $$;
reset role;
insert into public.orcamentos(fotografo_id,cliente_final_nome,valor_total) values('f5000000-0000-4000-8000-00000000000a','Orcamento Proprio',3200);
insert into public.conversas(id,canal,fotografo_id,projeto_id) values
  ('f5200000-0000-4000-8000-000000000001','cliente_estudio','f5000000-0000-4000-8000-00000000000a','f5100000-0000-4000-8000-000000000001'),
  ('f5200000-0000-4000-8000-000000000002','estudio_equipe','f5000000-0000-4000-8000-00000000000a','f5100000-0000-4000-8000-000000000001');
insert into public.mensagens(conversa_id,autor_nome,autor_papel,tipo,corpo) values
  ('f5200000-0000-4000-8000-000000000001','Cliente Um','cliente','texto','Oi, gostei da proposta'),
  ('f5200000-0000-4000-8000-000000000001','Estudio','fotografo','texto','Que bom, vamos fechar?'),
  ('f5200000-0000-4000-8000-000000000001','Sistema','sistema','sistema','Prova publicada'),
  ('f5200000-0000-4000-8000-000000000002','Equipe','equipe','texto','segredo interno da equipe');
insert into public.mensagens(conversa_id,autor_nome,autor_papel,tipo,corpo,apagada_em) values
  ('f5200000-0000-4000-8000-000000000001','Cliente Um','cliente','texto','',clock_timestamp());
select set_config('t.orgA',(select id::text from public.organizacoes where dono_id='f5000000-0000-4000-8000-00000000000a'),true),
       set_config('t.orgB',(select id::text from public.organizacoes where dono_id='f5000000-0000-4000-8000-00000000000b'),true),
       set_config('t.nomeA',(select nome from public.organizacoes where dono_id='f5000000-0000-4000-8000-00000000000a'),true),
       set_config('t.cli1',(select cliente_id::text from public.projetos where id='f5100000-0000-4000-8000-000000000001'),true),
       set_config('t.cliB',(select cliente_id::text from public.projetos where id='f5100000-0000-4000-8000-000000000003'),true),
       set_config('t.orcA',(select id::text from public.orcamentos where fotografo_id='f5000000-0000-4000-8000-00000000000a'),true);

-- Modelos de mensagem
reset role;select set_config('request.jwt.claims','{"sub":"f5000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select ok(set_config('t.m1',public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Proposta enviada','livre','email','Olá {{cliente_primeiro_nome}}','Proposta {{titulo_negocio}} de {{valor}} — {{ estudio }}')::text,true) is not null,'dono salva modelo com variáveis');
select throws_ok($$select public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'proposta ENVIADA','livre','email','a','b')$$,'22023','Já existe um modelo com este nome.','nome duplicado (sem diferenciar caixa) rejeitado');
select throws_ok($$select public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Com segredo','livre','email','a','Olá {{senha_do_banco}}')$$,'22023',null,'variável fora da lista rejeitada');
select throws_ok($$select public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Quebrado','livre','email','a','Olá {{ cliente nome }}')$$,'22023',null,'chaves malformadas rejeitadas');
select throws_ok($$select public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Finalidade ruim','xyz','email','a','b')$$,'22023',null,'finalidade inválida rejeitada');
select is(public.salvar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m1')::uuid,'Proposta enviada','livre','email','Olá {{cliente_primeiro_nome}}','Proposta {{titulo_negocio}} de {{valor}} — {{estudio}}'),current_setting('t.m1')::uuid,'dono edita o modelo');
select ok(set_config('t.m2',public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Nome simples','livre','whatsapp','','Nome: {{cliente_nome}}')::text,true) is not null,'segundo modelo');
select ok(set_config('t.n1',public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0001','Casamento Um',null,null,null,'site',4500.50,current_setting('t.cli1')::uuid)::text,true) is not null,'negócio para a prévia');

-- Prévia: renderiza, não envia
select is((select corpo from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m1')::uuid,null,current_setting('t.n1')::uuid)),'Proposta Casamento Um de R$ 4.500,50 — '||current_setting('t.nomeA'),'prévia preenche título, valor formatado e estúdio');
select is((select assunto from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m1')::uuid,null,current_setting('t.n1')::uuid)),'Olá Cliente','prévia usa o primeiro nome do cliente');
select is((select faltando from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m1')::uuid,null,current_setting('t.n1')::uuid)),'{}'::text[],'nada faltando com negócio informado');
select is((select cardinality(faltando) from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m1')::uuid)),3,'sem contexto, três variáveis ficam em faltando');
select ok(strpos((select corpo from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m1')::uuid)),'[titulo_negocio]')>0,'variável sem dado aparece entre colchetes');
select is((select corpo from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m2')::uuid,current_setting('t.cli1')::uuid)),'Nome: Cliente Um','prévia por cliente');
select is((select count(*)::integer from public.studio_outbox),0,'prévia não enfileira nada');
select throws_ok($$select * from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,gen_random_uuid())$$,'22023',null,'modelo inexistente rejeitado');
select throws_ok($$select * from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m2')::uuid,current_setting('t.cliB')::uuid)$$,'22023',null,'prévia com cliente de outro estúdio rejeitada');

-- Linha do tempo única
select is(public.atualizar_negocio_studio(current_setting('t.n1')::uuid,'Casamento Um',4500.50,'site',auth.uid(),current_setting('t.orcA')::uuid),true,'orçamento vinculado ao negócio');
select is(public.vincular_projeto_negocio_studio(current_setting('t.n1')::uuid,'f5100000-0000-4000-8000-000000000001'),true,'projeto vinculado ao negócio');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n1')::uuid,'proposta','chave-etp-0001'),true,'etapa muda para proposta');
select ok(set_config('t.t1',public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0001','Ligar',null,null,'media',current_setting('t.cli1')::uuid)::text,true) is not null,'tarefa do cliente');
select is(public.mudar_status_tarefa_studio(current_setting('t.t1')::uuid,'concluida'),true,'tarefa concluída');
select ok(set_config('t.o1',public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0001','email',current_setting('t.cli1')::uuid,current_setting('t.m1')::uuid,null,null,current_setting('t.n1')::uuid)::text,true) is not null,'comunicação enfileirada');
select is((public.processar_outbox_studio(current_setting('t.orgA')::uuid)->>'simuladas')::integer,1,'processada só em simulação');
select is((select array_agg(distinct tipo order by tipo) from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid)),array['comunicacao','etapa','mensagem','mensagem_sistema','orcamento','tarefa_concluida'],'linha do tempo reúne mensagens, etapas, tarefas, orçamento e comunicação');
select is((select tipo from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid) limit 1),'comunicacao','mais recente primeiro');
select is((select count(*)::integer from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid) where detalhe like '%segredo interno%'),0,'fio interno da equipe não entra na linha do tempo do cliente');
select is((select count(*)::integer from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid) where detalhe='Mensagem apagada'),1,'mensagem apagada não expõe o conteúdo');
select is((select count(*)::integer from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid) where tipo='mensagem'),3,'mensagens do cliente e do estúdio');
select is((select count(*)::integer from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid,'f5100000-0000-4000-8000-000000000001') where tipo='comunicacao'),0,'filtro por projeto restringe o escopo');
select is((select count(*)::integer from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid,'f5100000-0000-4000-8000-000000000001') where tipo='mensagem'),3,'filtro por projeto mantém as mensagens do projeto');
select is((select count(*)::integer from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid,null,2)),2,'limite respeitado');
select throws_ok($$select * from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid,'f5100000-0000-4000-8000-000000000003')$$,'22023',null,'projeto de outro estúdio rejeitado');
select throws_ok($$select * from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid,null,0)$$,'22023',null,'limite inválido rejeitado');

-- Papéis
reset role;select set_config('request.jwt.claims','{"sub":"f5000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid)),9,'editor lê a linha do tempo');
select throws_ok($$select public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Do editor','livre','email','a','b')$$,'42501',null,'editor não gerencia modelos');
reset role;select set_config('request.jwt.claims','{"sub":"f5000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select is((select corpo from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m2')::uuid,current_setting('t.cli1')::uuid)),'Nome: Cliente Um','visualizador vê a prévia');
select throws_ok($$select public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Do visualizador','livre','email','a','b')$$,'42501',null,'visualizador não gerencia modelos');
select throws_ok($$update public.studio_modelos set corpo='x'$$,'42501',null,'sem UPDATE direto em modelos');

-- Isolamento
reset role;select set_config('request.jwt.claims','{"sub":"f5000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select ok(set_config('t.mB',public.salvar_modelo_studio(current_setting('t.orgB')::uuid,null,'Modelo B','livre','email','a','Olá {{cliente_nome}}')::text,true) is not null,'outro estúdio tem os próprios modelos');
select is((select count(*)::integer from public.studio_modelos),1,'outro estúdio só enxerga os próprios modelos');
select throws_ok($$select * from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid)$$,'42501',null,'outro estúdio não lê a linha do tempo alheia');
select throws_ok($$select * from public.linha_do_tempo_studio(current_setting('t.orgB')::uuid,current_setting('t.cli1')::uuid)$$,'22023',null,'organização própria não abre cliente alheio');
select is((select count(*)::integer from public.linha_do_tempo_studio(current_setting('t.orgB')::uuid,current_setting('t.cliB')::uuid)),0,'linha do tempo de B não traz nada de A');
select throws_ok($$select * from public.renderizar_modelo_studio(current_setting('t.orgA')::uuid,current_setting('t.m1')::uuid)$$,'42501',null,'outro estúdio não renderiza modelo alheio');
select throws_ok($$select public.salvar_modelo_studio(current_setting('t.orgB')::uuid,current_setting('t.m1')::uuid,'Roubo','livre','email','a','b')$$,'22023',null,'não edita modelo de outra organização');
select throws_ok($$select * from public.renderizar_modelo_studio(current_setting('t.orgB')::uuid,current_setting('t.mB')::uuid,null,current_setting('t.n1')::uuid)$$,'22023',null,'prévia não usa negócio de outra organização');
reset role;select set_config('request.jwt.claims','{"sub":"f5000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select * from public.linha_do_tempo_studio(current_setting('t.orgA')::uuid,current_setting('t.cli1')::uuid)$$,'42501',null,'cliente final não lê a linha do tempo');
reset role; set local role anon;
select throws_ok($$select * from public.linha_do_tempo_studio(gen_random_uuid(),gen_random_uuid())$$,'42501',null,'anon não lê a linha do tempo');
select finish(); rollback;
