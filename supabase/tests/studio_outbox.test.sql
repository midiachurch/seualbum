begin; create extension if not exists pgtap with schema extensions; select plan(113);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f6000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f6-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f6000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f6-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f6000000-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f6-c@example.invalid','{"role":"designer"}','{}',now(),now()),
('f6000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f6-d@example.invalid','{"role":"designer"}','{}',now(),now()),
('f6000000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f6-e@example.invalid','{"role":"cliente"}','{}',now(),now()),
('f6000000-0000-4000-8000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','st-f6-f@example.invalid','{"role":"designer"}','{}',now(),now());
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
do $$ begin
  perform public.criar_galeria_digital('f6100000-0000-4000-8000-000000000001','Galeria Um','Cliente Um','um@example.invalid');
  perform public.criar_galeria_digital('f6100000-0000-4000-8000-000000000002','Galeria Dois','Cliente Dois','dois@example.invalid');
  perform public.criar_galeria_digital('f6100000-0000-4000-8000-000000000004','Galeria Tres','Cliente Tres','tres@example.invalid');
end $$;
select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'st-f6-c@example.invalid','editor');
select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'st-f6-d@example.invalid','visualizador');
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.criar_galeria_digital('f6100000-0000-4000-8000-000000000003','Galeria B','Cliente B','b@example.invalid'); end $$;
reset role;
select set_config('t.orgA',(select id::text from public.organizacoes where dono_id='f6000000-0000-4000-8000-00000000000a'),true),
       set_config('t.orgB',(select id::text from public.organizacoes where dono_id='f6000000-0000-4000-8000-00000000000b'),true),
       set_config('t.cli1',(select cliente_id::text from public.projetos where id='f6100000-0000-4000-8000-000000000001'),true),
       set_config('t.cli2',(select cliente_id::text from public.projetos where id='f6100000-0000-4000-8000-000000000002'),true),
       set_config('t.cli3',(select cliente_id::text from public.projetos where id='f6100000-0000-4000-8000-000000000004'),true),
       set_config('t.cliB',(select cliente_id::text from public.projetos where id='f6100000-0000-4000-8000-000000000003'),true);
update public.clientes set telefone='11999990000' where id=current_setting('t.cli1')::uuid;

-- Enfileirar: congela o texto e é idempotente
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select ok(set_config('t.m1',public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Aviso por e-mail','livre','email','Olá {{cliente_primeiro_nome}}','Aqui é {{estudio}}, {{cliente_nome}}.')::text,true) is not null,'modelo de e-mail');
select ok(set_config('t.mw',public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Aviso por WhatsApp','livre','whatsapp','','Oi {{cliente_primeiro_nome}}')::text,true) is not null,'modelo de WhatsApp');
select ok(set_config('t.mp',public.salvar_modelo_studio(current_setting('t.orgA')::uuid,null,'Precisa de projeto','livre','email','x','Projeto {{projeto}}')::text,true) is not null,'modelo que exige projeto');
select ok(set_config('t.o1',public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0001','email',current_setting('t.cli1')::uuid,current_setting('t.m1')::uuid)::text,true) is not null,'enfileira com modelo');
select is((select status||'/'||simulada::text||'/'||destinatario from public.studio_outbox where id=current_setting('t.o1')::uuid),'pendente/false/um@example.invalid','nasce pendente, ainda não simulada, com o e-mail do cliente');
select is((select assunto from public.studio_outbox where id=current_setting('t.o1')::uuid),'Olá Cliente','texto renderizado e congelado');
select is(public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0001','email',current_setting('t.cli1')::uuid,current_setting('t.m1')::uuid),current_setting('t.o1')::uuid,'retry com a mesma chave devolve o mesmo item');
select is((select count(*)::integer from public.studio_outbox),1,'retry não duplica a fila');
select ok(set_config('t.o2',public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0002','whatsapp',current_setting('t.cli1')::uuid,current_setting('t.mw')::uuid)::text,true) is not null,'enfileira WhatsApp quando há telefone');
select ok(set_config('t.o3',public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0003','email',current_setting('t.cli2')::uuid,null,'Assunto livre','Texto livre para {{cliente_nome}}')::text,true) is not null,'enfileira texto livre com variáveis');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0004','whatsapp',current_setting('t.cli2')::uuid,current_setting('t.mw')::uuid)$$,'22023','O cliente não tem contato neste canal.','sem telefone não enfileira WhatsApp');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0005','email',current_setting('t.cli1')::uuid,current_setting('t.mw')::uuid)$$,'22023','Modelo indisponível.','modelo de outro canal rejeitado');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0006','email',current_setting('t.cli1')::uuid,current_setting('t.mp')::uuid)$$,'22023','Faltam dados para preencher o modelo.','variável sem dado não é enviada com buraco');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0007','email',current_setting('t.cli1')::uuid,null,'a','Olá {{outra_coisa}}')$$,'22023',null,'variável desconhecida rejeitada');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0008','email',current_setting('t.cliB')::uuid,null,'a','texto')$$,'22023',null,'cliente de outro estúdio rejeitado');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0009','sms',current_setting('t.cli1')::uuid,null,'a','texto')$$,'22023',null,'canal inválido rejeitado');

-- Descadastro
select ok(set_config('t.o4',public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0010','email',current_setting('t.cli3')::uuid,null,'a','texto')::text,true) is not null,'item para cliente que vai se descadastrar');
select is(public.definir_optout_studio(current_setting('t.orgA')::uuid,current_setting('t.cli3')::uuid,'email',true),true,'descadastro registrado');
select is((select status from public.studio_outbox where id=current_setting('t.o4')::uuid),'cancelada','descadastro cancela o que estava pendente');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0011','email',current_setting('t.cli3')::uuid,null,'a','texto')$$,'22023',null,'não enfileira para quem se descadastrou');

-- Reserva, falha, backoff, retry
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,1)),1,'reserva um item');
select is((select count(*)::integer from public.studio_outbox where status='enviando'),1,'item reservado fica enviando');
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,1) where id=current_setting('t.o1')::uuid),0,'item já reservado não é reservado de novo');
select is(public.concluir_outbox_studio((select id from public.studio_outbox where status='enviando' order by created_at limit 1),false,'registro','erro simulado de rede'),'pendente','falha volta para pendente (retry)');
select is((select tentativas from public.studio_outbox where id=current_setting('t.o1')::uuid),1,'primeira tentativa contada');
select ok((select proxima_tentativa_em > clock_timestamp()+interval '50 seconds' from public.studio_outbox where id=current_setting('t.o1')::uuid),'backoff: próxima tentativa só daqui a cerca de 1 minuto');
select is((select ultimo_erro from public.studio_outbox where id=current_setting('t.o1')::uuid),'erro simulado de rede','último erro registrado');
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,10) where id=current_setting('t.o1')::uuid),0,'item em backoff não é reservado antes da hora');
-- (o segundo item pendente foi reservado acima: devolve ao estado pendente)
reset role;
update public.studio_outbox set status='pendente', reservada_em=null where status='enviando';
update public.studio_outbox set proxima_tentativa_em=clock_timestamp()-interval '1 hour' where id=current_setting('t.o1')::uuid;
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,1) where id=current_setting('t.o1')::uuid),1,'vencido o backoff, o item volta a ser reservado');
select is((select tentativas from public.studio_outbox where id=current_setting('t.o1')::uuid),2,'segunda tentativa contada');
select is(public.concluir_outbox_studio(current_setting('t.o1')::uuid,false,'registro','segunda falha'),'pendente','segunda falha ainda reprograma');
select ok((select proxima_tentativa_em > clock_timestamp()+interval '100 seconds' from public.studio_outbox where id=current_setting('t.o1')::uuid),'backoff dobra: cerca de 2 minutos');
reset role;
update public.studio_outbox set proxima_tentativa_em=clock_timestamp()-interval '1 hour' where id=current_setting('t.o1')::uuid;
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,1) where id=current_setting('t.o1')::uuid),1,'terceira reserva');
select is(public.concluir_outbox_studio(current_setting('t.o1')::uuid,true,'registro'),'enviada','sucesso só existe pelo adaptador registro');
select is((select simulada::text||'/'||adaptador from public.studio_outbox where id=current_setting('t.o1')::uuid),'true/registro','item marcado como simulado');
select is((select count(*)::integer from public.studio_outbox_registro where outbox_id=current_setting('t.o1')::uuid),1,'registro grava o que seria enviado');
select is(public.concluir_outbox_studio(current_setting('t.o1')::uuid,true,'registro'),'enviada','concluir de novo é inofensivo');
select is((select count(*)::integer from public.studio_outbox_registro where outbox_id=current_setting('t.o1')::uuid),1,'retry não duplica o registro');
select is((select tentativas from public.studio_outbox where id=current_setting('t.o1')::uuid),3,'tentativas não crescem em repetição');
select is((select corpo from public.studio_outbox_registro where outbox_id=current_setting('t.o1')::uuid),'Aqui é '||(select nome from public.organizacoes where id=current_setting('t.orgA')::uuid)||', Cliente Um.','registro guarda o texto final');
select throws_ok($$select public.concluir_outbox_studio(current_setting('t.o2')::uuid,true,'smtp')$$,'22023',null,'adaptador externo recusado ao concluir');
select throws_ok($$select public.processar_outbox_studio(current_setting('t.orgA')::uuid,10,'sendgrid')$$,'22023','Envio externo desligado: só o adaptador registro é aceito.','processar com adaptador externo é recusado');

-- Processamento completo (adaptador registro) sem duplicar
select is((public.processar_outbox_studio(current_setting('t.orgA')::uuid)->>'processadas')::integer,2,'processa os itens restantes');
select is((public.processar_outbox_studio(current_setting('t.orgA')::uuid)->>'processadas')::integer,0,'segunda rodada não reprocessa nada');
select is((select count(*)::integer from public.studio_outbox where status='enviada' and simulada),3,'todas as enviadas são simuladas');
select is((select count(*)::integer from public.studio_outbox_registro),3,'um registro por item enviado, sem duplicar');
select is((public.processar_outbox_studio(current_setting('t.orgA')::uuid)->>'envio_externo')::boolean,false,'resposta confirma que o envio externo está desligado');

-- Constraints: nada pode virar "enviado" de verdade
reset role;
select throws_ok($$update public.studio_outbox set simulada=false where id=current_setting('t.o1')::uuid$$,'23514',null,'banco barra "enviada" não simulada');
select throws_ok($$update public.studio_outbox set adaptador='smtp' where id=current_setting('t.o1')::uuid$$,'23514',null,'banco barra adaptador externo');
select throws_ok($$insert into public.studio_configuracao(organizacao_id,envio_externo) values (current_setting('t.orgA')::uuid,true)$$,'23514',null,'banco barra ligar o envio externo');
select throws_ok($$insert into public.studio_outbox(organizacao_id,destinatario_tipo,canal,destinatario,corpo,chave_idem) values (current_setting('t.orgA')::uuid,'cliente','email','a@example.invalid','x','chave-out-0001')$$,'23505',null,'chave de idempotência é única por organização');

-- Esgotar tentativas, falhar e reenfileirar
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select ok(set_config('t.o5',public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0012','email',current_setting('t.cli2')::uuid,null,'a','texto')::text,true) is not null,'item para esgotar tentativas');
reset role;
update public.studio_outbox set max_tentativas=2 where id=current_setting('t.o5')::uuid;
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,5) where id=current_setting('t.o5')::uuid),1,'reserva 1 do item de teste');
select is(public.concluir_outbox_studio(current_setting('t.o5')::uuid,false,'registro','falha 1'),'pendente','falha 1');
reset role;
update public.studio_outbox set proxima_tentativa_em=clock_timestamp()-interval '1 second' where id=current_setting('t.o5')::uuid;
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,5) where id=current_setting('t.o5')::uuid),1,'reserva 2 do item de teste');
select is(public.concluir_outbox_studio(current_setting('t.o5')::uuid,false,'registro','falha 2'),'falhou','esgotadas as tentativas, o item falha de vez');
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,5) where id=current_setting('t.o5')::uuid),0,'item falhou não é reservado sozinho');
select is(public.reenfileirar_outbox_studio(current_setting('t.o5')::uuid),true,'gestor reenfileira item que falhou');
select is((select status||'/'||tentativas::text from public.studio_outbox where id=current_setting('t.o5')::uuid),'pendente/0','nova rodada zera tentativas');
select is(public.reenfileirar_outbox_studio(current_setting('t.o5')::uuid),false,'reenfileirar item pendente é inofensivo');
select is(public.cancelar_outbox_studio(current_setting('t.o5')::uuid),true,'cancela item pendente');
select is(public.cancelar_outbox_studio(current_setting('t.o5')::uuid),false,'cancelar de novo é inofensivo');
select is(public.cancelar_outbox_studio(current_setting('t.o1')::uuid),false,'não cancela o que já foi enviado');

-- Reserva presa volta para a fila
select ok(set_config('t.o6',public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0013','email',current_setting('t.cli2')::uuid,null,'a','texto')::text,true) is not null,'item para reserva presa');
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,5) where id=current_setting('t.o6')::uuid),1,'reservado');
reset role;
update public.studio_outbox set reservada_em=clock_timestamp()-interval '11 minutes' where id=current_setting('t.o6')::uuid;
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.reservar_outbox_studio(current_setting('t.orgA')::uuid,5) where id=current_setting('t.o6')::uuid),1,'reserva presa há mais de 10 minutos é recuperada');
select is(public.concluir_outbox_studio(current_setting('t.o6')::uuid,true,'registro'),'enviada','e conclui normalmente');

-- Automações: só geram itens, nunca enviam
select ok(set_config('t.t1',public.criar_tarefa_studio(current_setting('t.orgA')::uuid,'chave-tar-0001','Mandar contrato','f6000000-0000-4000-8000-00000000000c',now()-interval '2 days')::text,true) is not null,'tarefa atrasada do editor');
select is((public.rodar_automacoes_studio(current_setting('t.orgA')::uuid)->>'lembretes_tarefa')::integer,1,'automação gera lembrete de tarefa atrasada');
select is((select destinatario||'/'||destinatario_tipo||'/'||status from public.studio_outbox where origem='automacao_tarefa_atrasada'),'st-f6-c@example.invalid/membro/pendente','lembrete vai ao responsável e fica pendente');
select is((public.rodar_automacoes_studio(current_setting('t.orgA')::uuid)->>'lembretes_tarefa')::integer,0,'segunda rodada não duplica o lembrete');
select is((select count(*)::integer from public.studio_outbox where origem='automacao_tarefa_atrasada'),1,'um lembrete por tarefa atrasada');
select ok(set_config('t.n1',public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0001','Casamento Um',null,null,null,'site',2500,current_setting('t.cli1')::uuid)::text,true) is not null,'negócio 1 (sem resposta)');
select ok(set_config('t.n2',public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0002','Ensaio Dois',null,null,null,'site',900,current_setting('t.cli2')::uuid)::text,true) is not null,'negócio 2 (cliente respondeu)');
select ok(set_config('t.n3',public.criar_negocio_studio(current_setting('t.orgA')::uuid,'chave-neg-0003','Batizado Tres',null,null,null,'site',700,current_setting('t.cli3')::uuid)::text,true) is not null,'negócio 3 (descadastrado)');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n1')::uuid,'proposta','chave-etp-0001'),true,'n1 em proposta');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n2')::uuid,'proposta','chave-etp-0002'),true,'n2 em proposta');
select is(public.mudar_etapa_negocio_studio(current_setting('t.n3')::uuid,'proposta','chave-etp-0003'),true,'n3 em proposta');
select is((public.rodar_automacoes_studio(current_setting('t.orgA')::uuid)->>'followups_proposta')::integer,0,'proposta recente ainda não pede follow-up');
reset role;
update public.studio_negocios set etapa_em=clock_timestamp()-interval '5 days' where id in (current_setting('t.n1')::uuid,current_setting('t.n2')::uuid,current_setting('t.n3')::uuid);
insert into public.conversas(id,canal,fotografo_id,projeto_id) values ('f6200000-0000-4000-8000-000000000002','cliente_estudio','f6000000-0000-4000-8000-00000000000a','f6100000-0000-4000-8000-000000000002');
insert into public.mensagens(conversa_id,autor_nome,autor_papel,tipo,corpo) values ('f6200000-0000-4000-8000-000000000002','Cliente Dois','cliente','texto','Vamos fechar!');
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.definir_followup_dias_studio(current_setting('t.orgA')::uuid,10),10,'gestor ajusta o prazo do follow-up');
select is((public.rodar_automacoes_studio(current_setting('t.orgA')::uuid)->>'followups_proposta')::integer,0,'com prazo de 10 dias nada vence');
select is(public.definir_followup_dias_studio(current_setting('t.orgA')::uuid,3),3,'volta para 3 dias');
select is((public.rodar_automacoes_studio(current_setting('t.orgA')::uuid)->>'followups_proposta')::integer,1,'só o negócio sem resposta e sem descadastro gera follow-up');
select is((select cliente_id from public.studio_outbox where origem='automacao_followup_proposta'),current_setting('t.cli1')::uuid,'follow-up é do cliente sem resposta');
select is((public.rodar_automacoes_studio(current_setting('t.orgA')::uuid)->>'followups_proposta')::integer,0,'follow-up não repete');
select is(public.definir_optout_studio(current_setting('t.orgA')::uuid,current_setting('t.cli3')::uuid,'email',false),true,'cliente 3 volta a aceitar e-mail');
select is((public.rodar_automacoes_studio(current_setting('t.orgA')::uuid)->>'followups_proposta')::integer,1,'agora o cliente 3 também recebe follow-up');
select is((select count(*)::integer from public.studio_outbox where origem like 'automacao%' and status<>'pendente'),0,'automação jamais envia: tudo fica pendente');
select throws_ok($$select public.definir_followup_dias_studio(current_setting('t.orgA')::uuid,0)$$,'22023',null,'prazo de follow-up inválido rejeitado');

-- Papéis
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select ok(public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0014','email',current_setting('t.cli2')::uuid,null,'a','texto') is not null,'editor enfileira');
select throws_ok($$select public.processar_outbox_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'editor não processa a fila');
select throws_ok($$select * from public.reservar_outbox_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'editor não reserva itens');
select throws_ok($$select public.rodar_automacoes_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'editor não roda automações');
select throws_ok($$select public.reenfileirar_outbox_studio(current_setting('t.o5')::uuid)$$,'42501',null,'editor não reenfileira');
select throws_ok($$select public.definir_followup_dias_studio(current_setting('t.orgA')::uuid,5)$$,'42501',null,'editor não altera a configuração');
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select ok((select count(*) from public.listar_outbox_studio(current_setting('t.orgA')::uuid))>0,'visualizador lê a fila');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0015','email',current_setting('t.cli2')::uuid,null,'a','texto')$$,'42501',null,'visualizador não enfileira');
select throws_ok($$select public.cancelar_outbox_studio(current_setting('t.o5')::uuid)$$,'42501',null,'visualizador não cancela');
select throws_ok($$select public.definir_optout_studio(current_setting('t.orgA')::uuid,current_setting('t.cli2')::uuid,'email',true)$$,'42501',null,'visualizador não altera descadastro');
select throws_ok($$update public.studio_outbox set status='cancelada'$$,'42501',null,'sem UPDATE direto na outbox');
select throws_ok($$insert into public.studio_outbox_registro(outbox_id,organizacao_id,canal,destinatario,assunto,corpo,tentativa) values (gen_random_uuid(),current_setting('t.orgA')::uuid,'email','a','b','c',1)$$,'42501',null,'sem INSERT direto no registro');

-- Isolamento
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.studio_outbox),0,'outro estúdio não enxerga a fila');
select is((select count(*)::integer from public.studio_outbox_registro),0,'outro estúdio não enxerga registros');
select throws_ok($$select * from public.listar_outbox_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'outro estúdio não lista a fila alheia');
select throws_ok($$select public.processar_outbox_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'outro estúdio não processa fila alheia');
select throws_ok($$select public.concluir_outbox_studio(current_setting('t.o5')::uuid,true,'registro')$$,'42501',null,'outro estúdio não conclui item alheio');
select throws_ok($$select public.cancelar_outbox_studio(current_setting('t.o5')::uuid)$$,'42501',null,'outro estúdio não cancela item alheio');
select throws_ok($$select public.rodar_automacoes_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'outro estúdio não roda automações alheias');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgB')::uuid,'chave-out-0016','email',current_setting('t.cli1')::uuid,null,'a','texto')$$,'22023',null,'não enfileira para cliente de outro estúdio');
reset role;select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select * from public.listar_outbox_studio(current_setting('t.orgA')::uuid)$$,'42501',null,'cliente final não lê a fila');
select throws_ok($$select public.enfileirar_mensagem_studio(current_setting('t.orgA')::uuid,'chave-out-0017','email',current_setting('t.cli1')::uuid,null,'a','texto')$$,'42501',null,'cliente final não enfileira');
reset role; set local role anon;
select throws_ok($$select public.processar_outbox_studio(gen_random_uuid())$$,'42501',null,'anon não processa fila');
select throws_ok($$select public.rodar_automacoes_studio(gen_random_uuid())$$,'42501',null,'anon não roda automações');
select finish(); rollback;
