-- =============================================================================
-- Migration 0003: compatibilidade com o fluxo self-service pré-existente do
-- fotógrafo (/dashboard, /dashboard/novo-pedido, /dashboard/meus-albuns,
-- /admin/pedidos) — mais simples e paralelo ao pipeline rico de `projetos`
-- (usado pelo admin/produção/portal do cliente). Os dois convivem: o
-- fotógrafo manda um pedido rápido aqui; a operação rica acontece em
-- `projetos` quando a equipe formaliza o trabalho.
-- =============================================================================

do $$ begin
  create type public.order_status as enum (
    'pendente', 'em_producao', 'aguardando_aprovacao', 'em_revisao', 'finalizado', 'cancelado'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  numero             bigint generated always as identity (start with 1000),
  client_id          uuid not null references public.profiles (id) on delete cascade,
  plan_id            uuid references public.planos (id) on delete set null,

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

create index if not exists idx_orders_client on public.orders (client_id, created_at desc);
create index if not exists idx_orders_status on public.orders (status, created_at);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

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

revoke execute on function public.guard_order_admin_fields() from public, anon, authenticated;

drop trigger if exists trg_guard_order_admin_fields on public.orders;
create trigger trg_guard_order_admin_fields
  before update on public.orders
  for each row execute function public.guard_order_admin_fields();

alter table public.orders enable row level security;
alter table public.orders force row level security;

drop policy if exists "orders_select_own_or_equipe" on public.orders;
create policy "orders_select_own_or_equipe"
  on public.orders for select to authenticated
  using (client_id = auth.uid() or public.is_equipe());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert to authenticated
  with check ((client_id = auth.uid() and status = 'pendente') or public.is_equipe());

drop policy if exists "orders_update_own_while_pendente" on public.orders;
create policy "orders_update_own_while_pendente"
  on public.orders for update to authenticated
  using ((client_id = auth.uid() and status = 'pendente') or public.is_equipe())
  with check (client_id = auth.uid() or public.is_equipe());

drop policy if exists "orders_delete_own_while_pendente" on public.orders;
create policy "orders_delete_own_while_pendente"
  on public.orders for delete to authenticated
  using ((client_id = auth.uid() and status = 'pendente') or public.is_gestor_ou_admin());

insert into storage.buckets (id, name, public, file_size_limit)
values ('album-deliverables', 'album-deliverables', false, 524288000)
on conflict (id) do nothing;

drop policy if exists "deliverables_read_owner_or_equipe" on storage.objects;
create policy "deliverables_read_owner_or_equipe"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'album-deliverables'
    and (
      public.is_equipe()
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1] and o.client_id = auth.uid()
      )
    )
  );

drop policy if exists "deliverables_write_equipe" on storage.objects;
create policy "deliverables_write_equipe"
  on storage.objects for all to authenticated
  using (bucket_id = 'album-deliverables' and public.is_equipe())
  with check (bucket_id = 'album-deliverables' and public.is_equipe());

-- Cadastro público (register-form.tsx) é sempre fotógrafo: o trigger agora
-- também provisiona a extensão `fotografos` quando o metadata trouxer role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.platform_role;
begin
  v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.platform_role, 'cliente');

  insert into public.profiles (id, email, nome_completo, telefone, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'nome_contato'), ''),
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
