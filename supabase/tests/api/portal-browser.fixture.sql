-- Dados sintéticos exclusivos. Banco do harness descartável, nunca remoto.
reset role;
select set_config('request.jwt.claims','{}',false);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('f1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portal-browser@example.invalid','{"role":"fotografo"}','{}',now(),now());
insert into public.clientes(id,fotografo_id,nome,email) values ('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Cliente browser sintético','portal-browser-client@example.invalid');
insert into public.projetos(id,nome,cliente_id,fotografo_id,status) values ('f2000000-0000-4000-8000-000000000001','Portal browser sintético','f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','em_diagramacao');
insert into public.fotos(id,projeto_id,storage_path,nome_original,bucket) values ('f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','projetos/f2000000-0000-4000-8000-000000000001/fotos/browser.jpg','browser.jpg','r2');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
set role authenticated;
select public.gerir_portal('f2000000-0000-4000-8000-000000000001',encode(extensions.digest(repeat('a',64),'sha256'),'hex'),'12345678');
reset role;
