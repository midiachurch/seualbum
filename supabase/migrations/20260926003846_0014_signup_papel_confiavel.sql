-- =============================================================================
-- Migration 0014: papel do usuário novo só vem de fonte confiável
--
-- FALHA CORRIGIDA: `handle_new_user` lia o papel de `raw_user_meta_data`, que
-- o próprio navegador define no `supabase.auth.signUp({ options: { data } })`
-- com a chave pública. Qualquer pessoa podia se cadastrar com
-- `data: { role: 'admin' }` e virar admin.
--
-- Agora:
--   - `raw_app_meta_data.role` (só a service role escreve — é o que a edge
--     function `admin-create-user` passa a usar) define qualquer papel;
--   - `raw_user_meta_data.role` (cadastro público) só pode virar 'fotografo';
--   - qualquer outra coisa vira 'cliente'.
--
-- DEPENDÊNCIA: aplicar junto com o deploy da edge function `admin-create-user`
-- que envia `app_metadata: { role }`. Sem ela, membros de equipe criados pelo
-- admin nasceriam como 'cliente'.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.platform_role;
begin
  v_role := case
    when new.raw_app_meta_data ->> 'role' in ('admin', 'gestor', 'operador', 'fotografo', 'cliente')
      then (new.raw_app_meta_data ->> 'role')::public.platform_role
    when new.raw_user_meta_data ->> 'role' = 'fotografo'
      then 'fotografo'::public.platform_role
    else 'cliente'::public.platform_role
  end;

  insert into public.profiles (id, email, nome_completo, telefone, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'nome_contato'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
    v_role
  )
  on conflict (id) do nothing;

  if v_role = 'fotografo' then
    insert into public.fotografos (id, estudio)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'estudio'), ''), nullif(trim(new.raw_user_meta_data ->> 'nome_estudio'), ''), 'Novo Estúdio')
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
