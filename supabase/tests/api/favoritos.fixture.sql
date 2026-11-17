-- Dados sintéticos exclusivos do harness HTTP. Banco descartável, sem remoto.
begin;
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s1-1@teste.local','{"role":"fotografo"}','{}',now(),now());
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('a1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s1-2@teste.local','{"role":"fotografo"}','{}',now(),now());
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('a1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s1-3@teste.local','{"role":"cliente"}','{}',now(),now());
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('a1000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s1-4@teste.local','{"role":"cliente"}','{}',now(),now());
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('a1000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s1-5@teste.local','{"role":"designer"}','{}',now(),now());
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('a1000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s1-6@teste.local','{"role":"operador"}','{}',now(),now());
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('a1000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s1-7@teste.local','{"role":"admin"}','{}',now(),now());
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('a1000000-0000-4000-8000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s1-8@teste.local','{"role":"gestor"}','{}',now(),now());
insert into public.clientes(id,user_id,fotografo_id,nome,email) values ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','Cliente sintético 1','c1@teste.local');
insert into public.projetos(id,nome,cliente_id,fotografo_id,responsavel_id,status) values ('a2000000-0000-4000-8000-000000000001','Projeto sintético 1','a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005','em_diagramacao');
insert into public.fotos(id,projeto_id,storage_path) values ('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','s1-1.jpg');
insert into public.clientes(id,user_id,fotografo_id,nome,email) values ('a3000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000002','Cliente sintético 2','c2@teste.local');
insert into public.projetos(id,nome,cliente_id,fotografo_id,responsavel_id,status) values ('a2000000-0000-4000-8000-000000000002','Projeto sintético 2','a3000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000006','em_diagramacao');
insert into public.fotos(id,projeto_id,storage_path) values ('a4000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','s1-2.jpg');


commit;
