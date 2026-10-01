-- Fecha os avisos do advisor de segurança:
-- 1) set_updated_at sem search_path fixo (mutable search_path).
-- 2) Funções de gatilho (só devem rodar via trigger) expostas como RPC pública.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_role() from public, anon, authenticated;
revoke execute on function public.guard_fotografo_admin_fields() from public, anon, authenticated;
revoke execute on function public.aplicar_aprovacao() from public, anon, authenticated;
