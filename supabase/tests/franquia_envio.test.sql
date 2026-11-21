begin; create extension if not exists pgtap with schema extensions; select plan(10);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('e5000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','envio-1@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('e5000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','envio-2@example.invalid','{"role":"fotografo"}','{}',now(),now());
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.criar_galeria_digital('e6000000-0000-4000-8000-000000000001','Galeria Envio','Cliente','envio@example.invalid'); end $$;
reset role;
insert into public.fotos(projeto_id,storage_path,bucket,tamanho_bytes) values
('e6000000-0000-4000-8000-000000000001','projetos/e6000000-0000-4000-8000-000000000001/fotos/a.jpg','r2',9000000000);
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
select is(public.franquia_permite_envio('e6000000-0000-4000-8000-000000000001',50000000000),true,'sem plano ativo sempre permite');
do $$ begin perform public.escolher_plano_galeria('e7000000-0000-4000-8000-000000000001','essencial'); end $$;
select is(public.franquia_permite_envio('e6000000-0000-4000-8000-000000000001',1000000000),true,'cabe exatamente no limite (9 GB + 1 GB = 10 GB)');
select is(public.franquia_permite_envio('e6000000-0000-4000-8000-000000000001',1000000001),false,'um byte acima do limite é recusado');
select is(public.franquia_permite_envio('e6000000-0000-4000-8000-000000000001',1),true,'envio pequeno ainda cabe');
select throws_ok($$select public.franquia_permite_envio('e6000000-0000-4000-8000-000000000001',0)$$,'22023',null,'tamanho zero rejeitado');
select throws_ok($$select public.franquia_permite_envio('e6000000-0000-4000-8000-000000000001',null)$$,'22023',null,'tamanho nulo rejeitado');
do $$ begin perform public.escolher_plano_galeria('e7000000-0000-4000-8000-000000000002','profissional'); end $$;
select is(public.franquia_permite_envio('e6000000-0000-4000-8000-000000000001',50000000000),true,'plano maior libera o envio');
reset role;select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000002","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.franquia_permite_envio('e6000000-0000-4000-8000-000000000001',1)$$,'42501',null,'quem não vê o projeto não consulta a franquia dele');
reset role; set local role anon;
select throws_ok($$select public.franquia_permite_envio('e6000000-0000-4000-8000-000000000001',1)$$,'42501',null,'anon não consulta');
reset role;
select is((select count(*)::integer from public.fotos where projeto_id='e6000000-0000-4000-8000-000000000001'),1,'a consulta não altera dados');
select finish(); rollback;
