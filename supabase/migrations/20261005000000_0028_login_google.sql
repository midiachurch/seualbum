-- =============================================================================
-- Migration 0028: login e cadastro com Google
--
-- 1. `handle_new_user` passa a ler o nome que o Google manda (`full_name` /
--    `name` em raw_user_meta_data) — antes o profile nascia com o pedaço do
--    e-mail antes do @.
--
-- 2. OAuth não aceita `options.data` como o signUp por e-mail, então quem clica
--    "Criar conta com Google" em /auth/register nasce 'cliente' (regra da 0014).
--    `concluir_cadastro_google()` promove esse usuário recém-criado a
--    'fotografo' — o mesmo papel que o cadastro público já concede a qualquer um.
--    Só vale para:
--      - o próprio usuário (auth.uid());
--      - profile ainda 'cliente' e criado há menos de 30 minutos;
--      - sem papel definido pelo admin (raw_app_meta_data.role vazio) — um
--        cliente convidado por um estúdio nunca vira fotógrafo por aqui.
--
-- 3. `guard_profile_role` aceita a troca de papel quando a flag de transação
--    `seualbum.cadastro_google` está ligada — só a função acima a liga, e
--    `set_config` não é exposta pelo PostgREST.
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
    when new.raw_app_meta_data ->> 'role' in ('admin', 'gestor', 'operador', 'designer', 'fotografo', 'cliente')
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
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
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

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_admin()
     and coalesce(current_setting('seualbum.cadastro_google', true), '') <> 'on' then
    raise exception 'Alteração de papel/status não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profile_role() from public, anon, authenticated;

create or replace function public.concluir_cadastro_google()
returns public.platform_role
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.platform_role;
  v_criado timestamptz;
  v_app_role text;
  v_nome text;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select p.role, u.created_at, u.raw_app_meta_data ->> 'role',
         coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''))
    into v_role, v_criado, v_app_role, v_nome
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = v_uid;

  -- Conta antiga, convidada pelo admin ou já com outro papel: não mexe.
  if v_role is distinct from 'cliente'::public.platform_role
     or v_app_role is not null
     or v_criado < now() - interval '30 minutes' then
    return v_role;
  end if;

  perform set_config('seualbum.cadastro_google', 'on', true);
  update public.profiles set role = 'fotografo' where id = v_uid;
  perform set_config('seualbum.cadastro_google', 'off', true);

  insert into public.fotografos (id, estudio)
  values (v_uid, case when char_length(v_nome) >= 2 then left(v_nome, 120) else 'Novo Estúdio' end)
  on conflict (id) do nothing;

  return 'fotografo'::public.platform_role;
end;
$$;

revoke execute on function public.concluir_cadastro_google() from public, anon;
grant execute on function public.concluir_cadastro_google() to authenticated;
