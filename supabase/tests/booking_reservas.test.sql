begin; create extension if not exists pgtap with schema extensions; select plan(136);
-- Booking: holds, corrida, expiração, idempotência, sinal simulado, cancelamento, remarcação, conclusão, vínculo e anti-abuso.
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('b7000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rv-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('b7000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rv-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('b7000000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rv-editor@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('b7000000-0000-4000-8000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rv-viewer@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('b7000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rv-cliente@example.invalid','{"role":"cliente"}','{}',now(),now());
select set_config('app.orgA',(select id::text from public.organizacoes where dono_id='b7000000-0000-4000-8000-00000000000a'),true), set_config('app.orgB',(select id::text from public.organizacoes where dono_id='b7000000-0000-4000-8000-00000000000b'),true);

-- Auxiliar do teste: instante local de São Paulo (sem horário de verão) em hoje + N dias.
create function public._t_t(p_hhmm text, p_dias integer default 3) returns timestamptz language sql stable as $$ select ((current_date + p_dias) + p_hhmm::time) at time zone 'America/Sao_Paulo' $$;
create function public._t_slots(p_slug text, p_dias integer default 3) returns integer language sql stable as $$ select count(*)::integer from public.agenda_listar_slots(p_slug, current_date + p_dias, current_date + p_dias) $$;
create function public._t_tem(p_slug text, p_hhmm text, p_dias integer default 3) returns integer language sql stable as $$ select count(*)::integer from public.agenda_listar_slots(p_slug, current_date + p_dias, current_date + p_dias) where slot_inicio = public._t_t(p_hhmm, p_dias) $$;
grant execute on function public._t_t(text,integer), public._t_slots(text,integer), public._t_tem(text,text,integer) to public;

-- Cenário: dono cria dois recursos (um com sinal simulado), grade 09-17 todos os dias, equipe.
select set_config('request.jwt.claims','{"sub":"b7000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select public.adicionar_membro_organizacao(current_setting('app.orgA')::uuid,'rv-editor@example.invalid','editor');
select public.adicionar_membro_organizacao(current_setting('app.orgA')::uuid,'rv-viewer@example.invalid','visualizador');
select set_config('app.rA',public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Estúdio','sessao-a','pessoa',null,'America/Sao_Paulo',60,15,30,120,60,24,null,true)::text,true);
select set_config('app.rS',public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Ensaio com sinal','sessao-sinal','pessoa',null,'America/Sao_Paulo',60,0,30,120,60,24,5000,true)::text,true);
select public.agenda_definir_disponibilidade(current_setting('app.rA')::uuid,'[{"dia":0,"inicio":"09:00","fim":"17:00"},{"dia":1,"inicio":"09:00","fim":"17:00"},{"dia":2,"inicio":"09:00","fim":"17:00"},{"dia":3,"inicio":"09:00","fim":"17:00"},{"dia":4,"inicio":"09:00","fim":"17:00"},{"dia":5,"inicio":"09:00","fim":"17:00"},{"dia":6,"inicio":"09:00","fim":"17:00"}]'::jsonb);
select public.agenda_definir_disponibilidade(current_setting('app.rS')::uuid,'[{"dia":0,"inicio":"09:00","fim":"17:00"},{"dia":1,"inicio":"09:00","fim":"17:00"},{"dia":2,"inicio":"09:00","fim":"17:00"},{"dia":3,"inicio":"09:00","fim":"17:00"},{"dia":4,"inicio":"09:00","fim":"17:00"},{"dia":5,"inicio":"09:00","fim":"17:00"},{"dia":6,"inicio":"09:00","fim":"17:00"}]'::jsonb);

-- Slots públicos
reset role;select set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
select is(public._t_slots('sessao-a'),15,'anon: 15 slots (60 min a cada 30 min, 09:00-17:00)');
select is(public._t_tem('sessao-a','10:00'),1,'slot das 10:00 locais existe');
select is(extract(hour from public._t_t('10:00') at time zone 'UTC')::integer,13,'10:00 em São Paulo = 13:00 UTC');
select is((select count(*)::integer from public.agenda_listar_slots('sessao-a',current_date-1,current_date) where slot_inicio < now()+interval '2 hours'),0,'antecedência mínima de 2 h respeitada');
select is((select count(*)::integer from public.agenda_listar_slots('sessao-a',current_date+90,current_date+100)),0,'antecedência máxima de 60 dias respeitada');
select is((select count(*)::integer from public.agenda_listar_slots('inexistente',current_date,current_date+3)),0,'slug inexistente não lista nada');

-- Hold, idempotência e sobreposição
select is(set_config('app.h1',(public.agenda_criar_hold('sessao-a',public._t_t('10:00'),'Cliente Um','Um@Example.invalid','11999990000',repeat('1',64))->>'id'),true) is not null,true,'anon cria hold');
select is(public.agenda_criar_hold('sessao-a',public._t_t('10:00'),'Cliente Um','um@example.invalid',null,repeat('1',64))->>'id',current_setting('app.h1'),'mesma chave devolve a mesma reserva (idempotente)');
select is(public.agenda_criar_hold('sessao-a',public._t_t('10:00'),'Cliente Um','um@example.invalid',null,repeat('1',64))->>'status','hold','nasce em hold');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('10:00'),'Outra Pessoa','outra@example.invalid',null,repeat('1',64))$$,'22023',null,'chave reutilizada para outro contato é rejeitada');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('11:00'),'Cliente Um','um@example.invalid',null,repeat('1',64))$$,'22023',null,'chave reutilizada para outro horário é rejeitada');
select is(public._t_tem('sessao-a','09:00'),0,'09:00 some (terminaria dentro do hold, com buffer)');
select is(public._t_tem('sessao-a','09:30'),0,'09:30 some (sobrepõe)');
select is(public._t_tem('sessao-a','10:00'),0,'10:00 ocupado');
select is(public._t_tem('sessao-a','10:30'),0,'10:30 sobrepõe');
select is(public._t_tem('sessao-a','11:00'),0,'11:00 cai no buffer de 15 min');
select is(public._t_tem('sessao-a','11:30'),1,'11:30 livre depois do buffer');
select is(public._t_slots('sessao-a'),10,'restam 10 slots no dia');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('10:00'),'Cliente Dois','dois@example.invalid',null,repeat('2',64))$$,'23P01',null,'corrida: segundo hold no mesmo intervalo é recusado');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('09:30'),'Cliente Dois','dois@example.invalid',null,repeat('2',64))$$,'23P01',null,'corrida: sobreposição parcial recusada');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('10:07'),'Cliente Dois','dois@example.invalid',null,repeat('2',64))$$,'23P01',null,'horário fora da grade de slots recusado');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('03:00'),'Cliente Dois','dois@example.invalid',null,repeat('2',64))$$,'23P01',null,'horário fora da disponibilidade recusado');
select throws_ok($$select public.agenda_criar_hold('sessao-a',now()+interval '30 minutes','Cliente Dois','dois@example.invalid',null,repeat('2',64))$$,'23P01',null,'horário dentro da antecedência mínima recusado');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('11:30'),'X','dois@example.invalid',null,repeat('2',64))$$,'22023',null,'nome curto rejeitado');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('11:30'),'Cliente Dois','sem-arroba',null,repeat('2',64))$$,'22023',null,'e-mail inválido rejeitado');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('11:30'),'Cliente Dois','dois@example.invalid',null,'curto')$$,'22023',null,'chave inválida rejeitada');
select throws_ok($$select public.agenda_criar_hold('nao-existe',public._t_t('11:30'),'Cliente Dois','dois@example.invalid',null,repeat('2',64))$$,'22023',null,'agenda inexistente rejeitada');
reset role;
select is((select count(*)::integer from public.agenda_reservas where recurso_id=current_setting('app.rA')::uuid and status='hold'),1,'só um hold vivo no intervalo disputado');
select throws_ok($$insert into public.agenda_reservas(organizacao_id,recurso_id,status,inicio,fim,ocupa_ate,contato_nome,contato_email,token_hash) values (current_setting('app.orgA')::uuid,current_setting('app.rA')::uuid,'confirmada',public._t_t('10:30'),public._t_t('11:30'),public._t_t('11:45'),'Intruso','intruso@example.invalid',repeat('3',64))$$,'23P01',null,'EXCLUDE barra INSERT sobreposto mesmo fora das RPCs');
select lives_ok($$insert into public.agenda_reservas(organizacao_id,recurso_id,status,inicio,fim,ocupa_ate,contato_nome,contato_email,token_hash,cancelada_em) values (current_setting('app.orgA')::uuid,current_setting('app.rA')::uuid,'cancelada',public._t_t('10:00'),public._t_t('11:00'),public._t_t('11:15'),'Cancelada','canc@example.invalid',repeat('4',64),now())$$,'reserva cancelada não ocupa o intervalo');
select lives_ok($$insert into public.agenda_reservas(organizacao_id,recurso_id,status,inicio,fim,ocupa_ate,contato_nome,contato_email,token_hash) values (current_setting('app.orgA')::uuid,current_setting('app.rS')::uuid,'confirmada',public._t_t('10:00'),public._t_t('11:00'),public._t_t('11:15'),'Outro recurso','outro@example.invalid',repeat('5',64))$$,'mesmo horário em outro recurso não conflita');
delete from public.agenda_reservas where token_hash=repeat('5',64);

-- Confirmação com segredo
set local role anon;
select throws_ok($$select public.agenda_confirmar_publica(current_setting('app.h1')::uuid,repeat('9',64))$$,'22023',null,'confirmar com segredo errado é recusado');
select throws_ok($$select public.agenda_confirmar_publica(gen_random_uuid(),repeat('1',64))$$,'22023',null,'reserva inexistente tem a mesma resposta');
select is(public.agenda_confirmar_publica(current_setting('app.h1')::uuid,repeat('1',64)),'confirmada','cliente confirma com o segredo');
select is(public.agenda_confirmar_publica(current_setting('app.h1')::uuid,repeat('1',64)),'confirmada','confirmar de novo é idempotente');
select is(public.agenda_reserva_publica(current_setting('app.h1')::uuid,repeat('1',64))->>'status','confirmada','cliente vê o próprio status');
select is(public.agenda_reserva_publica(current_setting('app.h1')::uuid,repeat('1',64)) ? 'contato_email',false,'visão pública não ecoa contato');
select throws_ok($$select * from public.agenda_reservas$$,'42501',null,'anon não lê a tabela de reservas');
select throws_ok($$select public.agenda_reserva_publica(current_setting('app.h1')::uuid,repeat('9',64))$$,'22023',null,'visão pública exige o segredo');

-- Expiração do hold
select is(set_config('app.h2',(public.agenda_criar_hold('sessao-a',public._t_t('13:00'),'Cliente Dois','dois@example.invalid',null,repeat('2',64))->>'id'),true) is not null,true,'hold das 13:00');
reset role;
select is((select expira_em - created_at from public.agenda_reservas where id=current_setting('app.h2')::uuid),interval '10 minutes','hold expira em 10 minutos');
update public.agenda_reservas set expira_em=now()-interval '1 minute' where id=current_setting('app.h2')::uuid;
set local role anon;
select is(public._t_tem('sessao-a','13:00'),1,'hold vencido libera o slot na listagem (sem job)');
select is(public.agenda_confirmar_publica(current_setting('app.h2')::uuid,repeat('2',64)),'expirada','confirmar hold vencido devolve expirada');
reset role;
select is((select status from public.agenda_reservas where id=current_setting('app.h2')::uuid),'expirada','hold vencido ficou marcado como expirada');
select is((select count(*)::integer from public.agenda_reserva_eventos where reserva_id=current_setting('app.h2')::uuid and tipo='expirada'),1,'expiração registrada na trilha');
set local role anon;
select is(set_config('app.h3',(public.agenda_criar_hold('sessao-a',public._t_t('13:00'),'Cliente Tres','tres@example.invalid',null,repeat('6',64))->>'id'),true) is not null,true,'novo hold no slot liberado');
reset role;
update public.agenda_reservas set expira_em=now()-interval '1 minute' where id=current_setting('app.h3')::uuid;
set local role anon;
select is(public.agenda_criar_hold('sessao-a',public._t_t('13:00'),'Cliente Quatro','quatro@example.invalid',null,repeat('7',64))->>'status','hold','hold vencido que ainda ocupa a linha não impede nova reserva (expira sob lock)');
reset role;
select is((select status from public.agenda_reservas where id=current_setting('app.h3')::uuid),'expirada','o vencido foi marcado expirada na criação do novo');

-- Sinal simulado e pagamento tardio
set local role anon;
select is(set_config('app.s1',(public.agenda_criar_hold('sessao-sinal',public._t_t('10:00'),'Com Sinal','sinal@example.invalid',null,repeat('a',64))->>'id'),true) is not null,true,'hold com sinal');
select is(public.agenda_criar_hold('sessao-sinal',public._t_t('10:00'),'Com Sinal','sinal@example.invalid',null,repeat('a',64))->>'sinal_status','pendente','sinal nasce pendente');
select throws_ok($$select public.agenda_confirmar_publica(current_setting('app.s1')::uuid,repeat('a',64))$$,'55000',null,'sem sinal pago o cliente não confirma');
select is(public.agenda_pagar_sinal_simulado(current_setting('app.s1')::uuid,repeat('a',64)),'confirmada','sinal simulado confirma o hold vigente');
select is(public.agenda_pagar_sinal_simulado(current_setting('app.s1')::uuid,repeat('a',64)),'confirmada','pagar de novo é idempotente');
select is(set_config('app.s2',(public.agenda_criar_hold('sessao-sinal',public._t_t('14:00'),'Tardio','tardio@example.invalid',null,repeat('b',64))->>'id'),true) is not null,true,'segundo hold com sinal');
reset role;
update public.agenda_reservas set expira_em=now()-interval '1 minute' where id=current_setting('app.s2')::uuid;
set local role anon;
select is(public.agenda_criar_hold('sessao-sinal',public._t_t('14:00'),'Outro','outro@example.invalid',null,repeat('c',64))->>'status','hold','outro cliente ocupa o slot perdido');
select is(public.agenda_pagar_sinal_simulado(current_setting('app.s2')::uuid,repeat('b',64)),'reembolso_pendente','pagamento tardio não reocupa o slot: vira reembolso pendente');
reset role;
select is((select status||'/'||sinal_status from public.agenda_reservas where id=current_setting('app.s2')::uuid),'expirada/reembolso_pendente','reserva perdida segue expirada, com compensação marcada');
select is((select count(*)::integer from public.agenda_reservas where recurso_id=current_setting('app.rS')::uuid and status in ('hold','confirmada') and inicio=public._t_t('14:00')),1,'um único ocupante vivo no slot disputado');

-- Anti-abuso
set local role anon;
select is(public.agenda_criar_hold('sessao-a',public._t_t('15:00'),'Abusador','abuso@example.invalid',null,repeat('d',64))->>'status','hold','anti-abuso: 1º hold do e-mail');
select is(public.agenda_criar_hold('sessao-a',public._t_t('10:00',4),'Abusador','abuso@example.invalid',null,repeat('e',64))->>'status','hold','anti-abuso: 2º hold do e-mail');
select is(public.agenda_criar_hold('sessao-a',public._t_t('10:00',5),'Abusador','abuso@example.invalid',null,repeat('f',64))->>'status','hold','anti-abuso: 3º hold do e-mail');
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('10:00',6),'Abusador','ABUSO@example.invalid',null,repeat('0',64))$$,'54000',null,'anti-abuso: 4º hold ativo do mesmo e-mail (caixa ignorada) é barrado');
select is(public.agenda_criar_hold('sessao-a',public._t_t('10:00',5),'Abusador','abuso@example.invalid',null,repeat('f',64))->>'status','hold','retry idempotente de hold existente não conta como novo');
reset role;
insert into public.agenda_reservas(organizacao_id,recurso_id,status,inicio,fim,ocupa_ate,contato_nome,contato_email,token_hash,cancelada_em) select current_setting('app.orgA')::uuid,current_setting('app.rA')::uuid,'cancelada',now()+interval '400 days'+g*interval '2 hours',now()+interval '400 days'+g*interval '2 hours'+interval '1 hour',now()+interval '400 days'+g*interval '2 hours'+interval '1 hour','Rajada','rajada@example.invalid',lpad(to_hex(g),64,'e'),now() from generate_series(1,10) g;
set local role anon;
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('10:00',7),'Rajada','rajada@example.invalid',null,repeat('8',64))$$,'54000',null,'anti-abuso: mais de 10 tentativas por hora do mesmo e-mail');
reset role;
insert into public.agenda_reservas(organizacao_id,recurso_id,status,inicio,fim,ocupa_ate,contato_nome,contato_email,token_hash,expira_em) select current_setting('app.orgA')::uuid,current_setting('app.rA')::uuid,'hold',now()+interval '800 days'+g*interval '2 hours',now()+interval '800 days'+g*interval '2 hours'+interval '1 hour',now()+interval '800 days'+g*interval '2 hours'+interval '1 hour','Flood','flood'||g||'@example.invalid',lpad(to_hex(g+1000),64,'f'),now()+interval '1 hour' from generate_series(1,30) g;
set local role anon;
select throws_ok($$select public.agenda_criar_hold('sessao-a',public._t_t('10:00',7),'Novo Cliente','novo@example.invalid',null,repeat('5',64))$$,'54000',null,'anti-abuso: teto de holds vivos por recurso');
reset role;
delete from public.agenda_reservas where contato_email like 'flood%@example.invalid';

-- Cancelamento e política de antecedência
insert into public.agenda_reservas(id,organizacao_id,recurso_id,status,inicio,fim,ocupa_ate,contato_nome,contato_email,token_hash,confirmada_em) values ('b7100000-0000-4000-8000-000000000001',current_setting('app.orgA')::uuid,current_setting('app.rA')::uuid,'confirmada',now()+interval '3 hours',now()+interval '4 hours',now()+interval '4 hours 15 minutes','Em Cima da Hora','cima@example.invalid',repeat('c1',32),now());
set local role anon;
select throws_ok($$select public.agenda_cancelar_publica('b7100000-0000-4000-8000-000000000001',repeat('c1',32))$$,'55000',null,'cliente não cancela dentro da antecedência da política (24 h)');
select throws_ok($$select public.agenda_remarcar_publica('b7100000-0000-4000-8000-000000000001',repeat('c1',32),public._t_t('15:00'))$$,'55000',null,'cliente não remarca dentro da antecedência da política');
select is(public.agenda_cancelar_publica(current_setting('app.h1')::uuid,repeat('1',64)),'cancelada','cliente cancela com antecedência suficiente');
select is(public.agenda_cancelar_publica(current_setting('app.h1')::uuid,repeat('1',64)),'cancelada','cancelar de novo é idempotente');
select is(public._t_tem('sessao-a','10:00'),1,'cancelamento devolve o slot');
select is(public.agenda_cancelar_publica(current_setting('app.s1')::uuid,repeat('a',64)),'cancelada','cliente cancela reserva com sinal pago');
reset role;
select is((select sinal_status from public.agenda_reservas where id=current_setting('app.s1')::uuid),'reembolso_pendente','cancelar reserva paga gera reembolso pendente');
select is((select count(*)::integer from public.agenda_reserva_eventos where reserva_id=current_setting('app.h1')::uuid and tipo in ('hold','confirmada','cancelada')),3,'trilha de auditoria: hold, confirmada e cancelada');
select is((select cancelada_por from public.agenda_reservas where id=current_setting('app.h1')::uuid),'cliente','cancelamento registra quem cancelou');

-- Operação da equipe
select set_config('request.jwt.claims','{"sub":"b7000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select is(public.agenda_cancelar('b7100000-0000-4000-8000-000000000001','cliente pediu'),'cancelada','editor cancela sem prazo mínimo');
select is((select cancelada_por||'/'||motivo_cancelamento from public.agenda_reservas where id='b7100000-0000-4000-8000-000000000001'),'estudio/cliente pediu','cancelamento registra autor e motivo');
select throws_ok($$select token_hash from public.agenda_reservas$$,'42501',null,'membro não lê token_hash');
select is(public.agenda_reservar_estudio(current_setting('app.rA')::uuid,public._t_t('09:00'),'Balcão','balcao@example.invalid','1133334444',repeat('ab',32)) is not null,true,'editor reserva pelo estúdio (já confirmada)');
select is(public.agenda_reservar_estudio(current_setting('app.rA')::uuid,public._t_t('09:00'),'Balcão','balcao@example.invalid','1133334444',repeat('ab',32)) is not null,true,'reserva do estúdio é idempotente pela chave');
select is((select count(*)::integer from public.agenda_reservas where contato_telefone='1133334444'),1,'uma única reserva para a chave repetida');
select is((select status from public.agenda_reservas where contato_telefone='1133334444'),'confirmada','reserva do estúdio já nasce confirmada');
select throws_ok($$select public.agenda_reservar_estudio(current_setting('app.rA')::uuid,public._t_t('09:00'),'Balcão 2','balcao2@example.invalid',null,repeat('ac',32))$$,'23P01',null,'estúdio também não sobrepõe');
select is((select count(*)::integer from public.agenda_listar_slots_estudio(current_setting('app.rA')::uuid,current_date+3,current_date+3))>0,true,'editor lista slots internos');
select is(public.agenda_confirmar((select id from public.agenda_reservas where contato_telefone='1133334444')),'confirmada','confirmar reserva já confirmada é inofensivo');
select is(public.agenda_remarcar((select id from public.agenda_reservas where contato_telefone='1133334444'),public._t_t('11:00')),public._t_t('11:00'),'estúdio remarca reserva confirmada');
select is((select remarcacoes from public.agenda_reservas where contato_telefone='1133334444'),1,'contador de remarcações incrementa');
select is((select count(*)::integer from public.agenda_reserva_eventos e join public.agenda_reservas r on r.id=e.reserva_id where r.contato_telefone='1133334444' and e.tipo='remarcada'),1,'remarcação auditada');
select throws_ok($$select public.agenda_remarcar((select id from public.agenda_reservas where contato_telefone='1133334444'),public._t_t('12:00'))$$,'23P01',null,'remarcar para intervalo que invade o hold das 13:00 (buffer incluso) é recusado');
select is((select count(*)::integer from public.agenda_listar_slots_estudio(current_setting('app.rA')::uuid,current_date+3,current_date+3) where slot_inicio=public._t_t('09:00')),1,'remarcar liberou o horário antigo');
select is(public.agenda_remarcar((select id from public.agenda_reservas where contato_telefone='1133334444'),public._t_t('11:00')),public._t_t('11:00'),'remarcar para o mesmo horário é inofensivo');
select throws_ok($$select public.agenda_remarcar((select id from public.agenda_reservas where recurso_id=current_setting('app.rA')::uuid and status='cancelada' limit 1),public._t_t('12:00'))$$,'55000',null,'reserva cancelada não remarca');

-- Vínculo com clientes: um por reserva, idempotente
select is(set_config('app.c1',public.agenda_vincular_cliente((select id from public.agenda_reservas where contato_telefone='1133334444'))::text,true) is not null,true,'vínculo cria o cliente');
select is(public.agenda_vincular_cliente((select id from public.agenda_reservas where contato_telefone='1133334444'))::text,current_setting('app.c1'),'vínculo é idempotente: um por reserva');
select is(public.agenda_reservar_estudio(current_setting('app.rA')::uuid,public._t_t('14:00',4),'Balcão','BALCAO@example.invalid',null,repeat('ad',32)) is not null,true,'segunda reserva do mesmo e-mail');
select is(public.agenda_vincular_cliente((select id from public.agenda_reservas where (contato_telefone is null and contato_email='balcao@example.invalid')))::text,current_setting('app.c1'),'mesmo e-mail reaproveita o mesmo cliente');
select throws_ok($$select public.agenda_vincular_cliente(current_setting('app.h3')::uuid)$$,'55000',null,'reserva expirada não vincula cliente');
reset role;
select is((select count(*)::integer from public.clientes where email='balcao@example.invalid'),1,'um único cliente cadastrado para o e-mail');
select is((select origem from public.clientes where id=current_setting('app.c1')::uuid),'agenda','cliente nasce com origem agenda');
select is((select fotografo_id from public.clientes where id=current_setting('app.c1')::uuid),'b7000000-0000-4000-8000-00000000000a'::uuid,'cliente pertence ao dono da organização');

-- Conclusão
insert into public.agenda_reservas(id,organizacao_id,recurso_id,status,inicio,fim,ocupa_ate,contato_nome,contato_email,token_hash,confirmada_em) values ('b7100000-0000-4000-8000-000000000002',current_setting('app.orgA')::uuid,current_setting('app.rA')::uuid,'confirmada',now()-interval '3 hours',now()-interval '2 hours',now()-interval '2 hours','Passada','passada@example.invalid',repeat('c2',32),now()-interval '1 day');
select set_config('request.jwt.claims','{"sub":"b7000000-0000-4000-8000-00000000000f","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.agenda_concluir('b7100000-0000-4000-8000-000000000002')$$,'42501',null,'visualizador não conclui');
reset role;select set_config('request.jwt.claims','{"sub":"b7000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select is(public.agenda_concluir('b7100000-0000-4000-8000-000000000002'),'concluida','editor conclui reserva já iniciada');
select is(public.agenda_concluir('b7100000-0000-4000-8000-000000000002'),'concluida','concluir de novo é idempotente');
select throws_ok($$select public.agenda_concluir((select id from public.agenda_reservas where contato_telefone='1133334444'))$$,'55000',null,'reserva futura não pode ser concluída');
select throws_ok($$select public.agenda_cancelar('b7100000-0000-4000-8000-000000000002','x')$$,'55000',null,'reserva concluída não cancela');

-- Reembolso manual (dono/admin)
select throws_ok($$select public.agenda_registrar_reembolso(current_setting('app.s2')::uuid)$$,'42501',null,'editor não registra reembolso');
reset role;select set_config('request.jwt.claims','{"sub":"b7000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.agenda_registrar_reembolso(current_setting('app.s2')::uuid),true,'dono registra o reembolso manual');
select is((select sinal_status from public.agenda_reservas where id=current_setting('app.s2')::uuid),'reembolsado','sinal marcado como reembolsado');
select throws_ok($$select public.agenda_registrar_reembolso(current_setting('app.h2')::uuid)$$,'55000',null,'sem reembolso pendente não há o que registrar');

-- Visualizador só lê
reset role;select set_config('request.jwt.claims','{"sub":"b7000000-0000-4000-8000-00000000000f","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.agenda_reservas)>5,true,'visualizador lê as reservas da organização');
select throws_ok($$select public.agenda_confirmar(current_setting('app.h3')::uuid)$$,'42501',null,'visualizador não confirma');
select throws_ok($$select public.agenda_cancelar(current_setting('app.h3')::uuid,null)$$,'42501',null,'visualizador não cancela');
select throws_ok($$select public.agenda_remarcar(current_setting('app.h3')::uuid,public._t_t('12:00'))$$,'42501',null,'visualizador não remarca');
select throws_ok($$select public.agenda_registrar_sinal(current_setting('app.h3')::uuid)$$,'42501',null,'visualizador não registra sinal');
select throws_ok($$select public.agenda_reservar_estudio(current_setting('app.rA')::uuid,public._t_t('10:00',5),'Visu','visu@example.invalid',null,repeat('ae',32))$$,'42501',null,'visualizador não reserva');
select throws_ok($$select public.agenda_vincular_cliente((select id from public.agenda_reservas limit 1))$$,'42501',null,'visualizador não vincula cliente');
select throws_ok($$update public.agenda_reservas set status='cancelada'$$,'42501',null,'sem UPDATE direto em reservas');
select throws_ok($$insert into public.agenda_reservas(organizacao_id,recurso_id,inicio,fim,ocupa_ate,contato_nome,contato_email,token_hash) values (current_setting('app.orgA')::uuid,current_setting('app.rA')::uuid,now(),now(),now(),'Xx','x@example.invalid',repeat('1',64))$$,'42501',null,'sem INSERT direto em reservas');

-- Isolamento entre organizações
reset role;select set_config('request.jwt.claims','{"sub":"b7000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.agenda_reservas),0,'outra organização não vê reservas');
select is((select count(*)::integer from public.agenda_reserva_eventos),0,'outra organização não vê a trilha');
select throws_ok($$select public.agenda_confirmar(current_setting('app.h3')::uuid)$$,'42501',null,'outra organização não confirma');
select throws_ok($$select public.agenda_cancelar(current_setting('app.h3')::uuid,null)$$,'42501',null,'outra organização não cancela');
select throws_ok($$select public.agenda_vincular_cliente(current_setting('app.h3')::uuid)$$,'42501',null,'outra organização não vincula cliente');
select throws_ok($$select public.agenda_reservar_estudio(current_setting('app.rA')::uuid,public._t_t('10:00',5),'Invasor','inv@example.invalid',null,repeat('af',32))$$,'42501',null,'outra organização não reserva na agenda alheia');

-- Cliente final e anônimo não operam
reset role;select set_config('request.jwt.claims','{"sub":"b7000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.agenda_confirmar(current_setting('app.h3')::uuid)$$,'42501',null,'cliente final autenticado não opera a agenda');
select is((select count(*)::integer from public.agenda_reservas),0,'cliente final autenticado não lê reservas');
reset role;select set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
select throws_ok($$select public.agenda_confirmar(current_setting('app.h3')::uuid)$$,'42501',null,'anon não chama RPC de equipe');
select throws_ok($$select * from public.agenda_i_slots(current_setting('app.rA')::uuid,current_date,current_date+1)$$,'42501',null,'anon não alcança o gerador interno de slots');
select throws_ok($$select public.agenda_i_criar(current_setting('app.rA')::uuid,now(),'xx yy','a@example.invalid',null,repeat('a',64),'cliente',null,true)$$,'42501',null,'anon não alcança a criação interna');
reset role;
select is(has_function_privilege('service_role','public.agenda_confirmar(uuid)','execute'),false,'service_role sem EXECUTE nas RPCs de equipe');
select is(has_function_privilege('service_role','public.agenda_criar_hold(text,timestamptz,text,text,text,text)','execute'),false,'service_role sem EXECUTE nas RPCs públicas');
select is(has_function_privilege('authenticated','public.agenda_i_travar(uuid)','execute'),false,'authenticated sem EXECUTE nos helpers internos');
select is(has_function_privilege('anon','public.agenda_criar_hold(text,timestamptz,text,text,text,text)','execute'),true,'anon executa apenas as RPCs públicas');
select is(has_function_privilege('anon','public.agenda_cancelar(uuid,text)','execute'),false,'anon não executa RPC de equipe');

-- Arquivar tira do ar
select set_config('request.jwt.claims','{"sub":"b7000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.agenda_arquivar_recurso(current_setting('app.rS')::uuid),true,'dono arquiva o recurso');
reset role;set local role anon;
select is(public.agenda_recurso_publico('sessao-sinal'),null::jsonb,'recurso arquivado some do público');
select throws_ok($$select public.agenda_criar_hold('sessao-sinal',public._t_t('15:00'),'Tarde Demais','tarde@example.invalid',null,repeat('a1',32))$$,'22023',null,'não se reserva recurso arquivado');
reset role;
select finish(); rollback;
