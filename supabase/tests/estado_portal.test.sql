begin; create extension if not exists pgtap with schema extensions; select no_plan();
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('d1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','galeria-1@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('d1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','galeria-2@example.invalid','{"role":"fotografo"}','{}',now(),now());

select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
select public.criar_galeria_digital('d2000000-0000-4000-8000-000000000001','Galeria','Cliente','teste@example.invalid');
select is(public.estado_portal('d2000000-0000-4000-8000-000000000001')->>'estado','nao_criado','sem acesso antes da geração');
select public.gerir_portal('d2000000-0000-4000-8000-000000000001',repeat('a',64),'12345678');
select is(public.estado_portal('d2000000-0000-4000-8000-000000000001')->>'estado','ativo','estado ativo após criar');
select is((select count(*)::integer from jsonb_object_keys(public.estado_portal('d2000000-0000-4000-8000-000000000001'))),2,'somente estado e validade sem credenciais');
select ok((public.estado_portal('d2000000-0000-4000-8000-000000000001')->>'expiraEm')::timestamptz>now(),'validade futura');
select public.gerir_portal('d2000000-0000-4000-8000-000000000001',null,null,true);
select is(public.estado_portal('d2000000-0000-4000-8000-000000000001')->>'estado','revogado','revogação permanece consultável');
select public.gerir_portal('d2000000-0000-4000-8000-000000000001',repeat('b',64),'12345678');
reset role;
update public.portal_acessos set expira_em=now()-interval '1 day' where link_hash=repeat('b',64);
set local role authenticated;
select is(public.estado_portal('d2000000-0000-4000-8000-000000000001')->>'estado','expirado','expiração identificada');
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.estado_portal('d2000000-0000-4000-8000-000000000001')$$,'42501',null,'outro fotógrafo não consulta acesso');
reset role;
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('d1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','estado-admin@example.invalid','{"role":"admin"}','{}',now(),now());
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
update public.profiles set status='inativo' where id='d1000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.estado_portal('d2000000-0000-4000-8000-000000000001')$$,'42501',null,'dono inativo negado');
reset role;set local role anon;
select throws_ok($$select public.estado_portal('d2000000-0000-4000-8000-000000000001')$$,'42501',null,'anon não consulta metadados');
reset role;set local role service_role;
select throws_ok($$select public.estado_portal('d2000000-0000-4000-8000-000000000001')$$,'42501',null,'service role sem execução concedida');
reset role;select finish();rollback;
