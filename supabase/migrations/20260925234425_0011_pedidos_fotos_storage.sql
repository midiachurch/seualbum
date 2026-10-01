-- =============================================================================
-- Migration 0011: upload direto das fotos do pedido (wizard, passo 3)
--
-- Bucket privado `pedidos_fotos`. Convenção de path:
--   {client_id}/{chave_idempotencia}/{arquivo}
-- As fotos sobem ANTES do pedido existir (o fotógrafo ainda está no wizard),
-- então a pasta é a chave do rascunho — a mesma que vira
-- `orders.chave_idempotencia` no envio. A equipe acha as fotos de um pedido
-- pelo prefixo `{client_id}/{chave_idempotencia}/`.
--
-- `orders.link_fotos_brutas` passa a ser opcional: o pedido precisa ter o link
-- externo OU fotos enviadas (`fotos_enviadas`, contado pela Server Action no
-- Storage, não informado pelo navegador).
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pedidos_fotos',
  'pedidos_fotos',
  false,
  52428800, -- 50 MB por foto
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "pedidos_fotos_insert_dono" on storage.objects;
create policy "pedidos_fotos_insert_dono" on storage.objects for insert to authenticated
  with check (bucket_id = 'pedidos_fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pedidos_fotos_select_dono_ou_equipe" on storage.objects;
create policy "pedidos_fotos_select_dono_ou_equipe" on storage.objects for select to authenticated
  using (
    bucket_id = 'pedidos_fotos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_equipe())
  );

-- O fotógrafo remove fotos do próprio rascunho; depois que o pedido foi
-- enviado, as fotos dele ficam travadas (só a gestão apaga).
drop policy if exists "pedidos_fotos_delete_rascunho" on storage.objects;
create policy "pedidos_fotos_delete_rascunho" on storage.objects for delete to authenticated
  using (
    bucket_id = 'pedidos_fotos'
    and (
      public.is_gestor_ou_admin()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and not exists (
          select 1 from public.orders o
          where o.chave_idempotencia::text = (storage.foldername(name))[2]
        )
      )
    )
  );

alter table public.orders
  add column if not exists fotos_enviadas integer not null default 0;

alter table public.orders alter column link_fotos_brutas drop not null;

do $$ begin
  alter table public.orders
    add constraint orders_fotos_enviadas_check check (fotos_enviadas >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders
    add constraint orders_origem_fotos_check
    check (link_fotos_brutas is not null or fotos_enviadas > 0);
exception when duplicate_object then null; end $$;
