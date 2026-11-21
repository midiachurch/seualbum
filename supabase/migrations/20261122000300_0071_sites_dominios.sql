-- SITES (W03): domínio próprio com titularidade verificada por TXT e leitura
-- pública resolvida por slug ou por host. ADITIVA; depende da 0070.
-- Decisões de mercado (Vercel/Squarespace/Pixieset): o domínio só vale depois
-- de provar controle do DNS (registro TXT com token por registro); só o
-- domínio VERIFICADO é exclusivo (pedidos pendentes não "reservam" o nome:
-- quem provar o DNS primeiro fica com ele, os demais caem para `falhou`);
-- ativar é um passo explícito, separado da verificação.
-- Confirmação de DNS: o banco não consulta DNS. O servidor do app consulta
-- (resolver injetável) e atesta pelo RPC `confirmar_verificacao_dominio`,
-- liberado SOMENTE ao service_role e SOMENTE para uma verificação que um
-- dono/admin solicitou nos últimos 15 minutos (`preparar_verificacao_dominio`).
-- O service role não concede acesso nem pula autorização de usuário.
-- NÃO aplicada em ambiente remoto.
begin;

create table public.site_dominios (
  id                        uuid primary key default gen_random_uuid(),
  site_id                   uuid not null references public.sites (id) on delete cascade,
  organizacao_id            uuid not null references public.organizacoes (id) on delete cascade,
  dominio                   text not null check (
    dominio = lower(dominio) and length(dominio) <= 253
    and dominio ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$'
  ),
  status                    text not null default 'pendente' check (status in ('pendente', 'verificado', 'falhou')),
  token                     text not null check (token ~ '^seualbum-verificacao=[0-9a-f]{32}$'),
  ativo                     boolean not null default false,
  verificacao_solicitada_em timestamptz,
  verificado_em             timestamptz,
  falhou_em                 timestamptz,
  falhou_motivo             text check (falhou_motivo is null or falhou_motivo in ('registro_nao_encontrado', 'dominio_verificado_por_outro', 'dominio_em_uso')),
  criado_por                uuid references public.profiles (id) on delete set null,
  created_at                timestamptz not null default now(),
  unique (site_id, dominio),
  constraint site_dominios_ativo_verificado check (not ativo or status = 'verificado'),
  constraint site_dominios_verificado_em check ((status = 'verificado') = (verificado_em is not null))
);
-- Um domínio verificado pertence a no máximo um site.
create unique index uq_site_dominio_verificado on public.site_dominios (dominio) where status = 'verificado';
create index idx_site_dominios_site on public.site_dominios (site_id);
comment on table public.site_dominios is
  'Domínios próprios do site (0070/0071). TXT _seualbum-verificacao.{dominio} = token prova a titularidade. Só verificado+ativo resolve host→site. O roteamento por host depende de DNS/infraestrutura (ver docs).';

alter table public.site_dominios enable row level security;
revoke all on table public.site_dominios from public, anon, authenticated;
grant select on table public.site_dominios to authenticated;
grant all on table public.site_dominios to service_role;
create policy site_dominios_select on public.site_dominios for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);

create function public._site_dominio_normalizar(p text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select regexp_replace(lower(trim(coalesce(p, ''))), '\.$', '')
$$;
revoke all on function public._site_dominio_normalizar(text) from public, anon, authenticated, service_role;

create function public.adicionar_site_dominio(p_site uuid, p_dominio text)
returns table (id uuid, token text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_dom text := public._site_dominio_normalizar(p_dominio); v_id uuid; v_token text;
begin
  v_org := public._site_exigir(p_site, array['dono', 'admin']);
  if length(v_dom) > 253 or v_dom !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$'
     or v_dom ~ '\.(localhost|local|internal|invalid|test|example|onion|arpa)$' then
    raise exception 'Domínio inválido.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_dom, 71));
  select d.id, d.token into v_id, v_token from public.site_dominios d where d.site_id = p_site and d.dominio = v_dom;
  if found then return query select v_id, v_token; return; end if;
  if exists (select 1 from public.site_dominios d where d.dominio = v_dom and d.status = 'verificado') then
    raise exception 'Domínio indisponível.' using errcode = '22023'; end if;
  if (select count(*) from public.site_dominios d where d.site_id = p_site) >= 5 then
    raise exception 'Limite de domínios do site atingido.' using errcode = '22023'; end if;
  v_token := 'seualbum-verificacao=' || replace(gen_random_uuid()::text, '-', '');
  insert into public.site_dominios(site_id, organizacao_id, dominio, token, criado_por)
    values (p_site, v_org, v_dom, v_token, auth.uid()) returning site_dominios.id into v_id;
  perform public._site_evento(p_site, v_org, 'dominio_adicionado', null, v_dom);
  return query select v_id, v_token;
end $$;

-- Passo 1 (usuário autorizado): registra que a verificação foi pedida agora.
create function public.preparar_verificacao_dominio(p_id uuid)
returns table (dominio text, token text, status text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.site_dominios;
begin
  select * into v from public.site_dominios d where d.id = p_id;
  perform public._site_exigir(v.site_id, array['dono', 'admin']);
  if v.status = 'verificado' then return query select v.dominio, v.token, v.status; return; end if;
  update public.site_dominios d set status = 'pendente', falhou_em = null, falhou_motivo = null,
    verificacao_solicitada_em = now() where d.id = p_id;
  return query select v.dominio, v.token, 'pendente'::text;
end $$;

-- Passo 2 (servidor do app, depois de consultar o DNS): só o service_role, só
-- para verificação solicitada há menos de 15 min, e uso único.
create function public.confirmar_verificacao_dominio(p_id uuid, p_registros text[]) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.site_dominios;
begin
  select * into v from public.site_dominios d where d.id = p_id for update;
  if not found then raise exception 'Domínio inválido.' using errcode = '22023'; end if;
  if v.status = 'verificado' then return 'verificado'; end if;
  if v.verificacao_solicitada_em is null or v.verificacao_solicitada_em < now() - interval '15 minutes' then
    raise exception 'Verificação não solicitada.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v.dominio, 71));
  if p_registros is not null and exists (select 1 from unnest(p_registros) r where btrim(r, ' "') = v.token) then
    if exists (select 1 from public.site_dominios d where d.dominio = v.dominio and d.status = 'verificado' and d.id <> v.id) then
      update public.site_dominios set status = 'falhou', falhou_em = now(), falhou_motivo = 'dominio_em_uso', verificacao_solicitada_em = null where id = v.id;
      return 'falhou';
    end if;
    update public.site_dominios set status = 'verificado', verificado_em = now(), falhou_em = null, falhou_motivo = null, verificacao_solicitada_em = null where id = v.id;
    update public.site_dominios set status = 'falhou', falhou_em = now(), falhou_motivo = 'dominio_verificado_por_outro', ativo = false, verificacao_solicitada_em = null
     where dominio = v.dominio and id <> v.id and status <> 'verificado';
    insert into public.site_eventos(site_id, organizacao_id, ator, acao, detalhe) values (v.site_id, v.organizacao_id, null, 'dominio_verificado', v.dominio);
    return 'verificado';
  end if;
  update public.site_dominios set status = 'falhou', falhou_em = now(), falhou_motivo = 'registro_nao_encontrado', verificacao_solicitada_em = null where id = v.id;
  insert into public.site_eventos(site_id, organizacao_id, ator, acao, detalhe) values (v.site_id, v.organizacao_id, null, 'dominio_falhou', v.dominio);
  return 'falhou';
end $$;

create function public.definir_site_dominio_ativo(p_id uuid, p_ativo boolean) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.site_dominios; v_org uuid;
begin
  select * into v from public.site_dominios d where d.id = p_id;
  v_org := public._site_exigir(v.site_id, array['dono', 'admin']);
  if p_ativo is null then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  if p_ativo and v.status <> 'verificado' then raise exception 'Verifique a titularidade antes de ativar.' using errcode = '22023'; end if;
  update public.site_dominios set ativo = p_ativo where id = p_id;
  perform public._site_evento(v.site_id, v_org, case when p_ativo then 'dominio_ativado' else 'dominio_desativado' end, null, v.dominio);
  return true;
end $$;

create function public.remover_site_dominio(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.site_dominios; v_org uuid;
begin
  select * into v from public.site_dominios d where d.id = p_id;
  v_org := public._site_exigir(v.site_id, array['dono', 'admin']);
  delete from public.site_dominios where id = p_id;
  perform public._site_evento(v.site_id, v_org, 'dominio_removido', null, v.dominio);
  return true;
end $$;

-- Leitura PÚBLICA: só a versão publicada de um site publicado; nunca rascunho.
create function public._site_publicado_json(p_site uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('slug', s.slug, 'nome', s.nome, 'versao', v.numero, 'publicado_em', s.publicado_em,
    'dominio', (select d.dominio from public.site_dominios d where d.site_id = s.id and d.ativo and d.status = 'verificado' order by d.verificado_em limit 1),
    'conteudo', v.conteudo, 'midias', v.midias)
    from public.sites s join public.site_versoes v on v.id = s.versao_publicada_id and v.site_id = s.id
   where s.id = p_site and s.status = 'publicado'
$$;
revoke all on function public._site_publicado_json(uuid) from public, anon, authenticated, service_role;

create function public.obter_site_publicado(p_slug text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select public._site_publicado_json(s.id) from public.sites s where s.slug = lower(trim(p_slug)) and s.status = 'publicado'
$$;

create function public.obter_site_publicado_por_host(p_host text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select public._site_publicado_json(d.site_id) from public.site_dominios d join public.sites s on s.id = d.site_id
   where d.dominio = public._site_dominio_normalizar(p_host) and d.ativo and d.status = 'verificado' and s.status = 'publicado'
$$;

-- Só o slug, para o proxy decidir o rewrite sem trazer o conteúdo.
create function public.resolver_site_por_host(p_host text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select s.slug from public.site_dominios d join public.sites s on s.id = d.site_id
   where d.dominio = public._site_dominio_normalizar(p_host) and d.ativo and d.status = 'verificado' and s.status = 'publicado'
$$;

revoke all on function public.adicionar_site_dominio(uuid, text), public.preparar_verificacao_dominio(uuid),
  public.definir_site_dominio_ativo(uuid, boolean), public.remover_site_dominio(uuid) from public, anon, service_role;
grant execute on function public.adicionar_site_dominio(uuid, text), public.preparar_verificacao_dominio(uuid),
  public.definir_site_dominio_ativo(uuid, boolean), public.remover_site_dominio(uuid) to authenticated;
revoke all on function public.confirmar_verificacao_dominio(uuid, text[]) from public, anon, authenticated, service_role;
grant execute on function public.confirmar_verificacao_dominio(uuid, text[]) to service_role;
revoke all on function public.obter_site_publicado(text), public.obter_site_publicado_por_host(text), public.resolver_site_por_host(text)
  from public, anon, authenticated, service_role;
grant execute on function public.obter_site_publicado(text), public.obter_site_publicado_por_host(text), public.resolver_site_por_host(text)
  to anon, authenticated;

commit;
