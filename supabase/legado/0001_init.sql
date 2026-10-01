-- =============================================================================
-- SeuAlbum — Migration 0001: schema inicial (profiles, plans, orders) + RLS
-- Alvo: Supabase / PostgreSQL 15+
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.user_role as enum ('client', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'avulso'     = pagamento por álbum entregue
  -- 'assinatura' = recorrência mensal com cota de álbuns
  create type public.billing_type as enum ('avulso', 'assinatura');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pendente',              -- recebido, aguardando triagem do estúdio
    'em_producao',           -- diagramação em andamento
    'aguardando_aprovacao',  -- link de prova enviado ao fotógrafo
    'em_revisao',            -- fotógrafo pediu alterações
    'finalizado',            -- aprovado e arquivos finais entregues
    'cancelado'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. FUNÇÕES AUXILIARES
-- -----------------------------------------------------------------------------

-- updated_at automático.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- SECURITY DEFINER é obrigatório: as policies de `profiles` chamam esta função e
-- uma consulta comum a `profiles` dispararia recursão infinita de RLS.
-- search_path fixo evita sequestro de resolução de nomes por schemas do usuário.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;

revoke execute on function public.is_admin(uuid) from public;
-- `anon` precisa de EXECUTE: a policy pública de `plans` chama is_admin() e o
-- planner pode avaliá-la mesmo quando o `or` curto-circuitaria. Sem sessão,
-- auth.uid() é null e a função retorna false.
grant execute on function public.is_admin(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. TABELA: profiles (extensão de auth.users)
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome_estudio  text not null check (char_length(trim(nome_estudio)) between 2 and 120),
  nome_contato  text,
  telefone      text check (telefone is null or telefone ~ '^[0-9+()\s-]{8,20}$'),
  instagram     text,
  avatar_url    text,
  role          public.user_role not null default 'client',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Dados comerciais do fotógrafo. 1:1 com auth.users, criado por trigger no signup.';

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Provisiona o profile no signup, lendo o metadata enviado em supabase.auth.signUp().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, nome_estudio, nome_contato, telefone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome_estudio'), ''), 'Novo Estúdio'),
    nullif(trim(new.raw_user_meta_data ->> 'nome_contato'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS não restringe colunas, apenas linhas. Sem este guard, um cliente poderia
-- fazer update no próprio profile setando role='admin' (escalação de privilégio).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Alteração de role não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- -----------------------------------------------------------------------------
-- 4. TABELA: plans (catálogo comercial)
-- -----------------------------------------------------------------------------

create table if not exists public.plans (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  nome_plano        text not null,
  descricao         text,
  tipo_cobranca     public.billing_type not null,
  preco             numeric(10, 2) not null check (preco >= 0),
  moeda             char(3) not null default 'BRL',
  -- Cota de álbuns/mês nas assinaturas; null em planos avulsos.
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

comment on column public.plans.features_json is
  'Array de { "chave": text, "label": text, "incluso": bool|text } para a tabela comparativa.';

create index if not exists idx_plans_ativo_ordem
  on public.plans (ativo, tipo_cobranca, ordem);

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. TABELA: orders (esteira de produção)
-- -----------------------------------------------------------------------------

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  -- Sequencial legível para comunicação com o cliente (#1042).
  numero             bigint generated always as identity (start with 1000),
  client_id          uuid not null references public.profiles (id) on delete cascade,
  -- Preserva o histórico mesmo se o plano sair do catálogo.
  plan_id            uuid references public.plans (id) on delete set null,

  nome_projeto       text not null check (char_length(trim(nome_projeto)) between 2 and 160),
  link_fotos_brutas  text not null check (link_fotos_brutas ~* '^https?://'),
  estilo_design      text not null,
  briefing           text,
  numero_paginas     integer check (numero_paginas is null or numero_paginas between 1 and 200),
  data_evento        date,

  status             public.order_status not null default 'pendente',
  link_aprovacao     text check (link_aprovacao is null or link_aprovacao ~* '^https?://'),
  link_entrega_final text check (link_entrega_final is null or link_entrega_final ~* '^https?://'),
  observacoes_admin  text,
  revisoes_usadas    integer not null default 0 check (revisoes_usadas >= 0),

  prazo_entrega      timestamptz,
  finalizado_em      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.orders is
  'Um pedido = um álbum na esteira. link_fotos_brutas é a URL do Drive/WeTransfer do fotógrafo.';

create index if not exists idx_orders_client on public.orders (client_id, created_at desc);
create index if not exists idx_orders_status on public.orders (status, created_at);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Segundo guard de coluna: o cliente é dono da linha, mas não do fluxo de
-- produção. Só o admin move status, links de prova e notas internas.
create or replace function public.guard_order_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    if new.status = 'finalizado' and old.status is distinct from 'finalizado' then
      new.finalizado_em := coalesce(new.finalizado_em, now());
    end if;
    return new;
  end if;

  if new.status            is distinct from old.status
     or new.link_aprovacao     is distinct from old.link_aprovacao
     or new.link_entrega_final is distinct from old.link_entrega_final
     or new.observacoes_admin  is distinct from old.observacoes_admin
     or new.revisoes_usadas    is distinct from old.revisoes_usadas
     or new.client_id          is distinct from old.client_id
     or new.numero             is distinct from old.numero
  then
    raise exception 'Campos de produção só podem ser alterados pela equipe'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_order_admin_fields on public.orders;
create trigger trg_guard_order_admin_fields
  before update on public.orders
  for each row execute function public.guard_order_admin_fields();

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.plans    enable row level security;
alter table public.orders   enable row level security;

-- Blindagem: nega acesso mesmo se alguma policy for removida por engano.
alter table public.profiles force row level security;
alter table public.orders   force row level security;

-- ---- profiles ---------------------------------------------------------------

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ---- plans ------------------------------------------------------------------

-- A landing page é pública: `anon` precisa ler o catálogo ativo.
drop policy if exists "plans_select_public" on public.plans;
create policy "plans_select_public"
  on public.plans for select
  to anon, authenticated
  using (ativo = true or public.is_admin());

drop policy if exists "plans_write_admin" on public.plans;
create policy "plans_write_admin"
  on public.plans for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- orders -----------------------------------------------------------------

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
  on public.orders for select
  to authenticated
  using (client_id = auth.uid() or public.is_admin());

-- O cliente só cria pedidos em nome próprio e sempre em 'pendente'.
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  to authenticated
  with check (
    (client_id = auth.uid() and status = 'pendente')
    or public.is_admin()
  );

-- Enquanto o pedido não entrou em produção o cliente ainda pode corrigir o
-- briefing. Depois disso a linha fica somente-leitura para ele.
drop policy if exists "orders_update_own_while_pendente" on public.orders;
create policy "orders_update_own_while_pendente"
  on public.orders for update
  to authenticated
  using (
    (client_id = auth.uid() and status = 'pendente')
    or public.is_admin()
  )
  with check (client_id = auth.uid() or public.is_admin());

drop policy if exists "orders_delete_own_while_pendente" on public.orders;
create policy "orders_delete_own_while_pendente"
  on public.orders for delete
  to authenticated
  using (
    (client_id = auth.uid() and status = 'pendente')
    or public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- 7. STORAGE — entregáveis do álbum (PDFs de prova, JPGs finais)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('album-deliverables', 'album-deliverables', false, 524288000) -- 500 MB
on conflict (id) do nothing;

-- Convenção de path: album-deliverables/{order_id}/{arquivo}
drop policy if exists "deliverables_read_owner_or_admin" on storage.objects;
create policy "deliverables_read_owner_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'album-deliverables'
    and (
      public.is_admin()
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1]
          and o.client_id = auth.uid()
      )
    )
  );

drop policy if exists "deliverables_write_admin" on storage.objects;
create policy "deliverables_write_admin"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'album-deliverables' and public.is_admin())
  with check (bucket_id = 'album-deliverables' and public.is_admin());

-- -----------------------------------------------------------------------------
-- 8. SEED — catálogo inicial
-- -----------------------------------------------------------------------------

insert into public.plans
  (slug, nome_plano, descricao, tipo_cobranca, preco, albuns_inclusos, prazo_dias,
   revisoes_inclusas, destaque, ordem, features_json)
values
  ('essencial-avulso', 'Essencial',
   'Para o fotógrafo que entrega poucos álbuns por ano.',
   'avulso', 249.00, null, 7, 1, false, 1,
   '[{"chave":"curadoria","label":"Curadoria de fotos","incluso":false},
     {"chave":"suporte","label":"Suporte","incluso":"E-mail"},
     {"chave":"arquivo_editavel","label":"Arquivo editável (.psd)","incluso":false}]'::jsonb),

  ('plus-avulso', 'Plus',
   'O equilíbrio entre prazo, curadoria e revisões.',
   'avulso', 389.00, null, 4, 3, true, 2,
   '[{"chave":"curadoria","label":"Curadoria de fotos","incluso":true},
     {"chave":"suporte","label":"Suporte","incluso":"WhatsApp"},
     {"chave":"arquivo_editavel","label":"Arquivo editável (.psd)","incluso":true}]'::jsonb),

  ('studio-avulso', 'Studio',
   'Volume alto com gerente de conta dedicado.',
   'avulso', 590.00, null, 2, 5, false, 3,
   '[{"chave":"curadoria","label":"Curadoria de fotos","incluso":true},
     {"chave":"suporte","label":"Suporte","incluso":"Gerente dedicado"},
     {"chave":"arquivo_editavel","label":"Arquivo editável (.psd)","incluso":true}]'::jsonb),

  ('essencial-mensal', 'Essencial', 'Até 2 álbuns por mês.',
   'assinatura', 399.00, 2, 7, 1, false, 1,
   '[{"chave":"curadoria","label":"Curadoria de fotos","incluso":false},
     {"chave":"suporte","label":"Suporte","incluso":"E-mail"},
     {"chave":"arquivo_editavel","label":"Arquivo editável (.psd)","incluso":false}]'::jsonb),

  ('plus-mensal', 'Plus', 'Até 5 álbuns por mês com curadoria inclusa.',
   'assinatura', 890.00, 5, 4, 3, true, 2,
   '[{"chave":"curadoria","label":"Curadoria de fotos","incluso":true},
     {"chave":"suporte","label":"Suporte","incluso":"WhatsApp"},
     {"chave":"arquivo_editavel","label":"Arquivo editável (.psd)","incluso":true}]'::jsonb),

  ('studio-mensal', 'Studio', 'Álbuns ilimitados com SLA contratual.',
   'assinatura', 1690.00, 12, 2, 5, false, 3,
   '[{"chave":"curadoria","label":"Curadoria de fotos","incluso":true},
     {"chave":"suporte","label":"Suporte","incluso":"Gerente dedicado"},
     {"chave":"arquivo_editavel","label":"Arquivo editável (.psd)","incluso":true}]'::jsonb)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- 9. PROMOVER O PRIMEIRO ADMIN (executar manualmente após o signup)
-- -----------------------------------------------------------------------------
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'voce@seudominio.com.br');
