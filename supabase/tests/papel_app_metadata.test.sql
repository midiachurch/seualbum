-- Migration 0033: papel em app_metadata gravado DEPOIS do INSERT (como o
-- GoTrue faz em `auth.admin.createUser`). Rodar com `supabase test db`.

begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Como o GoTrue: INSERT só com provider, UPDATE com o papel logo depois.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operador@teste.local', '{"provider":"email"}', '{}', now(), now()),
  ('a2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'estudio@teste.local', '{"provider":"email"}', '{"estudio":"Estúdio Novo"}', now(), now()),
  ('a3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'antigo@teste.local', '{"provider":"email"}', '{}', now(), now());

select is((select role::text from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'), 'cliente',
  'no INSERT, sem papel em app_metadata, nasce cliente');

update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"operador"}'
 where id = 'a1000000-0000-4000-8000-000000000001';
select is((select role::text from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'), 'operador',
  'papel gravado logo depois do INSERT vale');

update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"fotografo"}'
 where id = 'a2000000-0000-4000-8000-000000000001';
select is((select role::text from public.profiles where id = 'a2000000-0000-4000-8000-000000000001'), 'fotografo',
  'fotógrafo criado pelo admin');
select is((select estudio from public.fotografos where id = 'a2000000-0000-4000-8000-000000000001'), 'Estúdio Novo',
  'fotógrafo ganha a linha em fotografos');

-- Papel já definido: trocar o app_metadata depois não muda o profile.
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
 where id = 'a1000000-0000-4000-8000-000000000001';
select is((select role::text from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'), 'operador',
  'só a primeira definição do papel conta');

-- Conta antiga (fora da janela de criação) não é promovida.
update public.profiles set created_at = now() - interval '1 day' where id = 'a3000000-0000-4000-8000-000000000001';
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
 where id = 'a3000000-0000-4000-8000-000000000001';
select is((select role::text from public.profiles where id = 'a3000000-0000-4000-8000-000000000001'), 'cliente',
  'conta antiga não vira equipe pelo app_metadata');

select * from finish();
rollback;
