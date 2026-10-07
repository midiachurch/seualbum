-- =============================================================================
-- Migration 0030: fotos do pedido no Cloudflare R2 (só a chave fica no banco)
--
-- O Supabase passa a guardar apenas banco e Auth; os arquivos de alta
-- resolução vão para o R2 (bucket privado, sem egress). Esta tabela é o
-- índice das fotos do wizard de novo pedido que já estão no R2. Convenção da
-- chave (espelha a pasta do bucket `pedidos_fotos`, migration 0011):
--   pedidos/{client_id}/{chave_idempotencia}/{idArquivo}-{nome}
--
-- Quem escreve é a rota /api/uploads/pedido-foto/confirmar, com a sessão do
-- fotógrafo (RLS abaixo), depois de conferir com HeadObject que o objeto
-- existe no R2. O navegador nunca informa tamanho/tipo sozinho.
--
-- Convive com o bucket `pedidos_fotos` enquanto a migração não termina: a
-- contagem do envio, a lista do admin, a conversão em projeto (0017/0025) e a
-- limpeza de 72h (0015/0016) ainda leem só o Storage do Supabase.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

create table if not exists public.pedidos_fotos_r2 (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.profiles (id) on delete cascade,
  chave_idempotencia uuid not null,
  r2_key             text not null unique,
  nome_original      text not null,
  tamanho            bigint not null check (tamanho > 0),
  content_type       text not null,
  created_at         timestamptz not null default now(),
  constraint pedidos_fotos_r2_key_do_dono
    check (r2_key like 'pedidos/' || client_id::text || '/' || chave_idempotencia::text || '/%')
);

create index if not exists idx_pedidos_fotos_r2_rascunho
  on public.pedidos_fotos_r2 (client_id, chave_idempotencia);

alter table public.pedidos_fotos_r2 enable row level security;

drop policy if exists "pedidos_fotos_r2_select_dono_ou_equipe" on public.pedidos_fotos_r2;
create policy "pedidos_fotos_r2_select_dono_ou_equipe" on public.pedidos_fotos_r2 for select to authenticated
  using (client_id = auth.uid() or public.is_equipe());

-- Só enquanto é rascunho: depois que o pedido existe, as fotos ficam travadas.
drop policy if exists "pedidos_fotos_r2_insert_rascunho" on public.pedidos_fotos_r2;
create policy "pedidos_fotos_r2_insert_rascunho" on public.pedidos_fotos_r2 for insert to authenticated
  with check (
    client_id = auth.uid()
    and not exists (
      select 1 from public.orders o where o.chave_idempotencia = pedidos_fotos_r2.chave_idempotencia
    )
  );

drop policy if exists "pedidos_fotos_r2_delete_rascunho" on public.pedidos_fotos_r2;
create policy "pedidos_fotos_r2_delete_rascunho" on public.pedidos_fotos_r2 for delete to authenticated
  using (
    public.is_gestor_ou_admin()
    or (
      client_id = auth.uid()
      and not exists (
        select 1 from public.orders o where o.chave_idempotencia = pedidos_fotos_r2.chave_idempotencia
      )
    )
  );

grant select, insert, delete on public.pedidos_fotos_r2 to authenticated;
