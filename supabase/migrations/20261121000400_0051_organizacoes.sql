-- Organização (estúdio) e membros internos — fundação do ADR-002.
-- ADITIVA: não altera nenhuma policy/RLS existente nem o acesso atual por
-- fotografo_id. Cria a unidade comercial, a equipe e o vínculo do projeto,
-- para que políticas multi-organização sejam ensaiadas depois (sombra, sem
-- ampliar acesso). Clientes finais NÃO são membros: seguem por concessão por
-- recurso. Papéis seguem o padrão de mercado de plataformas de fotógrafos:
-- dono, admin, editor (produz), visualizador (somente leitura).
-- NÃO aplicada em ambiente remoto.
begin;

create table public.organizacoes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) between 2 and 120),
  dono_id    uuid not null unique references public.fotografos (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.organizacoes is
  'Unidade comercial do estúdio (0051). Uma por fotógrafo legado, preservando o proprietário atual; acompanha o ciclo de vida da conta (exclusão de conta não pode ser bloqueada). Mudanças de titularidade exigem processo próprio.';

create table public.organizacao_membros (
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  papel          text not null check (papel in ('dono', 'admin', 'editor', 'visualizador')),
  status         text not null default 'ativo' check (status in ('ativo', 'removido')),
  adicionado_por uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  removido_em    timestamptz,
  primary key (organizacao_id, user_id),
  constraint organizacao_membros_remocao check ((status = 'removido') = (removido_em is not null))
);
-- Exatamente um dono ativo por organização.
create unique index uq_organizacao_dono_ativo on public.organizacao_membros (organizacao_id) where papel = 'dono' and status = 'ativo';
create index idx_organizacao_membros_user on public.organizacao_membros (user_id) where status = 'ativo';

alter table public.organizacoes enable row level security;
alter table public.organizacao_membros enable row level security;
revoke all on table public.organizacoes, public.organizacao_membros from public, anon, authenticated;
grant select on table public.organizacoes, public.organizacao_membros to authenticated;
grant all on table public.organizacoes, public.organizacao_membros to service_role;

-- Papel do usuário logado numa organização (nulo se não for membro ativo).
create function public.papel_na_organizacao(p_org uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select m.papel from public.organizacao_membros m
   where m.organizacao_id = p_org and m.user_id = auth.uid() and m.status = 'ativo'
$$;
revoke all on function public.papel_na_organizacao(uuid) from public, anon, service_role;
grant execute on function public.papel_na_organizacao(uuid) to authenticated;

create policy organizacoes_select on public.organizacoes for select to authenticated
  using (public.papel_na_organizacao(id) is not null);
create policy organizacao_membros_select on public.organizacao_membros for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);

-- Cada fotógrafo ganha sua organização e vira dono. Cobre os cinco pontos de
-- criação existentes sem alterar nenhum deles.
create function public.fotografos_criar_organizacao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid;
begin
  insert into public.organizacoes(nome, dono_id) values (new.estudio, new.id)
    on conflict (dono_id) do nothing returning id into v_org;
  if v_org is not null then
    insert into public.organizacao_membros(organizacao_id, user_id, papel, adicionado_por)
    values (v_org, new.id, 'dono', new.id);
  end if;
  return new;
end $$;
revoke all on function public.fotografos_criar_organizacao() from public, anon, authenticated, service_role;
create trigger trg_fotografos_criar_organizacao after insert on public.fotografos
  for each row execute function public.fotografos_criar_organizacao();

-- Backfill: preserva IDs e proprietário dos estúdios existentes.
insert into public.organizacoes(nome, dono_id) select f.estudio, f.id from public.fotografos f on conflict (dono_id) do nothing;
insert into public.organizacao_membros(organizacao_id, user_id, papel, adicionado_por)
  select o.id, o.dono_id, 'dono', o.dono_id from public.organizacoes o
  on conflict (organizacao_id, user_id) do nothing;

-- Vínculo do projeto com a organização. Nulo é permitido (compatibilidade);
-- a autorização continua sendo por fotografo_id até as policies multi-org
-- serem ensaiadas.
alter table public.projetos add column organizacao_id uuid references public.organizacoes (id) on delete set null;
update public.projetos p set organizacao_id = o.id from public.organizacoes o where o.dono_id = p.fotografo_id and p.organizacao_id is null;
create index idx_projetos_organizacao on public.projetos (organizacao_id);
create function public.projetos_definir_organizacao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.organizacao_id is null and new.fotografo_id is not null then
    select o.id into new.organizacao_id from public.organizacoes o where o.dono_id = new.fotografo_id;
  end if;
  return new;
end $$;
revoke all on function public.projetos_definir_organizacao() from public, anon, authenticated, service_role;
create trigger trg_projetos_definir_organizacao before insert on public.projetos
  for each row execute function public.projetos_definir_organizacao();

-- Equipe: adicionar membro já cadastrado (sem envio de e-mail/convite nesta etapa).
create function public.adicionar_membro_organizacao(p_org uuid, p_email text, p_papel text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_meu text; v_alvo public.profiles;
begin
  v_meu := public.papel_na_organizacao(p_org);
  if v_meu is null or v_meu not in ('dono', 'admin') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_papel is null or p_papel not in ('admin', 'editor', 'visualizador') or p_email is null or length(p_email) > 254 then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  if p_papel = 'admin' and v_meu <> 'dono' then raise exception 'Somente o dono promove administradores.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 51));
  select * into v_alvo from public.profiles where lower(email) = lower(trim(p_email)) and status = 'ativo' and role in ('fotografo', 'designer');
  if not found then raise exception 'Pessoa não encontrada.' using errcode = '22023'; end if;
  -- Só o dono altera quem já é admin (admin não rebaixa admin).
  if v_meu <> 'dono' and exists (select 1 from public.organizacao_membros
      where organizacao_id = p_org and user_id = v_alvo.id and papel = 'admin' and status = 'ativo') then
    raise exception 'Somente o dono altera administradores.' using errcode = '42501'; end if;
  insert into public.organizacao_membros(organizacao_id, user_id, papel, adicionado_por)
    values (p_org, v_alvo.id, p_papel, auth.uid())
  on conflict (organizacao_id, user_id) do update
    set papel = excluded.papel, status = 'ativo', removido_em = null, adicionado_por = auth.uid()
    where public.organizacao_membros.papel <> 'dono';
  if not found then raise exception 'O dono não pode ser alterado.' using errcode = '42501'; end if;
  return v_alvo.id;
end $$;
revoke all on function public.adicionar_membro_organizacao(uuid, text, text) from public, anon, service_role;
grant execute on function public.adicionar_membro_organizacao(uuid, text, text) to authenticated;

create function public.remover_membro_organizacao(p_org uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_meu text; v_alvo public.organizacao_membros;
begin
  v_meu := public.papel_na_organizacao(p_org);
  if v_meu is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 51));
  select * into v_alvo from public.organizacao_membros where organizacao_id = p_org and user_id = p_user and status = 'ativo';
  if not found then return false; end if;
  if v_alvo.papel = 'dono' then raise exception 'O dono não pode ser removido.' using errcode = '42501'; end if;
  -- Admin remove editor/visualizador; só o dono remove admin; qualquer membro pode sair.
  if p_user <> auth.uid() and not (v_meu = 'dono' or (v_meu = 'admin' and v_alvo.papel in ('editor', 'visualizador'))) then
    raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.organizacao_membros set status = 'removido', removido_em = now() where organizacao_id = p_org and user_id = p_user;
  return true;
end $$;
revoke all on function public.remover_membro_organizacao(uuid, uuid) from public, anon, service_role;
grant execute on function public.remover_membro_organizacao(uuid, uuid) to authenticated;

-- Listagem da equipe para quem é membro ativo (nome/e-mail dos colegas sem abrir profiles).
create function public.listar_equipe_organizacao(p_org uuid)
returns table (user_id uuid, nome text, email text, papel text, status text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if public.papel_na_organizacao(p_org) is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return query
    select m.user_id, p.nome_completo, p.email, m.papel, m.status
      from public.organizacao_membros m join public.profiles p on p.id = m.user_id
     where m.organizacao_id = p_org and m.status = 'ativo'
     order by case m.papel when 'dono' then 0 when 'admin' then 1 when 'editor' then 2 else 3 end, p.nome_completo;
end $$;
revoke all on function public.listar_equipe_organizacao(uuid) from public, anon, service_role;
grant execute on function public.listar_equipe_organizacao(uuid) to authenticated;

commit;
