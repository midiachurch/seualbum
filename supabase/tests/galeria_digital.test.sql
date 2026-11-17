begin; create extension if not exists pgtap with schema extensions; select plan(12);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('d1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','galeria-1@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('d1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','galeria-2@example.invalid','{"role":"fotografo"}','{}',now(),now());
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
select is(public.criar_galeria_digital('d2000000-0000-4000-8000-000000000001','Casamento','Cliente digital','cliente@example.invalid'),'d2000000-0000-4000-8000-000000000001'::uuid,'fotógrafo cria galeria sem pedido');
select is(public.criar_galeria_digital('d2000000-0000-4000-8000-000000000001','Casamento','Cliente digital','cliente@example.invalid'),'d2000000-0000-4000-8000-000000000001'::uuid,'retry não duplica galeria');
select is((select count(*)::integer from public.projetos where id='d2000000-0000-4000-8000-000000000001'),1,'um projeto persistido');
select is((select status::text from public.projetos where id='d2000000-0000-4000-8000-000000000001'),'projeto_criado','sem antecipar etapa de aprovação/produção');
select is((select count(*)::integer from public.clientes where fotografo_id=auth.uid()),1,'um cliente sem conta');
select is((select count(*)::integer from public.clientes where fotografo_id=auth.uid() and user_id is not null),0,'nenhuma identidade Auth fictícia');
select throws_ok($$select public.criar_galeria_digital('d2000000-0000-4000-8000-000000000001','Outro nome','Cliente digital','cliente@example.invalid')$$,'22023',null,'chave com payload diferente negada');
select throws_ok($$select public.criar_galeria_digital(gen_random_uuid(),'Galeria','Cliente','invalido')$$,'22023',null,'email inválido rejeitado');
reset role;select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.projetos where id='d2000000-0000-4000-8000-000000000001'),0,'outro fotógrafo não lê galeria');
select throws_ok($$select public.criar_galeria_digital('d2000000-0000-4000-8000-000000000001','Casamento','Cliente digital','cliente@example.invalid')$$,'42501',null,'outro fotógrafo não captura chave');
reset role; set local role anon;
select throws_ok($$select public.criar_galeria_digital(gen_random_uuid(),'Galeria','Cliente','cliente@example.invalid')$$,'42501',null,'anon não cria galeria');
reset role;
select is((select count(*)::integer from public.projeto_atividades where projeto_id='d2000000-0000-4000-8000-000000000001'),1,'criação gera um evento real');
select finish(); rollback;
