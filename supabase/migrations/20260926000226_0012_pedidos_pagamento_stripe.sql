-- =============================================================================
-- Migration 0012: pagamento do pedido via Stripe Checkout
--
-- Fluxo: pedido nasce `pendente` → fotógrafo paga no Stripe Checkout → o
-- webhook (/api/webhooks/pagamento, com a service role) move para
-- `na_fila_design` e grava `pago_em` / `valor_pago`.
--
-- O trigger `guard_order_admin_fields` passa a:
--   - aceitar a service role (webhook de pagamento, sem usuário logado);
--   - travar `pago_em` e `valor_pago` para quem não é equipe — o fotógrafo
--     edita o próprio pedido enquanto `pendente` (RLS), mas não se "paga".
-- `stripe_checkout_session_id` fica livre de propósito: a Server Action grava
-- com a sessão do fotógrafo para reaproveitar um checkout ainda aberto. O
-- webhook não confia nele — o pedido vem do `metadata` da sessão no Stripe.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

alter type public.order_status add value if not exists 'na_fila_design' after 'pendente';

alter table public.orders
  add column if not exists pago_em                    timestamptz,
  add column if not exists valor_pago                 numeric(10, 2),
  add column if not exists stripe_checkout_session_id text;

do $$ begin
  alter table public.orders
    add constraint orders_valor_pago_check check (valor_pago is null or valor_pago >= 0);
exception when duplicate_object then null; end $$;

create index if not exists idx_orders_stripe_session on public.orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create or replace function public.guard_order_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Equipe (admin) e a service role (webhooks de servidor) mexem em tudo.
  if public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
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
     or new.pago_em            is distinct from old.pago_em
     or new.valor_pago         is distinct from old.valor_pago
     or new.fotos_enviadas     is distinct from old.fotos_enviadas
  then
    raise exception 'Campos de produção só podem ser alterados pela equipe'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_order_admin_fields() from public, anon, authenticated;

-- O trigger acima só roda em UPDATE: no INSERT, quem não é equipe também não
-- pode nascer com o pedido "pago".
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert to authenticated
  with check (
    (client_id = auth.uid() and status = 'pendente' and pago_em is null and valor_pago is null)
    or public.is_equipe()
  );
