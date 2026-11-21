-- G04 coleções (sets) e G06 download autorizado da galeria.
-- Coleção é uma VISÃO sobre as mesmas fotos (um original canônico; a foto pode
-- estar em várias coleções), sem duplicar mídia nem dar acesso transversal: leitura
-- segue quem já lê o projeto; escrita só do dono do projeto e de editor+ da
-- organização (0054). Download: DESLIGADO por padrão; o estúdio libera por galeria,
-- com validade e limite por acesso (padrão de mercado), e cada baixada é registrada.
-- O original nunca é público: o servidor só assina URL curta depois do RPC.
-- NÃO aplicada em ambiente remoto.
begin;

create function public.pode_gerir_galeria(p_projeto uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null
     and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.status = 'ativo')
     and (exists (select 1 from public.projetos p where p.id = p_projeto and p.fotografo_id = auth.uid())
          or public.pode_editar_projeto_org(p_projeto))
$$;
revoke all on function public.pode_gerir_galeria(uuid) from public, anon, service_role;
grant execute on function public.pode_gerir_galeria(uuid) to authenticated;

create table public.colecoes_foto (
  id         uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  nome       text not null check (length(trim(nome)) between 2 and 80),
  ordem      integer not null default 0 check (ordem between 0 and 10000),
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index uq_colecao_nome on public.colecoes_foto (projeto_id, lower(trim(nome)));
create index idx_colecoes_projeto on public.colecoes_foto (projeto_id, ordem);

create table public.colecao_fotos (
  colecao_id uuid not null references public.colecoes_foto (id) on delete cascade,
  foto_id    uuid not null references public.fotos (id) on delete cascade,
  primary key (colecao_id, foto_id)
);
create index idx_colecao_fotos_foto on public.colecao_fotos (foto_id);

create table public.galeria_download_config (
  projeto_id    uuid primary key references public.projetos (id) on delete cascade,
  liberado      boolean not null default false,
  expira_em     timestamptz,
  limite_fotos  integer not null default 500 check (limite_fotos between 1 and 5000),
  atualizado_por uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now()
);

create table public.galeria_downloads (
  acesso_id   uuid not null references public.portal_acessos (id) on delete cascade,
  foto_id     uuid not null references public.fotos (id) on delete cascade,
  projeto_id  uuid not null references public.projetos (id) on delete cascade,
  vezes       integer not null default 1,
  primeiro_em timestamptz not null default now(),
  ultimo_em   timestamptz not null default now(),
  primary key (acesso_id, foto_id)
);
create index idx_galeria_downloads_projeto on public.galeria_downloads (projeto_id);

alter table public.colecoes_foto enable row level security;
alter table public.colecao_fotos enable row level security;
alter table public.galeria_download_config enable row level security;
alter table public.galeria_downloads enable row level security;
revoke all on table public.colecoes_foto, public.colecao_fotos, public.galeria_download_config, public.galeria_downloads from public, anon, authenticated;
grant select on table public.colecoes_foto, public.colecao_fotos, public.galeria_download_config, public.galeria_downloads to authenticated;
grant all on table public.colecoes_foto, public.colecao_fotos, public.galeria_download_config, public.galeria_downloads to service_role;

create policy colecoes_select on public.colecoes_foto for select to authenticated
  using (public.pode_ver_projeto(projeto_id) or public.pode_ler_projeto_org(projeto_id));
create policy colecao_fotos_select on public.colecao_fotos for select to authenticated
  using (exists (select 1 from public.colecoes_foto c where c.id = colecao_id
                  and (public.pode_ver_projeto(c.projeto_id) or public.pode_ler_projeto_org(c.projeto_id))));
create policy download_config_select on public.galeria_download_config for select to authenticated
  using (public.pode_ver_projeto(projeto_id) or public.pode_ler_projeto_org(projeto_id));
-- Quem baixou o quê: só quem gere a galeria.
create policy downloads_select on public.galeria_downloads for select to authenticated using (public.pode_gerir_galeria(projeto_id));

-- G04: criar/renomear coleção (idempotente pelo id).
create function public.salvar_colecao(p_id uuid, p_projeto uuid, p_nome text, p_ordem integer default 0) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.colecoes_foto;
begin
  if not public.pode_gerir_galeria(p_projeto) then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_id is null or p_nome is null or length(trim(p_nome)) not between 2 and 80 or p_ordem is null or p_ordem not between 0 and 10000 then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 56));
  select * into v from public.colecoes_foto where id = p_id;
  if found then
    if v.projeto_id <> p_projeto then raise exception 'Sem permissão.' using errcode = '42501'; end if;
    if exists (select 1 from public.colecoes_foto where projeto_id = p_projeto and id <> p_id and lower(trim(nome)) = lower(trim(p_nome))) then
      raise exception 'Já existe uma coleção com esse nome.' using errcode = '22023'; end if;
    update public.colecoes_foto set nome = trim(p_nome), ordem = p_ordem where id = p_id;
  else
    if (select count(*) from public.colecoes_foto where projeto_id = p_projeto) >= 50 then raise exception 'Limite de coleções atingido.' using errcode = '22023'; end if;
    if exists (select 1 from public.colecoes_foto where projeto_id = p_projeto and lower(trim(nome)) = lower(trim(p_nome))) then
      raise exception 'Já existe uma coleção com esse nome.' using errcode = '22023'; end if;
    insert into public.colecoes_foto(id, projeto_id, nome, ordem, criado_por) values (p_id, p_projeto, trim(p_nome), p_ordem, auth.uid());
  end if;
  return p_id;
end $$;
revoke all on function public.salvar_colecao(uuid, uuid, text, integer) from public, anon, service_role;
grant execute on function public.salvar_colecao(uuid, uuid, text, integer) to authenticated;

-- Remover a coleção NÃO remove as fotos: só a visão.
create function public.remover_colecao(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto uuid;
begin
  select projeto_id into v_projeto from public.colecoes_foto where id = p_id;
  if not found then return false; end if;
  if not public.pode_gerir_galeria(v_projeto) then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  delete from public.colecoes_foto where id = p_id;
  return true;
end $$;
revoke all on function public.remover_colecao(uuid) from public, anon, service_role;
grant execute on function public.remover_colecao(uuid) to authenticated;

-- Estado desejado (idempotente, como o favorito): o conjunto passa a ser exatamente este.
create function public.definir_fotos_colecao(p_colecao uuid, p_foto_ids uuid[]) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_projeto uuid; v_ids uuid[];
begin
  select projeto_id into v_projeto from public.colecoes_foto where id = p_colecao;
  if not found or not public.pode_gerir_galeria(v_projeto) then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_foto_ids is null then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_foto_ids) x where x is not null;
  if cardinality(v_ids) > 1000 then raise exception 'Máximo de 1000 fotos por coleção.' using errcode = '22023'; end if;
  if (select count(*) from public.fotos where projeto_id = v_projeto and id = any (v_ids)) <> cardinality(v_ids) then
    raise exception 'Foto de outro projeto.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_colecao::text, 56));
  delete from public.colecao_fotos where colecao_id = p_colecao and not (foto_id = any (v_ids));
  insert into public.colecao_fotos(colecao_id, foto_id) select p_colecao, x from unnest(v_ids) x on conflict do nothing;
  return cardinality(v_ids);
end $$;
revoke all on function public.definir_fotos_colecao(uuid, uuid[]) from public, anon, service_role;
grant execute on function public.definir_fotos_colecao(uuid, uuid[]) to authenticated;

-- G06: configuração de download por galeria.
create function public.definir_download_galeria(p_projeto uuid, p_liberado boolean, p_expira_em timestamptz, p_limite integer) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.pode_gerir_galeria(p_projeto) then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_liberado is null or p_limite is null or p_limite not between 1 and 5000 or (p_expira_em is not null and p_expira_em <= now()) then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  insert into public.galeria_download_config(projeto_id, liberado, expira_em, limite_fotos, atualizado_por, updated_at)
    values (p_projeto, p_liberado, p_expira_em, p_limite, auth.uid(), now())
  on conflict (projeto_id) do update set liberado = excluded.liberado, expira_em = excluded.expira_em,
    limite_fotos = excluded.limite_fotos, atualizado_por = excluded.atualizado_por, updated_at = now();
  return true;
end $$;
revoke all on function public.definir_download_galeria(uuid, boolean, timestamptz, integer) from public, anon, service_role;
grant execute on function public.definir_download_galeria(uuid, boolean, timestamptz, integer) to authenticated;

-- Portal (comprador/cliente convidado): coleções com contagem.
create function public.portal_colecoes(p_sessao_hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.portal_acessos;
begin
  a := private.portal_validar(p_sessao_hash);
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome,
            'total', (select count(*) from public.colecao_fotos cf where cf.colecao_id = c.id)) order by c.ordem, c.nome)
     from public.colecoes_foto c where c.projeto_id = a.projeto_id), '[]'::jsonb);
end $$;
revoke all on function public.portal_colecoes(text) from public, service_role;
grant execute on function public.portal_colecoes(text) to anon, authenticated;

-- Fotos de uma coleção, no mesmo formato e paginação (cursor por id) do portal_projeto.
create function public.portal_fotos_colecao(p_sessao_hash text, p_colecao uuid, p_apos uuid default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.portal_acessos;
begin
  a := private.portal_validar(p_sessao_hash);
  if not exists (select 1 from public.colecoes_foto where id = p_colecao and projeto_id = a.projeto_id) then
    raise exception 'Coleção indisponível.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x) from (
      select f.id, f.grupo, f.favorita, f.nome_original
        from public.colecao_fotos cf join public.fotos f on f.id = cf.foto_id
       where cf.colecao_id = p_colecao and f.projeto_id = a.projeto_id and (p_apos is null or f.id > p_apos)
       order by f.id limit 100) x), '[]'::jsonb);
end $$;
revoke all on function public.portal_fotos_colecao(text, uuid, uuid) from public, service_role;
grant execute on function public.portal_fotos_colecao(text, uuid, uuid) to anon, authenticated;

create function public.portal_download_config(p_sessao_hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.portal_acessos; c public.galeria_download_config;
begin
  a := private.portal_validar(p_sessao_hash);
  select * into c from public.galeria_download_config where projeto_id = a.projeto_id;
  return jsonb_build_object(
    'liberado', coalesce(c.liberado and (c.expira_em is null or c.expira_em > now()), false),
    'expira_em', c.expira_em, 'limite', coalesce(c.limite_fotos, 0),
    'usados', (select count(*) from public.galeria_downloads where acesso_id = a.id));
end $$;
revoke all on function public.portal_download_config(text) from public, service_role;
grant execute on function public.portal_download_config(text) to anon, authenticated;

-- Baixar UMA foto: exige liberação vigente; limite por acesso conta fotos distintas;
-- repetir a mesma foto não gasta limite. Devolve só o necessário para assinar.
create function public.portal_download_foto(p_sessao_hash text, p_foto_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.portal_acessos; c public.galeria_download_config; v jsonb; v_ja boolean;
begin
  a := private.portal_validar(p_sessao_hash);
  select * into c from public.galeria_download_config where projeto_id = a.projeto_id;
  if not found or not c.liberado or (c.expira_em is not null and c.expira_em <= now()) then
    raise exception 'Download não liberado.' using errcode = '42501'; end if;
  select jsonb_build_object('bucket', bucket, 'path', storage_path, 'nome', nome_original) into v
    from public.fotos where projeto_id = a.projeto_id and id = p_foto_id;
  if v is null then raise exception 'Foto indisponível.' using errcode = '42501'; end if;
  select exists (select 1 from public.galeria_downloads where acesso_id = a.id and foto_id = p_foto_id) into v_ja;
  if not v_ja and (select count(*) from public.galeria_downloads where acesso_id = a.id) >= c.limite_fotos then
    raise exception 'Limite de downloads atingido.' using errcode = '22023'; end if;
  insert into public.galeria_downloads(acesso_id, foto_id, projeto_id) values (a.id, p_foto_id, a.projeto_id)
    on conflict (acesso_id, foto_id) do update set vezes = public.galeria_downloads.vezes + 1, ultimo_em = now();
  return v;
end $$;
revoke all on function public.portal_download_foto(text, uuid) from public, service_role;
grant execute on function public.portal_download_foto(text, uuid) to anon, authenticated;

commit;
