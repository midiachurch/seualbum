-- SITES (W01/W02): site público por organização, com blocos tipados, rascunho
-- distinto do publicado, versões imutáveis, rollback e retirada.
-- ADITIVA: não altera nenhuma tabela, policy ou RLS existente; reaproveita
-- apenas `organizacoes` + `papel_na_organizacao` (0051). NÃO reaproveita
-- `paginas_conteudo`/`media_assets` (CMS institucional da vitrine central,
-- sem organização e editável só pela equipe da plataforma) — ver
-- docs/operacao-digital/modulos/SITES.md.
-- Decisões de mercado (Squarespace/Pixieset/Format): um site por estúdio;
-- editor produz o rascunho, dono/admin publica; cada publicação é uma foto
-- imutável (versão) à qual se volta com um clique; só mídia pública do próprio
-- estúdio entra no site. A leitura anônima fica na 0071 (junto dos domínios).
-- NÃO aplicada em ambiente remoto.
begin;

-- ---------------------------------------------------------------- tabelas
create table public.sites (
  id                  uuid primary key default gen_random_uuid(),
  organizacao_id      uuid not null unique references public.organizacoes (id) on delete cascade,
  slug                text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  nome                text not null check (length(trim(nome)) between 2 and 120),
  status              text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'despublicado')),
  rascunho            jsonb not null,
  rascunho_rev        integer not null default 1 check (rascunho_rev > 0),
  versao_publicada_id uuid,
  publicado_em        timestamptz,
  criado_por          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint sites_publicado_tem_versao check (status <> 'publicado' or (versao_publicada_id is not null and publicado_em is not null))
);
comment on table public.sites is
  'Site público do estúdio (0070). Um por organização. `rascunho` nunca é público; o público lê só a versão apontada por `versao_publicada_id` quando status = publicado. Escrita só por RPC.';

create table public.site_versoes (
  id                 uuid primary key default gen_random_uuid(),
  site_id            uuid not null references public.sites (id) on delete cascade,
  organizacao_id     uuid not null references public.organizacoes (id) on delete cascade,
  numero             integer not null check (numero > 0),
  conteudo           jsonb not null,
  midias             jsonb not null default '{}'::jsonb,
  nota               text check (nota is null or length(nota) <= 200),
  chave_idempotencia uuid not null,
  criado_por         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (site_id, numero),
  unique (site_id, chave_idempotencia),
  unique (site_id, id)
);
comment on table public.site_versoes is
  'Versões publicadas, imutáveis (0070): conteúdo + mapa das mídias usadas (chave pública resolvida na publicação). Rollback só move o ponteiro em `sites`.';

-- O ponteiro só pode apontar para versão do próprio site.
alter table public.sites
  add constraint sites_versao_publicada_fk foreign key (id, versao_publicada_id)
  references public.site_versoes (site_id, id);

create table public.site_midias (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  chave          text not null unique,
  nome           text not null check (length(trim(nome)) between 1 and 120),
  largura_px     integer check (largura_px is null or largura_px between 1 and 20000),
  altura_px      integer check (altura_px is null or altura_px between 1 and 20000),
  tamanho_kb     integer check (tamanho_kb is null or tamanho_kb >= 0),
  criado_por     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint site_midias_chave_check check (
    chave !~ '\.\.' and chave ~ ('^sites/' || organizacao_id::text || '/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,80}$')
  )
);
create index idx_site_midias_org on public.site_midias (organizacao_id);
comment on table public.site_midias is
  'Mídia PÚBLICA do site (0070): chaves do bucket público do R2 sob sites/{organizacao}/. Original privado nunca entra aqui.';

create table public.site_eventos (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references public.sites (id) on delete cascade,
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  ator           uuid references public.profiles (id) on delete set null,
  acao           text not null check (acao in ('criado', 'rascunho_salvo', 'publicado', 'revertido', 'despublicado', 'restaurado_no_rascunho', 'dados_alterados', 'dominio_adicionado', 'dominio_verificado', 'dominio_falhou', 'dominio_ativado', 'dominio_desativado', 'dominio_removido')),
  versao_id      uuid,
  detalhe        text check (detalhe is null or length(detalhe) <= 300),
  created_at     timestamptz not null default now()
);
create index idx_site_eventos_site on public.site_eventos (site_id, created_at desc);

alter table public.sites enable row level security;
alter table public.site_versoes enable row level security;
alter table public.site_midias enable row level security;
alter table public.site_eventos enable row level security;
revoke all on table public.sites, public.site_versoes, public.site_midias, public.site_eventos from public, anon, authenticated;
grant select on table public.sites, public.site_versoes, public.site_midias, public.site_eventos to authenticated;
grant all on table public.sites, public.site_versoes, public.site_midias, public.site_eventos to service_role;

create policy sites_select on public.sites for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy site_versoes_select on public.site_versoes for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy site_midias_select on public.site_midias for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy site_eventos_select on public.site_eventos for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);

-- Versão publicada é imutável. Duas exceções legítimas: apagar junto com o
-- site/organização, e `criado_por` virar nulo quando a conta é excluída (FK
-- on delete set null) — exclusão de conta não pode ser bloqueada.
create function public._site_versoes_imutavel() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.sites where id = old.site_id) then return old; end if;
  if tg_op = 'UPDATE' and new.criado_por is null
     and (to_jsonb(new) - 'criado_por') = (to_jsonb(old) - 'criado_por') then return new; end if;
  raise exception 'Versões publicadas são imutáveis.' using errcode = '42501';
end $$;
revoke all on function public._site_versoes_imutavel() from public, anon, authenticated, service_role;
create trigger trg_site_versoes_imutavel before update or delete on public.site_versoes
  for each row execute function public._site_versoes_imutavel();

-- -------------------------------------------------- validação de conteúdo
-- Contrato do documento (v1) — espelhado em src/lib/sites/validar.ts:
-- { v:1, tema:{cor,fonte,modo}, seo:{titulo,descricao,midia_id},
--   paginas:[{ slug, titulo, blocos:[{ id, tipo, dados }] }] }
create function public._site_chaves(p jsonb, p_perm text[]) returns void
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Conteúdo inválido.' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_object_keys(p) k where k <> all (p_perm)) then
    raise exception 'Campo desconhecido no conteúdo.' using errcode = '22023'; end if;
end $$;

-- Texto simples (renderizado com escape no React). Vazio/ausente = nulo.
create function public._site_texto(p jsonb, p_chave text, p_min integer, p_max integer) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare v jsonb := p -> p_chave; t text;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if p_min > 0 then raise exception 'Campo obrigatório ausente: %.', p_chave using errcode = '22023'; end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'string' then raise exception 'Campo inválido: %.', p_chave using errcode = '22023'; end if;
  t := v #>> '{}';
  if t = '' and p_min = 0 then return null; end if;
  if length(trim(t)) < p_min or length(t) > p_max or t ~ '[\x00-\x08\x0b\x0c\x0e-\x1f]' then
    raise exception 'Campo inválido: %.', p_chave using errcode = '22023'; end if;
  return t;
end $$;

-- Link permitido: http(s), mailto, tel, caminho relativo ou âncora.
create function public._site_url_ok(p text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select p ~* '^(https?://[^\s<>"'']{3,255}|mailto:[^\s<>"'']{3,200}|tel:[0-9+() -]{3,30}|/[^/\s<>"''][^\s<>"'']{0,250}|/|#[a-z0-9_-]{1,60})$'
$$;

create function public._site_url(p jsonb, p_chave text, p_obrig boolean) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare t text := public._site_texto(p, p_chave, case when p_obrig then 1 else 0 end, 255);
begin
  if t is not null and not public._site_url_ok(t) then raise exception 'Link inválido: %.', p_chave using errcode = '22023'; end if;
  return t;
end $$;

-- Texto rico: lista branca de tags/atributos no próprio banco (defesa em
-- profundidade — o servidor já sanitiza com sanitize-html antes de gravar).
create function public._site_html(p jsonb, p_chave text, p_min integer, p_max integer) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare v text; m text[]; a text[]; tag text; valor text;
begin
  v := public._site_texto(p, p_chave, p_min, p_max);
  if v is null then return null; end if;
  if v ~ '<[^>]*$' then raise exception 'HTML não permitido.' using errcode = '22023'; end if;
  for m in select regexp_matches(v, '<\s*/?\s*([A-Za-z0-9]*)', 'g') loop
    if lower(m[1]) <> all (array['p','br','strong','b','em','i','u','ul','ol','li','a','h2','h3','h4','blockquote']) then
      raise exception 'HTML não permitido.' using errcode = '22023'; end if;
  end loop;
  for m in select regexp_matches(v, '(<[^<>]*>)', 'g') loop
    tag := m[1];
    for a in select regexp_matches(tag, '\s([^\s=/>"'']+)\s*=', 'g') loop
      if lower(a[1]) <> all (array['href','title','target','rel']) then
        raise exception 'HTML não permitido.' using errcode = '22023'; end if;
    end loop;
    for a in select regexp_matches(tag, '\shref\s*=\s*("[^"]*"|''[^'']*''|[^\s>]+)', 'gi') loop
      valor := btrim(a[1], '"''');
      if valor !~* '^\s*(https?://|mailto:|tel:|/[^/]|#)' then
        raise exception 'HTML não permitido.' using errcode = '22023'; end if;
    end loop;
  end loop;
  return v;
end $$;

create function public._site_lista(p jsonb, p_chave text, p_min integer, p_max integer) returns jsonb
language plpgsql immutable set search_path = public, pg_temp as $$
declare v jsonb := p -> p_chave;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if p_min > 0 then raise exception 'Lista obrigatória ausente: %.', p_chave using errcode = '22023'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < p_min or jsonb_array_length(v) > p_max then
    raise exception 'Lista inválida: %.', p_chave using errcode = '22023'; end if;
  return v;
end $$;

-- Referência de mídia: precisa ser da PRÓPRIA organização (site_midias).
create function public._site_midia(p_org uuid, p jsonb, p_chave text, p_obrig boolean) returns uuid
language plpgsql stable set search_path = public, pg_temp as $$
declare v jsonb := p -> p_chave; t text;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if p_obrig then raise exception 'Mídia obrigatória ausente.' using errcode = '22023'; end if;
    return null;
  end if;
  t := v #>> '{}';
  if jsonb_typeof(v) <> 'string' or t !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Mídia inválida.' using errcode = '22023'; end if;
  if not exists (select 1 from public.site_midias where id = t::uuid and organizacao_id = p_org) then
    raise exception 'Mídia inválida.' using errcode = '22023'; end if;
  return t::uuid;
end $$;

-- Par texto+link do botão de chamada: os dois ou nenhum.
create function public._site_cta(p jsonb, p_texto text, p_url text) returns void
language plpgsql immutable set search_path = public, pg_temp as $$
declare t text := public._site_texto(p, p_texto, 0, 40); u text := public._site_url(p, p_url, false);
begin
  if (t is null) <> (u is null) then raise exception 'Botão incompleto.' using errcode = '22023'; end if;
end $$;

create function public._site_validar_bloco(p_org uuid, b jsonb) returns void
language plpgsql stable set search_path = public, pg_temp as $$
declare t text; d jsonb; i jsonb; v text;
begin
  perform public._site_chaves(b, array['id', 'tipo', 'dados']);
  if coalesce(b ->> 'id', '') !~ '^[a-z0-9][a-z0-9-]{0,39}$' then raise exception 'Identificador de bloco inválido.' using errcode = '22023'; end if;
  t := b ->> 'tipo'; d := b -> 'dados';
  if jsonb_typeof(d) is distinct from 'object' then raise exception 'Bloco inválido.' using errcode = '22023'; end if;
  if t = 'hero' then
    perform public._site_chaves(d, array['titulo', 'subtitulo', 'midia_id', 'alt', 'cta_texto', 'cta_url']);
    perform public._site_texto(d, 'titulo', 1, 120); perform public._site_texto(d, 'subtitulo', 0, 240);
    if public._site_midia(p_org, d, 'midia_id', false) is not null then perform public._site_texto(d, 'alt', 1, 200); end if;
    perform public._site_cta(d, 'cta_texto', 'cta_url');
  elsif t = 'texto' then
    perform public._site_chaves(d, array['titulo', 'html']);
    perform public._site_texto(d, 'titulo', 0, 120); perform public._site_html(d, 'html', 1, 5000);
  elsif t = 'sobre' then
    perform public._site_chaves(d, array['titulo', 'html', 'midia_id', 'alt']);
    perform public._site_texto(d, 'titulo', 1, 120); perform public._site_html(d, 'html', 1, 5000);
    if public._site_midia(p_org, d, 'midia_id', false) is not null then perform public._site_texto(d, 'alt', 1, 200); end if;
  elsif t = 'galeria' then
    perform public._site_chaves(d, array['titulo', 'colunas', 'itens']);
    perform public._site_texto(d, 'titulo', 0, 120);
    if d ? 'colunas' and (jsonb_typeof(d -> 'colunas') <> 'number' or (d ->> 'colunas') not in ('2', '3', '4')) then
      raise exception 'Colunas inválidas.' using errcode = '22023'; end if;
    for i in select * from jsonb_array_elements(public._site_lista(d, 'itens', 1, 30)) loop
      perform public._site_chaves(i, array['midia_id', 'alt', 'legenda']);
      perform public._site_midia(p_org, i, 'midia_id', true);
      perform public._site_texto(i, 'alt', 1, 200); perform public._site_texto(i, 'legenda', 0, 200);
    end loop;
  elsif t = 'servicos' then
    perform public._site_chaves(d, array['titulo', 'itens']);
    perform public._site_texto(d, 'titulo', 0, 120);
    for i in select * from jsonb_array_elements(public._site_lista(d, 'itens', 1, 12)) loop
      perform public._site_chaves(i, array['nome', 'descricao', 'preco']);
      perform public._site_texto(i, 'nome', 1, 80); perform public._site_texto(i, 'descricao', 0, 300); perform public._site_texto(i, 'preco', 0, 40);
    end loop;
  elsif t = 'contato' then
    perform public._site_chaves(d, array['titulo', 'texto', 'email', 'telefone', 'whatsapp', 'instagram', 'cta_texto']);
    perform public._site_texto(d, 'titulo', 1, 120); perform public._site_texto(d, 'texto', 0, 500); perform public._site_texto(d, 'cta_texto', 0, 40);
    v := public._site_texto(d, 'email', 0, 254);
    if v is not null and v !~ '^[^\s@<>"'']{1,64}@[^\s@<>"'']{1,190}\.[^\s@<>"'']{2,}$' then raise exception 'E-mail inválido.' using errcode = '22023'; end if;
    v := public._site_texto(d, 'telefone', 0, 30);
    if v is not null and v !~ '^[0-9+() -]{6,30}$' then raise exception 'Telefone inválido.' using errcode = '22023'; end if;
    v := public._site_texto(d, 'whatsapp', 0, 15);
    if v is not null and v !~ '^[0-9]{10,15}$' then raise exception 'WhatsApp inválido.' using errcode = '22023'; end if;
    v := public._site_texto(d, 'instagram', 0, 30);
    if v is not null and v !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'Instagram inválido.' using errcode = '22023'; end if;
    if public._site_texto(d, 'email', 0, 254) is null and public._site_texto(d, 'telefone', 0, 30) is null
       and public._site_texto(d, 'whatsapp', 0, 15) is null and public._site_texto(d, 'instagram', 0, 30) is null then
      raise exception 'Informe ao menos um canal de contato.' using errcode = '22023'; end if;
  elsif t = 'depoimentos' then
    perform public._site_chaves(d, array['titulo', 'itens']);
    perform public._site_texto(d, 'titulo', 0, 120);
    for i in select * from jsonb_array_elements(public._site_lista(d, 'itens', 1, 10)) loop
      perform public._site_chaves(i, array['texto', 'autor', 'detalhe']);
      perform public._site_texto(i, 'texto', 1, 500); perform public._site_texto(i, 'autor', 1, 80); perform public._site_texto(i, 'detalhe', 0, 80);
    end loop;
  elsif t = 'rodape' then
    perform public._site_chaves(d, array['texto', 'instagram', 'links']);
    perform public._site_texto(d, 'texto', 0, 200);
    v := public._site_texto(d, 'instagram', 0, 30);
    if v is not null and v !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'Instagram inválido.' using errcode = '22023'; end if;
    for i in select * from jsonb_array_elements(public._site_lista(d, 'links', 0, 6)) loop
      perform public._site_chaves(i, array['rotulo', 'url']);
      perform public._site_texto(i, 'rotulo', 1, 40); perform public._site_url(i, 'url', true);
    end loop;
  else
    raise exception 'Tipo de bloco desconhecido.' using errcode = '22023';
  end if;
end $$;

create function public._site_validar_conteudo(p_org uuid, p_doc jsonb) returns void
language plpgsql stable set search_path = public, pg_temp as $$
declare pg jsonb; b jsonb; n integer := 0; slugs text[] := '{}'; ids text[]; v text;
begin
  perform public._site_chaves(p_doc, array['v', 'tema', 'seo', 'paginas']);
  if p_doc -> 'v' is distinct from '1'::jsonb then raise exception 'Versão do conteúdo inválida.' using errcode = '22023'; end if;
  if octet_length(p_doc::text) > 262144 then raise exception 'Conteúdo grande demais.' using errcode = '22023'; end if;
  if p_doc ? 'tema' then
    perform public._site_chaves(p_doc -> 'tema', array['cor', 'fonte', 'modo']);
    v := public._site_texto(p_doc -> 'tema', 'cor', 0, 7);
    if v is not null and v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Cor inválida.' using errcode = '22023'; end if;
    v := public._site_texto(p_doc -> 'tema', 'fonte', 0, 10);
    if v is not null and v not in ('sans', 'serif') then raise exception 'Fonte inválida.' using errcode = '22023'; end if;
    v := public._site_texto(p_doc -> 'tema', 'modo', 0, 10);
    if v is not null and v not in ('claro', 'escuro') then raise exception 'Modo inválido.' using errcode = '22023'; end if;
  end if;
  if p_doc ? 'seo' then
    perform public._site_chaves(p_doc -> 'seo', array['titulo', 'descricao', 'midia_id']);
    perform public._site_texto(p_doc -> 'seo', 'titulo', 0, 70); perform public._site_texto(p_doc -> 'seo', 'descricao', 0, 200);
    perform public._site_midia(p_org, p_doc -> 'seo', 'midia_id', false);
  end if;
  if jsonb_typeof(p_doc -> 'paginas') is distinct from 'array' or jsonb_array_length(p_doc -> 'paginas') not between 1 and 10 then
    raise exception 'Número de páginas inválido.' using errcode = '22023'; end if;
  for pg in select * from jsonb_array_elements(p_doc -> 'paginas') loop
    n := n + 1;
    perform public._site_chaves(pg, array['slug', 'titulo', 'blocos']);
    v := public._site_texto(pg, 'slug', 1, 40);
    if v !~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$' or (n = 1 and v <> 'inicio') or v = any (slugs) then
      raise exception 'Endereço de página inválido.' using errcode = '22023'; end if;
    slugs := slugs || v;
    perform public._site_texto(pg, 'titulo', 1, 60);
    ids := '{}';
    for b in select * from jsonb_array_elements(public._site_lista(pg, 'blocos', 0, 40)) loop
      perform public._site_validar_bloco(p_org, b);
      if (b ->> 'id') = any (ids) then raise exception 'Identificador de bloco repetido.' using errcode = '22023'; end if;
      ids := ids || (b ->> 'id');
    end loop;
  end loop;
end $$;

create function public._site_slug_ok(p text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select p is not null and p ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
     and p <> all (array['admin','api','app','www','dashboard','portal','site','sites','s','p','login','auth','cliente','suporte','ajuda','status','blog','mail','ftp','static','assets','cdn','seualbum','sitemap','robots','teste','preview','previa'])
$$;

-- Mídias referenciadas por um documento (inclui seo.midia_id).
create function public._site_mapa_midias(p_doc jsonb) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_object_agg(m.id::text, jsonb_build_object('chave', m.chave, 'largura', m.largura_px, 'altura', m.altura_px)), '{}'::jsonb)
    from public.site_midias m
   where m.id in (select distinct (x #>> '{}')::uuid from jsonb_path_query(p_doc, '$.**.midia_id') x where jsonb_typeof(x) = 'string')
$$;

-- Autorização única: devolve a organização do site se o chamador tem um dos papéis.
create function public._site_exigir(p_site uuid, p_papeis text[]) returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_papel text;
begin
  select organizacao_id into v_org from public.sites where id = p_site;
  v_papel := case when v_org is null then null else public.papel_na_organizacao(v_org) end;
  if v_papel is null or v_papel <> all (p_papeis) then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return v_org;
end $$;

create function public._site_evento(p_site uuid, p_org uuid, p_acao text, p_versao uuid, p_detalhe text) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.site_eventos(site_id, organizacao_id, ator, acao, versao_id, detalhe) values (p_site, p_org, auth.uid(), p_acao, p_versao, left(p_detalhe, 300))
$$;

revoke all on function public._site_chaves(jsonb, text[]), public._site_texto(jsonb, text, integer, integer), public._site_url_ok(text),
  public._site_url(jsonb, text, boolean), public._site_html(jsonb, text, integer, integer), public._site_lista(jsonb, text, integer, integer),
  public._site_midia(uuid, jsonb, text, boolean), public._site_cta(jsonb, text, text), public._site_validar_bloco(uuid, jsonb),
  public._site_validar_conteudo(uuid, jsonb), public._site_slug_ok(text), public._site_mapa_midias(jsonb),
  public._site_exigir(uuid, text[]), public._site_evento(uuid, uuid, text, uuid, text)
  from public, anon, authenticated, service_role;

-- ------------------------------------------------------------------- RPCs
create function public.criar_site(p_org uuid, p_nome text, p_slug text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_papel text; v_slug text := lower(trim(coalesce(p_slug, ''))); v_id uuid; v_nome text := trim(coalesce(p_nome, ''));
begin
  v_papel := public.papel_na_organizacao(p_org);
  if v_papel is null or v_papel not in ('dono', 'admin') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if length(v_nome) not between 2 and 120 or not public._site_slug_ok(v_slug) then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 70));
  select id into v_id from public.sites where organizacao_id = p_org;
  if found then
    -- Repetição do mesmo pedido é inofensiva; outro endereço para a mesma organização não.
    if exists (select 1 from public.sites where id = v_id and slug = v_slug) then return v_id; end if;
    raise exception 'Esta organização já tem um site.' using errcode = '22023';
  end if;
  begin
    insert into public.sites(organizacao_id, slug, nome, rascunho, criado_por)
    values (p_org, v_slug, v_nome, jsonb_build_object('v', 1,
      'tema', jsonb_build_object('cor', '#1f2937', 'fonte', 'sans', 'modo', 'claro'),
      'seo', jsonb_build_object('titulo', left(v_nome, 70)),
      'paginas', jsonb_build_array(jsonb_build_object('slug', 'inicio', 'titulo', 'Início', 'blocos', jsonb_build_array(
        jsonb_build_object('id', 'hero-1', 'tipo', 'hero', 'dados', jsonb_build_object('titulo', left(v_nome, 120))))))), auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Endereço indisponível.' using errcode = '22023';
  end;
  perform public._site_evento(v_id, p_org, 'criado', null, v_slug);
  return v_id;
end $$;

create function public.atualizar_site_dados(p_site uuid, p_nome text, p_slug text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_slug text := lower(trim(coalesce(p_slug, ''))); v_nome text := trim(coalesce(p_nome, ''));
begin
  v_org := public._site_exigir(p_site, array['dono', 'admin']);
  if length(v_nome) not between 2 and 120 or not public._site_slug_ok(v_slug) then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  begin
    update public.sites set nome = v_nome, slug = v_slug, updated_at = now() where id = p_site;
  exception when unique_violation then
    raise exception 'Endereço indisponível.' using errcode = '22023';
  end;
  perform public._site_evento(p_site, v_org, 'dados_alterados', null, v_slug);
  return true;
end $$;

-- Salva o rascunho com concorrência otimista (p_rev = revisão que a tela leu).
create function public.salvar_site_rascunho(p_site uuid, p_conteudo jsonb, p_rev integer) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_nova integer;
begin
  v_org := public._site_exigir(p_site, array['dono', 'admin', 'editor']);
  if p_conteudo is null or p_rev is null then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  perform 1 from public.sites where id = p_site for update;
  if (select rascunho_rev from public.sites where id = p_site) <> p_rev then
    raise exception 'O rascunho foi alterado por outra pessoa. Recarregue a página.' using errcode = '40001'; end if;
  perform public._site_validar_conteudo(v_org, p_conteudo);
  update public.sites set rascunho = p_conteudo, rascunho_rev = rascunho_rev + 1, updated_at = now() where id = p_site
    returning rascunho_rev into v_nova;
  perform public._site_evento(p_site, v_org, 'rascunho_salvo', null, null);
  return v_nova;
end $$;

create function public.registrar_site_midia(p_org uuid, p_chave text, p_nome text, p_largura integer, p_altura integer, p_tamanho_kb integer) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_papel text; v_id uuid;
begin
  v_papel := public.papel_na_organizacao(p_org);
  if v_papel is null or v_papel not in ('dono', 'admin', 'editor') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_chave is null or p_chave ~ '\.\.' or p_chave !~ ('^sites/' || p_org::text || '/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,80}$')
     or length(trim(coalesce(p_nome, ''))) not between 1 and 120
     or (p_largura is not null and p_largura not between 1 and 20000) or (p_altura is not null and p_altura not between 1 and 20000)
     or (p_tamanho_kb is not null and p_tamanho_kb < 0) then
    raise exception 'Mídia inválida.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 70));
  select id into v_id from public.site_midias where chave = p_chave and organizacao_id = p_org;
  if found then return v_id; end if;
  if (select count(*) from public.site_midias where organizacao_id = p_org) >= 300 then
    raise exception 'Limite de mídias do site atingido.' using errcode = '22023'; end if;
  insert into public.site_midias(organizacao_id, chave, nome, largura_px, altura_px, tamanho_kb, criado_por)
    values (p_org, p_chave, trim(p_nome), p_largura, p_altura, p_tamanho_kb, auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- Remove a mídia da biblioteca do site; devolve a chave para o app apagar o
-- arquivo. Recusa se o rascunho ou qualquer versão ainda a usa.
create function public.remover_site_midia(p_id uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.site_midias; v_papel text;
begin
  select * into v from public.site_midias where id = p_id;
  v_papel := case when v.id is null then null else public.papel_na_organizacao(v.organizacao_id) end;
  if v_papel is null or v_papel not in ('dono', 'admin', 'editor') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if exists (select 1 from public.sites s where s.organizacao_id = v.organizacao_id and s.rascunho::text like '%' || v.id::text || '%')
     or exists (select 1 from public.site_versoes sv where sv.organizacao_id = v.organizacao_id and sv.conteudo::text like '%' || v.id::text || '%') then
    raise exception 'A mídia está em uso no site.' using errcode = '22023'; end if;
  delete from public.site_midias where id = p_id;
  return v.chave;
end $$;

create function public.publicar_site(p_site uuid, p_chave uuid, p_nota text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_site public.sites; v_id uuid; v_num integer;
begin
  v_org := public._site_exigir(p_site, array['dono', 'admin']);
  if p_chave is null or (p_nota is not null and length(p_nota) > 200) then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  select * into v_site from public.sites where id = p_site for update;
  select id into v_id from public.site_versoes where site_id = p_site and chave_idempotencia = p_chave;
  if found then return v_id; end if;
  perform public._site_validar_conteudo(v_org, v_site.rascunho);
  select coalesce(max(numero), 0) + 1 into v_num from public.site_versoes where site_id = p_site;
  insert into public.site_versoes(site_id, organizacao_id, numero, conteudo, midias, nota, chave_idempotencia, criado_por)
    values (p_site, v_org, v_num, v_site.rascunho, public._site_mapa_midias(v_site.rascunho), nullif(trim(coalesce(p_nota, '')), ''), p_chave, auth.uid())
    returning id into v_id;
  update public.sites set status = 'publicado', versao_publicada_id = v_id, publicado_em = now(), updated_at = now() where id = p_site;
  perform public._site_evento(p_site, v_org, 'publicado', v_id, 'v' || v_num);
  return v_id;
end $$;

-- Rollback: aponta o site para uma versão anterior (as versões não mudam).
create function public.reverter_site_versao(p_site uuid, p_versao uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_site public.sites;
begin
  v_org := public._site_exigir(p_site, array['dono', 'admin']);
  select * into v_site from public.sites where id = p_site for update;
  if not exists (select 1 from public.site_versoes where id = p_versao and site_id = p_site) then
    raise exception 'Versão inválida.' using errcode = '22023'; end if;
  if v_site.status = 'publicado' and v_site.versao_publicada_id = p_versao then return p_versao; end if;
  update public.sites set status = 'publicado', versao_publicada_id = p_versao, publicado_em = now(), updated_at = now() where id = p_site;
  perform public._site_evento(p_site, v_org, 'revertido', p_versao, null);
  return p_versao;
end $$;

create function public.despublicar_site(p_site uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_status text;
begin
  v_org := public._site_exigir(p_site, array['dono', 'admin']);
  select status into v_status from public.sites where id = p_site for update;
  if v_status <> 'publicado' then return false; end if;
  update public.sites set status = 'despublicado', updated_at = now() where id = p_site;
  perform public._site_evento(p_site, v_org, 'despublicado', null, null);
  return true;
end $$;

create function public.restaurar_site_versao_no_rascunho(p_site uuid, p_versao uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_conteudo jsonb; v_nova integer;
begin
  v_org := public._site_exigir(p_site, array['dono', 'admin', 'editor']);
  select conteudo into v_conteudo from public.site_versoes where id = p_versao and site_id = p_site;
  if not found then raise exception 'Versão inválida.' using errcode = '22023'; end if;
  perform 1 from public.sites where id = p_site for update;
  perform public._site_validar_conteudo(v_org, v_conteudo);
  update public.sites set rascunho = v_conteudo, rascunho_rev = rascunho_rev + 1, updated_at = now() where id = p_site
    returning rascunho_rev into v_nova;
  perform public._site_evento(p_site, v_org, 'restaurado_no_rascunho', p_versao, null);
  return v_nova;
end $$;

revoke all on function public.criar_site(uuid, text, text), public.atualizar_site_dados(uuid, text, text), public.salvar_site_rascunho(uuid, jsonb, integer),
  public.registrar_site_midia(uuid, text, text, integer, integer, integer), public.remover_site_midia(uuid), public.publicar_site(uuid, uuid, text),
  public.reverter_site_versao(uuid, uuid), public.despublicar_site(uuid), public.restaurar_site_versao_no_rascunho(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.criar_site(uuid, text, text), public.atualizar_site_dados(uuid, text, text), public.salvar_site_rascunho(uuid, jsonb, integer),
  public.registrar_site_midia(uuid, text, text, integer, integer, integer), public.remover_site_midia(uuid), public.publicar_site(uuid, uuid, text),
  public.reverter_site_versao(uuid, uuid), public.despublicar_site(uuid), public.restaurar_site_versao_no_rascunho(uuid, uuid) to authenticated;

commit;
