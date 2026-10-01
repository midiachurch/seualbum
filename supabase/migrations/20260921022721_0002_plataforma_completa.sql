-- =============================================================================
-- SeuAlbum — Migration 0002: plataforma completa (5 papéis, projetos, mídia)
-- Alvo: Supabase / PostgreSQL 17 (projeto dedicado "SeuAlbum")
-- Substitui o modelo simplificado (profiles/plans/orders só client/admin) da
-- 0001 pelo modelo completo das Fases 1-5 (mock): Admin/Gestor/Operador/
-- Fotógrafo/Cliente, Clientes/Fotógrafos como entidades próprias, Projetos com
-- pipeline de 13 estágios, Mídia/Banners/Portfólio.
-- Idempotente: pode ser reexecutada com segurança.
--
-- Ordem importa: funções `language sql` são parse-analisadas na criação (ao
-- contrário de plpgsql), então toda tabela referenciada por uma função precisa
-- existir ANTES da função ser criada.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.platform_role as enum ('admin', 'gestor', 'operador', 'fotografo', 'cliente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.billing_type as enum ('avulso', 'assinatura');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum (
    'projeto_criado',
    'aguardando_fotos',
    'fotos_recebidas',
    'aguardando_briefing',
    'pronto_para_diagramacao',
    'em_diagramacao',
    'em_revisao_interna',
    'aguardando_aprovacao_cliente',
    'alteracoes_solicitadas',
    'em_ajustes',
    'aprovado',
    'finalizado',
    'arquivado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.design_version_status as enum ('em_producao', 'enviada', 'aprovada', 'rejeitada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_status as enum ('aprovado', 'alteracao_solicitada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.portfolio_status as enum ('publicado', 'rascunho');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. TABELA: profiles (identidade única para os 5 papéis, 1:1 com auth.users)
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  nome_completo text not null check (char_length(trim(nome_completo)) between 2 and 120),
  telefone      text check (telefone is null or telefone ~ '^[0-9+()\s-]{8,20}$'),
  avatar_url    text,
  role          public.platform_role not null default 'cliente',
  status        text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Identidade única dos 5 papéis da plataforma. Criado por trigger no signup a partir do metadata enviado em supabase.auth.signUp().';

-- -----------------------------------------------------------------------------
-- 3. FUNÇÕES AUXILIARES DE PAPEL (dependem só de `profiles`, já existe acima)
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- SECURITY DEFINER é obrigatório: as próprias policies de `profiles` chamam
-- esta função e uma consulta comum a `profiles` disparia recursão de RLS.
create or replace function public.current_role_v()
returns public.platform_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function public.current_role_v() from public;
grant execute on function public.current_role_v() to anon, authenticated, service_role;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.current_role_v() = 'admin';
$$;

create or replace function public.is_equipe()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.current_role_v() in ('admin', 'gestor', 'operador');
$$;

create or replace function public.is_gestor_ou_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.current_role_v() in ('admin', 'gestor');
$$;

grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_equipe() to anon, authenticated, service_role;
grant execute on function public.is_gestor_ou_admin() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. GATILHOS DE profiles
-- -----------------------------------------------------------------------------

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, nome_completo, telefone, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.platform_role, 'cliente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sem este guard, qualquer usuário autenticado poderia fazer update no
-- próprio profile setando role='admin' (escalação de privilégio).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status) and not public.is_admin() then
    raise exception 'Alteração de papel/status não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- -----------------------------------------------------------------------------
-- 5. TABELA: planos (catálogo comercial — landing page /precos)
-- -----------------------------------------------------------------------------

create table if not exists public.planos (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  nome_plano        text not null,
  descricao         text,
  tipo_cobranca     public.billing_type not null,
  preco             numeric(10, 2) not null check (preco >= 0),
  moeda             char(3) not null default 'BRL',
  albuns_inclusos   integer check (albuns_inclusos is null or albuns_inclusos > 0),
  prazo_dias        integer not null check (prazo_dias > 0),
  revisoes_inclusas integer not null default 1 check (revisoes_inclusas >= 0),
  features_json     jsonb not null default '[]'::jsonb,
  destaque          boolean not null default false,
  ativo             boolean not null default true,
  ordem             smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_planos_ativo_ordem on public.planos (ativo, tipo_cobranca, ordem);

drop trigger if exists trg_planos_updated_at on public.planos;
create trigger trg_planos_updated_at
  before update on public.planos
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. TABELA: fotografos (extensão de profiles para role='fotografo')
-- -----------------------------------------------------------------------------

create table if not exists public.fotografos (
  id         uuid primary key references public.profiles (id) on delete cascade,
  estudio    text not null check (char_length(trim(estudio)) between 2 and 120),
  cidade     text,
  plano_id   uuid references public.planos (id) on delete set null,
  status     text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fotografos is
  'Dados comerciais do estúdio/fotógrafo. projetosCount/clientesCount da UI são agregados em query, não colunas.';

drop trigger if exists trg_fotografos_updated_at on public.fotografos;
create trigger trg_fotografos_updated_at
  before update on public.fotografos
  for each row execute function public.set_updated_at();

-- Só a equipe (admin/gestor) muda status/plano — o fotógrafo edita só os
-- próprios dados de contato.
create or replace function public.guard_fotografo_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_gestor_ou_admin()
     and (new.status is distinct from old.status or new.plano_id is distinct from old.plano_id) then
    raise exception 'Apenas a equipe pode alterar status/plano do fotógrafo' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_fotografo_admin_fields on public.fotografos;
create trigger trg_guard_fotografo_admin_fields
  before update on public.fotografos
  for each row execute function public.guard_fotografo_admin_fields();

-- -----------------------------------------------------------------------------
-- 7. TABELA: clientes (CRM do fotógrafo — nem sempre tem login no portal)
-- -----------------------------------------------------------------------------

create table if not exists public.clientes (
  id                   uuid primary key default gen_random_uuid(),
  -- Só é preenchido quando o cliente ganha acesso ao portal /cliente.
  user_id              uuid references public.profiles (id) on delete set null,
  fotografo_id         uuid not null references public.fotografos (id) on delete cascade,
  nome                 text not null check (char_length(trim(nome)) between 2 and 120),
  email                text not null,
  telefone             text,
  cidade               text,
  estado               text,
  origem               text,
  status               text not null default 'ativo' check (status in ('ativo', 'inativo')),
  observacoes_internas text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_clientes_fotografo on public.clientes (fotografo_id);
create unique index if not exists idx_clientes_user on public.clientes (user_id) where user_id is not null;

drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. TABELA: projetos (coração da plataforma — pipeline de 13 estágios)
-- -----------------------------------------------------------------------------

create table if not exists public.projetos (
  id             uuid primary key default gen_random_uuid(),
  numero         bigint generated always as identity (start with 1038),
  nome           text not null check (char_length(trim(nome)) between 2 and 160),
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  fotografo_id   uuid not null references public.fotografos (id) on delete cascade,
  -- Membro de equipe (operador) atribuído para diagramar — null até ser assumido.
  responsavel_id uuid references public.profiles (id) on delete set null,
  plano_id       uuid references public.planos (id) on delete set null,
  tipo_evento    text,
  data_evento    date,
  status         public.project_status not null default 'projeto_criado',
  prazo          timestamptz,
  meta_fotos     integer check (meta_fotos is null or meta_fotos > 0),
  -- AlbumConfig/Briefing (types/platform.ts) são objetos de formulário, não
  -- entidades relacionais — jsonb evita 20+ colunas nullable sem perder tipagem
  -- no lado do app (mesmo shape do mock).
  album_config   jsonb not null default '{}'::jsonb,
  briefing       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_projetos_fotografo on public.projetos (fotografo_id, created_at desc);
create index if not exists idx_projetos_cliente on public.projetos (cliente_id, created_at desc);
create index if not exists idx_projetos_responsavel on public.projetos (responsavel_id);
create index if not exists idx_projetos_status on public.projetos (status, created_at);

drop trigger if exists trg_projetos_updated_at on public.projetos;
create trigger trg_projetos_updated_at
  before update on public.projetos
  for each row execute function public.set_updated_at();

-- Agora que `projetos` e `clientes` existem: um projeto é "visível" para o
-- fotógrafo dono, o cliente final dono, o operador responsável atribuído, ou
-- qualquer membro de equipe (visão global da esteira). Centralizado aqui
-- porque 5 tabelas filhas reusam exatamente esta regra.
create or replace function public.pode_ver_projeto(p_projeto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.projetos p
    left join public.clientes c on c.id = p.cliente_id
    where p.id = p_projeto_id
      and (
        p.fotografo_id = auth.uid()
        or p.responsavel_id = auth.uid()
        or c.user_id = auth.uid()
        or public.is_equipe()
      )
  );
$$;

grant execute on function public.pode_ver_projeto(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. TABELAS FILHAS DE PROJETO
-- -----------------------------------------------------------------------------

create table if not exists public.fotos (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid not null references public.projetos (id) on delete cascade,
  storage_path  text not null,
  url           text,
  grupo         text,
  favorita      boolean not null default false,
  obrigatoria   boolean not null default false,
  destaque      boolean not null default false,
  capa          boolean not null default false,
  observacao    text,
  enviado_por   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_fotos_projeto on public.fotos (projeto_id);

create table if not exists public.design_versions (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid not null references public.projetos (id) on delete cascade,
  numero        integer not null,
  responsavel_id uuid references public.profiles (id) on delete set null,
  storage_path  text,
  arquivo_url   text,
  comentarios   text,
  status        public.design_version_status not null default 'em_producao',
  created_at    timestamptz not null default now(),
  unique (projeto_id, numero)
);

create index if not exists idx_design_versions_projeto on public.design_versions (projeto_id);

create table if not exists public.aprovacoes (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos (id) on delete cascade,
  versao      integer not null,
  usuario_id  uuid references public.profiles (id) on delete set null,
  status      public.approval_status not null,
  comentario  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_aprovacoes_projeto on public.aprovacoes (projeto_id, created_at desc);

create table if not exists public.projeto_atividades (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos (id) on delete cascade,
  autor_id    uuid references public.profiles (id) on delete set null,
  mensagem    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_projeto_atividades_projeto on public.projeto_atividades (projeto_id, created_at desc);

create table if not exists public.prova_comentarios (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos (id) on delete cascade,
  page_index  integer not null check (page_index >= 0),
  texto       text not null,
  autor_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_prova_comentarios_projeto on public.prova_comentarios (projeto_id, created_at);

-- Toda aprovação/solicitação de alteração do cliente move o status do projeto
-- e deixa rastro na timeline — server-side, para o cliente nunca precisar (e
-- nunca poder) dar UPDATE direto em `projetos`.
create or replace function public.aplicar_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.projetos
    set status = case when new.status = 'aprovado' then 'aprovado'::public.project_status
                       else 'alteracoes_solicitadas'::public.project_status end
    where id = new.projeto_id;

  insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
  values (
    new.projeto_id,
    new.usuario_id,
    case when new.status = 'aprovado' then 'Cliente aprovou a versão ' || new.versao
         else 'Cliente solicitou alterações na versão ' || new.versao end
  );
  return new;
end;
$$;

drop trigger if exists trg_aplicar_aprovacao on public.aprovacoes;
create trigger trg_aplicar_aprovacao
  after insert on public.aprovacoes
  for each row execute function public.aplicar_aprovacao();

-- -----------------------------------------------------------------------------
-- 10. VITRINE E BIBLIOTECA DE MÍDIA (Fase 5)
-- -----------------------------------------------------------------------------

create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null,
  url          text,
  nome         text not null,
  tags         text[] not null default '{}',
  largura_px   integer,
  altura_px    integer,
  tamanho_kb   integer,
  criado_por   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.banners (
  id         uuid primary key default gen_random_uuid(),
  imagem_id  uuid references public.media_assets (id) on delete set null,
  titulo     text not null,
  subtitulo  text,
  link_cta   text,
  ativo      boolean not null default true,
  ordem      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_banners_updated_at on public.banners;
create trigger trg_banners_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

create table if not exists public.portfolio_collections (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  descricao      text,
  capa_imagem_id uuid references public.media_assets (id) on delete set null,
  status         public.portfolio_status not null default 'rascunho',
  ordem          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_portfolio_collections_updated_at on public.portfolio_collections;
create trigger trg_portfolio_collections_updated_at
  before update on public.portfolio_collections
  for each row execute function public.set_updated_at();

create table if not exists public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.portfolio_collections (id) on delete cascade,
  imagem_id     uuid not null references public.media_assets (id) on delete cascade,
  legenda       text,
  ordem         integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_portfolio_items_collection on public.portfolio_items (collection_id, ordem);

-- -----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.planos                enable row level security;
alter table public.fotografos            enable row level security;
alter table public.clientes              enable row level security;
alter table public.projetos              enable row level security;
alter table public.fotos                 enable row level security;
alter table public.design_versions       enable row level security;
alter table public.aprovacoes            enable row level security;
alter table public.projeto_atividades    enable row level security;
alter table public.prova_comentarios     enable row level security;
alter table public.media_assets          enable row level security;
alter table public.banners               enable row level security;
alter table public.portfolio_collections enable row level security;
alter table public.portfolio_items       enable row level security;

alter table public.profiles   force row level security;
alter table public.fotografos force row level security;
alter table public.clientes   force row level security;
alter table public.projetos   force row level security;

-- ---- profiles ---------------------------------------------------------------

drop policy if exists "profiles_select_own_or_equipe" on public.profiles;
create policy "profiles_select_own_or_equipe"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_equipe());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete to authenticated
  using (public.is_admin());

-- ---- planos -------------------------------------------------------------

drop policy if exists "planos_select_public" on public.planos;
create policy "planos_select_public"
  on public.planos for select to anon, authenticated
  using (ativo = true or public.is_gestor_ou_admin());

drop policy if exists "planos_write_admin" on public.planos;
create policy "planos_write_admin"
  on public.planos for all to authenticated
  using (public.is_gestor_ou_admin())
  with check (public.is_gestor_ou_admin());

-- ---- fotografos ---------------------------------------------------------

drop policy if exists "fotografos_select_own_or_equipe" on public.fotografos;
create policy "fotografos_select_own_or_equipe"
  on public.fotografos for select to authenticated
  using (id = auth.uid() or public.is_equipe());

drop policy if exists "fotografos_insert_self_or_equipe" on public.fotografos;
create policy "fotografos_insert_self_or_equipe"
  on public.fotografos for insert to authenticated
  with check (id = auth.uid() or public.is_gestor_ou_admin());

drop policy if exists "fotografos_update_own_or_equipe" on public.fotografos;
create policy "fotografos_update_own_or_equipe"
  on public.fotografos for update to authenticated
  using (id = auth.uid() or public.is_gestor_ou_admin())
  with check (id = auth.uid() or public.is_gestor_ou_admin());

drop policy if exists "fotografos_delete_admin" on public.fotografos;
create policy "fotografos_delete_admin"
  on public.fotografos for delete to authenticated
  using (public.is_admin());

-- ---- clientes -------------------------------------------------------------
-- Regra inegociável: um fotógrafo só enxerga os próprios clientes; um cliente
-- só enxerga o próprio registro.

drop policy if exists "clientes_select_own_scope" on public.clientes;
create policy "clientes_select_own_scope"
  on public.clientes for select to authenticated
  using (fotografo_id = auth.uid() or user_id = auth.uid() or public.is_equipe());

drop policy if exists "clientes_write_fotografo_ou_equipe" on public.clientes;
create policy "clientes_write_fotografo_ou_equipe"
  on public.clientes for insert to authenticated
  with check (fotografo_id = auth.uid() or public.is_gestor_ou_admin());

drop policy if exists "clientes_update_fotografo_ou_equipe" on public.clientes;
create policy "clientes_update_fotografo_ou_equipe"
  on public.clientes for update to authenticated
  using (fotografo_id = auth.uid() or public.is_gestor_ou_admin())
  with check (fotografo_id = auth.uid() or public.is_gestor_ou_admin());

drop policy if exists "clientes_delete_fotografo_ou_equipe" on public.clientes;
create policy "clientes_delete_fotografo_ou_equipe"
  on public.clientes for delete to authenticated
  using (fotografo_id = auth.uid() or public.is_gestor_ou_admin());

-- ---- projetos -------------------------------------------------------------
-- Regra inegociável: um fotógrafo só acessa seus próprios projetos; um
-- cliente só acessa o(s) projeto(s) do próprio registro em `clientes`.

drop policy if exists "projetos_select_scope" on public.projetos;
create policy "projetos_select_scope"
  on public.projetos for select to authenticated
  using (
    fotografo_id = auth.uid()
    or responsavel_id = auth.uid()
    or exists (select 1 from public.clientes c where c.id = cliente_id and c.user_id = auth.uid())
    or public.is_equipe()
  );

drop policy if exists "projetos_insert_scope" on public.projetos;
create policy "projetos_insert_scope"
  on public.projetos for insert to authenticated
  with check (fotografo_id = auth.uid() or public.is_gestor_ou_admin());

-- Update fica aberto a fotógrafo/equipe (a granularidade fina por ação —
-- visualizar/criar/editar/atribuir/aprovar — já é aplicada na camada de
-- aplicação via requireModuleAction). O cliente NUNCA tem update aqui: ele
-- só insere em `aprovacoes`, que move o status via trigger SECURITY DEFINER.
drop policy if exists "projetos_update_fotografo_ou_equipe" on public.projetos;
create policy "projetos_update_fotografo_ou_equipe"
  on public.projetos for update to authenticated
  using (fotografo_id = auth.uid() or public.is_equipe())
  with check (fotografo_id = auth.uid() or public.is_equipe());

drop policy if exists "projetos_delete_equipe" on public.projetos;
create policy "projetos_delete_equipe"
  on public.projetos for delete to authenticated
  using (public.is_gestor_ou_admin());

-- ---- tabelas filhas de projeto (mesma regra: se vê o projeto, vê o filho) --

drop policy if exists "fotos_select" on public.fotos;
create policy "fotos_select" on public.fotos for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

drop policy if exists "fotos_insert" on public.fotos;
create policy "fotos_insert" on public.fotos for insert to authenticated
  with check (public.pode_ver_projeto(projeto_id));

drop policy if exists "fotos_delete" on public.fotos;
create policy "fotos_delete" on public.fotos for delete to authenticated
  using (public.pode_ver_projeto(projeto_id) and (enviado_por = auth.uid() or public.is_equipe() or exists (
    select 1 from public.projetos p where p.id = projeto_id and p.fotografo_id = auth.uid()
  )));

drop policy if exists "design_versions_select" on public.design_versions;
create policy "design_versions_select" on public.design_versions for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

drop policy if exists "design_versions_write_equipe" on public.design_versions;
create policy "design_versions_write_equipe" on public.design_versions for all to authenticated
  using (public.is_equipe()) with check (public.is_equipe());

drop policy if exists "aprovacoes_select" on public.aprovacoes;
create policy "aprovacoes_select" on public.aprovacoes for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

-- Só o dono do projeto (cliente final) registra aprovação/pedido de ajuste.
drop policy if exists "aprovacoes_insert_cliente" on public.aprovacoes;
create policy "aprovacoes_insert_cliente" on public.aprovacoes for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.projetos p
      join public.clientes c on c.id = p.cliente_id
      where p.id = projeto_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "projeto_atividades_select" on public.projeto_atividades;
create policy "projeto_atividades_select" on public.projeto_atividades for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

drop policy if exists "projeto_atividades_insert" on public.projeto_atividades;
create policy "projeto_atividades_insert" on public.projeto_atividades for insert to authenticated
  with check (public.pode_ver_projeto(projeto_id));

drop policy if exists "prova_comentarios_select" on public.prova_comentarios;
create policy "prova_comentarios_select" on public.prova_comentarios for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

drop policy if exists "prova_comentarios_insert_cliente" on public.prova_comentarios;
create policy "prova_comentarios_insert_cliente" on public.prova_comentarios for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.projetos p
      join public.clientes c on c.id = p.cliente_id
      where p.id = projeto_id and c.user_id = auth.uid()
    )
  );

-- ---- vitrine / mídia (marketing) -------------------------------------------

drop policy if exists "media_assets_select_equipe" on public.media_assets;
create policy "media_assets_select_equipe" on public.media_assets for select to authenticated
  using (public.is_gestor_ou_admin());

drop policy if exists "media_assets_write_equipe" on public.media_assets;
create policy "media_assets_write_equipe" on public.media_assets for all to authenticated
  using (public.is_gestor_ou_admin()) with check (public.is_gestor_ou_admin());

drop policy if exists "banners_select_public_or_equipe" on public.banners;
create policy "banners_select_public_or_equipe" on public.banners for select to anon, authenticated
  using (ativo = true or public.is_gestor_ou_admin());

drop policy if exists "banners_write_equipe" on public.banners;
create policy "banners_write_equipe" on public.banners for all to authenticated
  using (public.is_gestor_ou_admin()) with check (public.is_gestor_ou_admin());

drop policy if exists "portfolio_collections_select_public_or_equipe" on public.portfolio_collections;
create policy "portfolio_collections_select_public_or_equipe" on public.portfolio_collections for select to anon, authenticated
  using (status = 'publicado' or public.is_gestor_ou_admin());

drop policy if exists "portfolio_collections_write_equipe" on public.portfolio_collections;
create policy "portfolio_collections_write_equipe" on public.portfolio_collections for all to authenticated
  using (public.is_gestor_ou_admin()) with check (public.is_gestor_ou_admin());

drop policy if exists "portfolio_items_select_public_or_equipe" on public.portfolio_items;
create policy "portfolio_items_select_public_or_equipe" on public.portfolio_items for select to anon, authenticated
  using (
    public.is_gestor_ou_admin()
    or exists (select 1 from public.portfolio_collections pc where pc.id = collection_id and pc.status = 'publicado')
  );

drop policy if exists "portfolio_items_write_equipe" on public.portfolio_items;
create policy "portfolio_items_write_equipe" on public.portfolio_items for all to authenticated
  using (public.is_gestor_ou_admin()) with check (public.is_gestor_ou_admin());

-- -----------------------------------------------------------------------------
-- 12. STORAGE
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('projetos_fotos', 'projetos_fotos', false, 314572800), -- 300 MB, privado (fotos de clientes)
  ('midia_vitrine', 'midia_vitrine', true, 52428800)       -- 50 MB, público (site de marketing)
on conflict (id) do nothing;

-- Convenção de path: projetos_fotos/{projeto_id}/{arquivo}
drop policy if exists "projetos_fotos_read" on storage.objects;
create policy "projetos_fotos_read" on storage.objects for select to authenticated
  using (bucket_id = 'projetos_fotos' and public.pode_ver_projeto(((storage.foldername(name))[1])::uuid));

drop policy if exists "projetos_fotos_write" on storage.objects;
create policy "projetos_fotos_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'projetos_fotos' and public.pode_ver_projeto(((storage.foldername(name))[1])::uuid));

drop policy if exists "projetos_fotos_delete" on storage.objects;
create policy "projetos_fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'projetos_fotos' and public.pode_ver_projeto(((storage.foldername(name))[1])::uuid));

-- midia_vitrine é o storage do marketing: leitura pública (site), escrita só equipe.
drop policy if exists "midia_vitrine_read_public" on storage.objects;
create policy "midia_vitrine_read_public" on storage.objects for select to anon, authenticated
  using (bucket_id = 'midia_vitrine');

drop policy if exists "midia_vitrine_write_equipe" on storage.objects;
create policy "midia_vitrine_write_equipe" on storage.objects for all to authenticated
  using (bucket_id = 'midia_vitrine' and public.is_gestor_ou_admin())
  with check (bucket_id = 'midia_vitrine' and public.is_gestor_ou_admin());

-- -----------------------------------------------------------------------------
-- 13. SEED — catálogo inicial de planos
-- -----------------------------------------------------------------------------

insert into public.planos
  (slug, nome_plano, descricao, tipo_cobranca, preco, albuns_inclusos, prazo_dias,
   revisoes_inclusas, destaque, ordem, features_json)
values
  ('essencial-avulso', 'Essencial', 'Para o fotógrafo que entrega poucos álbuns por ano.',
   'avulso', 249.00, null, 7, 1, false, 1, '[]'::jsonb),
  ('plus-avulso', 'Plus', 'O equilíbrio entre prazo, curadoria e revisões.',
   'avulso', 389.00, null, 4, 3, true, 2, '[]'::jsonb),
  ('studio-avulso', 'Studio', 'Volume alto com gerente de conta dedicado.',
   'avulso', 590.00, null, 2, 5, false, 3, '[]'::jsonb),
  ('essencial-mensal', 'Essencial', 'Até 2 álbuns por mês.',
   'assinatura', 399.00, 2, 7, 1, false, 1, '[]'::jsonb),
  ('plus-mensal', 'Plus', 'Até 5 álbuns por mês com curadoria inclusa.',
   'assinatura', 890.00, 5, 4, 3, true, 2, '[]'::jsonb),
  ('studio-mensal', 'Studio', 'Álbuns ilimitados com SLA contratual.',
   'assinatura', 1690.00, 12, 2, 5, false, 3, '[]'::jsonb)
on conflict (slug) do nothing;
