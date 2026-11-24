begin; create extension if not exists pgtap with schema extensions; select plan(27);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('c5000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','conv-dono@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('c5000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','conv-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('c5000000-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','conv-c@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('c5000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','conv-cliente@example.invalid','{"role":"cliente"}','{}',now(),now());
select set_config('request.jwt.claims','{"sub":"c5000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.criar_convite_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'  Conv-B@Example.invalid ','editor','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') is not null,true,'dono cria convite (e-mail normalizado)');
select is((select email from public.convites_organizacao where status='pendente' limit 1),'conv-b@example.invalid','e-mail guardado em minúsculas');
select throws_ok($$select public.criar_convite_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'x@example.invalid','dono','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')$$,'22023',null,'não se convida dono');
select throws_ok($$select public.criar_convite_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'invalido','editor','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')$$,'22023',null,'e-mail inválido rejeitado');
select throws_ok($$select public.criar_convite_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'x@example.invalid','editor','curto')$$,'22023',null,'hash inválido rejeitado');
select throws_ok($$select token_hash from public.convites_organizacao$$,'42501',null,'ninguém relê o token_hash, nem o dono');
select is((select count(*)::integer from public.convites_organizacao),1,'dono lista os convites da organização');
-- Reemissão invalida o anterior
select is(public.criar_convite_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'conv-b@example.invalid','editor','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc') is not null,true,'reemitir cria novo link');
select is((select count(*)::integer from public.convites_organizacao where status='pendente'),1,'só um convite pendente por e-mail');
select is((select count(*)::integer from public.convites_organizacao where status='revogado'),1,'link anterior ficou revogado');
select throws_ok($$insert into public.convites_organizacao(organizacao_id,email,papel,token_hash) values ((select id from public.organizacoes where dono_id=auth.uid()),'z@example.invalid','editor','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')$$,'42501',null,'sem INSERT direto');
-- Aceite
reset role;select set_config('request.jwt.claims','{"sub":"c5000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.aceitar_convite_organizacao('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,'22023','Convite inválido ou expirado.','link revogado não aceita');
select throws_ok($$select public.aceitar_convite_organizacao('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')$$,'22023','Convite inválido ou expirado.','link inexistente tem a mesma mensagem');
select is(public.aceitar_convite_organizacao('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc') is not null,true,'convidado aceita com o link vigente');
select is(public.papel_na_organizacao((select id from public.organizacoes where dono_id='c5000000-0000-4000-8000-00000000000a')),'editor','vira editor');
select throws_ok($$select public.aceitar_convite_organizacao('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')$$,'22023','Convite inválido ou expirado.','link de uso único');
-- Outro e-mail não usa o link
reset role;select set_config('request.jwt.claims','{"sub":"c5000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.criar_convite_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'conv-c@example.invalid','visualizador','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd') is not null,true,'novo convite para C');
reset role;select set_config('request.jwt.claims','{"sub":"c5000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.aceitar_convite_organizacao('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')$$,'22023','Convite inválido ou expirado.','link de outro e-mail não funciona');
select is((select count(*)::integer from public.convites_organizacao),0,'editor não lista convites');
select throws_ok($$select public.criar_convite_organizacao((select id from public.organizacoes where dono_id='c5000000-0000-4000-8000-00000000000a'),'q@example.invalid','visualizador','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')$$,'42501',null,'editor não convida');
-- Cliente final não aceita
reset role;select set_config('request.jwt.claims','{"sub":"c5000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.aceitar_convite_organizacao('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')$$,'22023','Convite inválido ou expirado.','cliente final não aceita convite interno');
-- Expiração
reset role;
update public.convites_organizacao set expira_em = now() - interval '1 minute' where token_hash='dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
select set_config('request.jwt.claims','{"sub":"c5000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.aceitar_convite_organizacao('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')$$,'22023','Convite inválido ou expirado.','convite expirado não aceita');
-- Revogar
reset role;select set_config('request.jwt.claims','{"sub":"c5000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.criar_convite_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'conv-c@example.invalid','visualizador','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') is not null,true,'dono reemite para C');
select is(public.revogar_convite_organizacao((select id from public.convites_organizacao where email='conv-c@example.invalid' and status='pendente' limit 1)),true,'dono revoga convite pendente');
select is(public.revogar_convite_organizacao(gen_random_uuid()),false,'revogar inexistente é inofensivo');
reset role;select set_config('request.jwt.claims','{"sub":"c5000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.aceitar_convite_organizacao('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')$$,'22023','Convite inválido ou expirado.','convite revogado não aceita');
-- Anônimo
reset role; set local role anon;
select throws_ok($$select public.aceitar_convite_organizacao('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')$$,'42501',null,'anon não aceita');
reset role;
select finish(); rollback;
