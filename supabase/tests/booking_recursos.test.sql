begin; create extension if not exists pgtap with schema extensions; select plan(50);
-- Booking: configuração de recursos, papéis, isolamento entre organizações e superfície de acesso.
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('b6000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ag-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('b6000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ag-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('b6000000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ag-editor@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('b6000000-0000-4000-8000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ag-viewer@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('b6000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ag-cliente@example.invalid','{"role":"cliente"}','{}',now(),now());
select set_config('app.orgA',(select id::text from public.organizacoes where dono_id='b6000000-0000-4000-8000-00000000000a'),true), set_config('app.orgB',(select id::text from public.organizacoes where dono_id='b6000000-0000-4000-8000-00000000000b'),true);

-- Dono monta a equipe e cria recursos
select set_config('request.jwt.claims','{"sub":"b6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.adicionar_membro_organizacao(current_setting('app.orgA')::uuid,'ag-editor@example.invalid','editor'),'b6000000-0000-4000-8000-00000000000e'::uuid,'equipe: editor adicionado');
select is(public.adicionar_membro_organizacao(current_setting('app.orgA')::uuid,'ag-viewer@example.invalid','visualizador'),'b6000000-0000-4000-8000-00000000000f'::uuid,'equipe: visualizador adicionado');
select is(set_config('app.rA',public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Estúdio principal','sessao-a','pessoa','Sessão de fotos','America/Sao_Paulo',60,15,30,120,60,24,null,false)::text,true) is not null,true,'dono cria recurso');
select is((select publicado from public.agenda_recursos where id=current_setting('app.rA')::uuid),false,'recurso nasce despublicado quando assim solicitado');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Outro','sessao-a','pessoa',null,'America/Sao_Paulo',60,0,30,0,30,0,null,false)$$,'22023',null,'endereço (slug) duplicado rejeitado');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Outro','fuso-ruim','pessoa',null,'Marte/Olimpo',60,0,30,0,30,0,null,false)$$,'22023',null,'fuso inválido rejeitado');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Outro','dur-ruim','pessoa',null,'America/Sao_Paulo',3,0,30,0,30,0,null,false)$$,'22023',null,'duração fora do intervalo rejeitada');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Outro','Slug Ruim!','pessoa',null,'America/Sao_Paulo',60,0,30,0,30,0,null,false)$$,'22023',null,'slug inválido rejeitado');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Outro','tipo-ruim','robo',null,'America/Sao_Paulo',60,0,30,0,30,0,null,false)$$,'22023',null,'tipo inválido rejeitado');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'X','nome-curto','pessoa',null,'America/Sao_Paulo',60,0,30,0,30,0,null,false)$$,'22023',null,'nome curto rejeitado');
select is(public.agenda_definir_disponibilidade(current_setting('app.rA')::uuid,'[{"dia":1,"inicio":"09:00","fim":"12:00"},{"dia":1,"inicio":"13:00","fim":"18:00"},{"dia":6,"inicio":"09:00","fim":"24:00"}]'::jsonb),3,'dono define a grade (duas janelas na segunda, sábado até 24:00)');
select throws_ok($$select public.agenda_definir_disponibilidade(current_setting('app.rA')::uuid,'[{"dia":1,"inicio":"09:00","fim":"12:00"},{"dia":1,"inicio":"11:00","fim":"13:00"}]'::jsonb)$$,'22023',null,'janelas sobrepostas no mesmo dia rejeitadas');
select throws_ok($$select public.agenda_definir_disponibilidade(current_setting('app.rA')::uuid,'[{"dia":9,"inicio":"09:00","fim":"12:00"}]'::jsonb)$$,'22023',null,'dia da semana inválido rejeitado');
select throws_ok($$select public.agenda_definir_disponibilidade(current_setting('app.rA')::uuid,'[{"dia":2,"inicio":"12:00","fim":"09:00"}]'::jsonb)$$,'22023',null,'fim antes do início rejeitado');
select throws_ok($$select public.agenda_definir_disponibilidade(current_setting('app.rA')::uuid,'{"dia":1}'::jsonb)$$,'22023',null,'grade precisa ser lista');
select is((select count(*)::integer from public.agenda_disponibilidade where recurso_id=current_setting('app.rA')::uuid),3,'grade anterior preservada após tentativa inválida (transação atômica)');
select is(public.agenda_definir_disponibilidade(current_setting('app.rA')::uuid,'[{"dia":1,"inicio":"09:00","fim":"12:00"},{"dia":1,"inicio":"13:00","fim":"18:00"},{"dia":6,"inicio":"09:00","fim":"24:00"}]'::jsonb),3,'reenviar a grade é idempotente');
select is((select count(*)::integer from public.agenda_disponibilidade where recurso_id=current_setting('app.rA')::uuid),3,'sem janelas duplicadas');

-- Público: só o que está publicado
reset role;select set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
select is(public.agenda_recurso_publico('sessao-a'),null::jsonb,'anon: recurso despublicado não aparece');
select is((select count(*)::integer from public.agenda_listar_slots('sessao-a',current_date,current_date+10)),0,'anon: recurso despublicado não lista slots');
reset role;select set_config('request.jwt.claims','{"sub":"b6000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,current_setting('app.rA')::uuid,'Estúdio principal','sessao-a','pessoa','Sessão de fotos','America/Sao_Paulo',60,15,30,120,60,24,null,true),current_setting('app.rA')::uuid,'dono publica o recurso (atualização)');
reset role;select set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
select is(public.agenda_recurso_publico('SESSAO-A')->>'nome','Estúdio principal','anon: recurso publicado aparece (slug sem diferenciar caixa)');
select is(public.agenda_recurso_publico('sessao-a') ? 'organizacao_id',false,'anon: dados públicos não trazem a organização interna');
select throws_ok($$select * from public.agenda_listar_slots('sessao-a',current_date,current_date+40)$$,'22023',null,'período público limitado a 31 dias');

-- Papéis
reset role;select set_config('request.jwt.claims','{"sub":"b6000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Editor Tenta','editor-tenta','pessoa',null,'America/Sao_Paulo',60,0,30,0,30,0,null,false)$$,'42501',null,'editor não configura recursos');
select throws_ok($$select public.agenda_definir_disponibilidade(current_setting('app.rA')::uuid,'[]'::jsonb)$$,'42501',null,'editor não altera a grade');
select is((select count(*)::integer from public.agenda_recursos),1,'editor lê os recursos da organização');
select is(set_config('app.b1',public.agenda_criar_bloqueio(current_setting('app.rA')::uuid,now()+interval '5 days',now()+interval '6 days','Folga')::text,true) is not null,true,'editor cria bloqueio');
select throws_ok($$select public.agenda_criar_bloqueio(current_setting('app.rA')::uuid,now()+interval '6 days',now()+interval '5 days',null)$$,'22023',null,'bloqueio com fim antes do início rejeitado');
select is(public.agenda_remover_bloqueio(current_setting('app.b1')::uuid),true,'editor remove bloqueio');
select throws_ok($$select public.agenda_remover_bloqueio(current_setting('app.b1')::uuid)$$,'42501',null,'remover bloqueio inexistente é recusado sem revelar nada');
reset role;select set_config('request.jwt.claims','{"sub":"b6000000-0000-4000-8000-00000000000f","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.agenda_recursos),1,'visualizador lê recursos');
select throws_ok($$select public.agenda_criar_bloqueio(current_setting('app.rA')::uuid,now()+interval '5 days',now()+interval '6 days',null)$$,'42501',null,'visualizador não bloqueia');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,current_setting('app.rA')::uuid,'Visu','sessao-a','pessoa',null,'America/Sao_Paulo',60,0,30,0,30,0,null,true)$$,'42501',null,'visualizador não edita recurso');
select throws_ok($$update public.agenda_recursos set publicado=false$$,'42501',null,'sem UPDATE direto em recursos');
select throws_ok($$delete from public.agenda_recursos$$,'42501',null,'sem DELETE direto em recursos');
select throws_ok($$insert into public.agenda_bloqueios(recurso_id,periodo) values (current_setting('app.rA')::uuid, tstzrange(now(),now()+interval '1 hour'))$$,'42501',null,'sem INSERT direto em bloqueios');

-- Isolamento entre organizações
reset role;select set_config('request.jwt.claims','{"sub":"b6000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.agenda_recursos),0,'outra organização não vê recursos');
select is((select count(*)::integer from public.agenda_disponibilidade),0,'outra organização não vê a grade');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Invasor','invasor','pessoa',null,'America/Sao_Paulo',60,0,30,0,30,0,null,false)$$,'42501',null,'não cria recurso na organização alheia');
select throws_ok($$select public.agenda_criar_bloqueio(current_setting('app.rA')::uuid,now()+interval '1 day',now()+interval '2 days',null)$$,'42501',null,'não bloqueia agenda alheia');
select throws_ok($$select public.agenda_arquivar_recurso(current_setting('app.rA')::uuid)$$,'42501',null,'não arquiva recurso alheio');
select throws_ok($$select public.agenda_listar_slots_estudio(current_setting('app.rA')::uuid,current_date,current_date+1)$$,'42501',null,'não lista slots internos de outra organização');
select is(set_config('app.rB',public.agenda_salvar_recurso(current_setting('app.orgB')::uuid,null,'Agenda B','agenda-b','espaco',null,'America/Sao_Paulo',60,0,30,0,30,24,null,true)::text,true) is not null,true,'organização B cria o próprio recurso');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgB')::uuid,current_setting('app.rA')::uuid,'Sequestro','sequestro','pessoa',null,'America/Sao_Paulo',60,0,30,0,30,0,null,true)$$,'22023',null,'não se edita recurso alheio informando a própria organização');

-- Cliente final e anônimo
reset role;select set_config('request.jwt.claims','{"sub":"b6000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.agenda_recursos),0,'cliente final autenticado não é membro e não lê recursos');
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Cli','cli-rec','pessoa',null,'America/Sao_Paulo',60,0,30,0,30,0,null,false)$$,'42501',null,'cliente final não cria recurso');
reset role;select set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
select throws_ok($$select public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Anon','anon-rec','pessoa',null,'America/Sao_Paulo',60,0,30,0,30,0,null,false)$$,'42501',null,'anon não cria recurso');
reset role;
select is(has_table_privilege('anon','public.agenda_reservas','select'),false,'anon sem acesso à tabela de reservas');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'agenda\_%' and p.prosecdef and coalesce(p.proconfig::text,'') not like '%search_path=public, pg_temp%'),0,'toda função SECURITY DEFINER da agenda fixa o search_path');
select finish(); rollback;
