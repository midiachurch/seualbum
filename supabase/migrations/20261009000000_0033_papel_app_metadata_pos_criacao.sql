-- =============================================================================
-- Migration 0033: papel definido pelo admin em app_metadata, depois do INSERT
--
-- `auth.admin.createUser({ app_metadata: { role } })` (edge function
-- admin-create-user) NÃO grava o papel no INSERT em auth.users: o GoTrue cria o
-- usuário só com `provider`/`providers` e grava o restante do app_metadata num
-- UPDATE logo em seguida. `handle_new_user` (AFTER INSERT) não via o papel e o
-- profile nascia 'cliente' — operador, designer, gestor e admin criados pelo
-- painel entravam sem acesso à equipe.
--
-- Este gatilho completa o trabalho no UPDATE, com as mesmas regras:
--   * só quando app_metadata.role aparece pela PRIMEIRA vez (antes nulo) —
--     só a service role escreve em app_metadata;
--   * só num profile recém-criado (10 minutos) que ainda está com o papel
--     padrão 'cliente' — não serve para trocar o papel de conta antiga;
--   * papel 'fotografo' também ganha a linha em `fotografos`.
-- `guard_profile_role` (0028) aceita a troca pela flag de transação
-- `seualbum.cadastro_google`, que `set_config` liga só aqui dentro (não é
-- exposta pelo PostgREST).
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

create or replace function public.aplicar_papel_do_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role    public.platform_role;
  v_linhas  integer;
begin
  if old.raw_app_meta_data ->> 'role' is not null
     or coalesce(new.raw_app_meta_data ->> 'role', '') not in ('admin', 'gestor', 'operador', 'designer', 'fotografo', 'cliente') then
    return new;
  end if;
  v_role := (new.raw_app_meta_data ->> 'role')::public.platform_role;

  perform set_config('seualbum.cadastro_google', 'on', true);
  update public.profiles
     set role = v_role
   where id = new.id
     and role = 'cliente'
     and v_role <> 'cliente'
     and created_at > now() - interval '10 minutes';
  get diagnostics v_linhas = row_count;
  perform set_config('seualbum.cadastro_google', 'off', true);

  if v_linhas > 0 and v_role = 'fotografo' then
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

revoke execute on function public.aplicar_papel_do_app_metadata() from public, anon, authenticated;

drop trigger if exists on_auth_user_app_metadata on auth.users;
create trigger on_auth_user_app_metadata
  after update of raw_app_meta_data on auth.users
  for each row execute function public.aplicar_papel_do_app_metadata();
