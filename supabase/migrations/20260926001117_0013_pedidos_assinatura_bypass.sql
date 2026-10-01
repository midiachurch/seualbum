-- =============================================================================
-- Migration 0013: pedido de assinante entra direto na fila de design
--
-- Plano avulso → pedido nasce `pendente` (paga no Stripe Checkout).
-- Plano de assinatura → nasce `na_fila_design`, sem cobrança avulsa — MAS só
-- se for o plano contratado pelo estúdio (`fotografos.plano_id`, que só
-- gestor/admin altera, ver `guard_fotografo_admin_fields`). Sem essa checagem,
-- qualquer fotógrafo escolheria um plano mensal no wizard e pularia o
-- pagamento. O limite de álbuns/mês continua operacional no MVP.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

-- Plano de assinatura ativo do fotógrafo logado (null se não é assinante).
create or replace function public.minha_assinatura()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.plano_id
  from public.fotografos f
  join public.planos p on p.id = f.plano_id
  where f.id = auth.uid()
    and f.status = 'ativo'
    and p.tipo_cobranca = 'assinatura';
$$;

revoke execute on function public.minha_assinatura() from public, anon;
grant execute on function public.minha_assinatura() to authenticated;

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert to authenticated
  with check (
    (
      client_id = auth.uid()
      and pago_em is null
      and valor_pago is null
      and (
        status = 'pendente'
        or (status = 'na_fila_design' and plan_id is not null and plan_id = public.minha_assinatura())
      )
    )
    or public.is_equipe()
  );
