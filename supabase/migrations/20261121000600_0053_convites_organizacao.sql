-- Convite por link para a equipe do estúdio (0051), para quem ainda não tem
-- conta. Padrão de mercado: link de uso único, validade de 7 dias, vinculado ao
-- e-mail convidado e revogável. O app gera o segredo e envia SÓ o hash; o banco
-- nunca guarda o token. Não há envio de e-mail aqui (exigiria provedor e custo):
-- o dono copia e compartilha o link. NÃO aplicada em ambiente remoto.
begin;

create table public.convites_organizacao (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  email          text not null check (length(email) between 5 and 254 and email = lower(email)),
  papel          text not null check (papel in ('admin', 'editor', 'visualizador')),
  token_hash     text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  criado_por     uuid references public.profiles (id) on delete set null,
  status         text not null default 'pendente' check (status in ('pendente', 'aceito', 'revogado')),
  aceito_por     uuid references public.profiles (id) on delete set null,
  aceito_em      timestamptz,
  expira_em      timestamptz not null default now() + interval '7 days',
  created_at     timestamptz not null default now(),
  constraint convites_aceite check ((status = 'aceito') = (aceito_em is not null))
);
create unique index uq_convite_pendente on public.convites_organizacao (organizacao_id, email) where status = 'pendente';
create index idx_convites_organizacao on public.convites_organizacao (organizacao_id, status);

alter table public.convites_organizacao enable row level security;
revoke all on table public.convites_organizacao from public, anon, authenticated;
-- Sem token_hash: nem o dono relê o segredo.
grant select (id, organizacao_id, email, papel, criado_por, status, aceito_por, aceito_em, expira_em, created_at)
  on table public.convites_organizacao to authenticated;
grant all on table public.convites_organizacao to service_role;
create policy convites_select on public.convites_organizacao for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) in ('dono', 'admin'));

create function public.criar_convite_organizacao(p_org uuid, p_email text, p_papel text, p_token_hash text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_meu text; v_email text; v_id uuid;
begin
  v_meu := public.papel_na_organizacao(p_org);
  if v_meu is null or v_meu not in ('dono', 'admin') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if p_papel is null or p_papel not in ('admin', 'editor', 'visualizador') or length(v_email) not between 5 and 254
     or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  if p_papel = 'admin' and v_meu <> 'dono' then raise exception 'Somente o dono convida administradores.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 53));
  -- Reemitir invalida o link anterior do mesmo e-mail.
  update public.convites_organizacao set status = 'revogado' where organizacao_id = p_org and email = v_email and status = 'pendente';
  if (select count(*) from public.convites_organizacao where organizacao_id = p_org and status = 'pendente' and expira_em > now()) >= 50 then
    raise exception 'Muitos convites pendentes.' using errcode = '22023'; end if;
  insert into public.convites_organizacao(organizacao_id, email, papel, token_hash, criado_por)
    values (p_org, v_email, p_papel, p_token_hash, auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.criar_convite_organizacao(uuid, text, text, text) from public, anon, service_role;
grant execute on function public.criar_convite_organizacao(uuid, text, text, text) to authenticated;

create function public.revogar_convite_organizacao(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.convites_organizacao; v_meu text;
begin
  select * into v from public.convites_organizacao where id = p_id;
  if not found then return false; end if;
  v_meu := public.papel_na_organizacao(v.organizacao_id);
  if v_meu is null or v_meu not in ('dono', 'admin') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if v.papel = 'admin' and v_meu <> 'dono' then raise exception 'Somente o dono revoga convite de administrador.' using errcode = '42501'; end if;
  update public.convites_organizacao set status = 'revogado' where id = p_id and status = 'pendente';
  return found;
end $$;
revoke all on function public.revogar_convite_organizacao(uuid) from public, anon, service_role;
grant execute on function public.revogar_convite_organizacao(uuid) to authenticated;

-- Aceite: uma única mensagem de erro para link inexistente, expirado, usado,
-- revogado ou de outro e-mail, para não permitir sondar convites.
create function public.aceitar_convite_organizacao(p_token_hash text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.convites_organizacao; v_perfil public.profiles;
begin
  if auth.uid() is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Convite inválido ou expirado.' using errcode = '22023'; end if;
  select * into v_perfil from public.profiles where id = auth.uid() and status = 'ativo' and role in ('fotografo', 'designer');
  if not found then raise exception 'Convite inválido ou expirado.' using errcode = '22023'; end if;
  select * into v from public.convites_organizacao where token_hash = p_token_hash for update;
  if not found or v.status <> 'pendente' or v.expira_em <= now() or v.email <> lower(v_perfil.email) then
    raise exception 'Convite inválido ou expirado.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v.organizacao_id::text, 51));
  -- Quem já é membro ativo não é rebaixado nem promovido pelo convite.
  insert into public.organizacao_membros(organizacao_id, user_id, papel, adicionado_por)
    values (v.organizacao_id, auth.uid(), v.papel, v.criado_por)
  on conflict (organizacao_id, user_id) do update
    set papel = excluded.papel, status = 'ativo', removido_em = null, adicionado_por = excluded.adicionado_por
    where public.organizacao_membros.status = 'removido';
  update public.convites_organizacao set status = 'aceito', aceito_por = auth.uid(), aceito_em = now() where id = v.id;
  return v.organizacao_id;
end $$;
revoke all on function public.aceitar_convite_organizacao(text) from public, anon, service_role;
grant execute on function public.aceitar_convite_organizacao(text) to authenticated;

commit;
