-- =============================================================================
-- Migration 0035: checkout real (Stripe) das faturas de fechamento
--
-- Até aqui a fatura de fechamento (lâminas extras e/ou adicionais, 0023/0026)
-- só fechava por `pagar_fatura_simulada`. Agora o estúdio paga pelo Stripe
-- Checkout, no mesmo estilo dos pedidos:
--
--   1. `preparar_checkout_fatura` — o app pergunta ao BANCO se a fatura pode
--      ser paga e por quanto. Mesmas travas do pagamento simulado: só o estúdio
--      dono do projeto, fatura `pendente`, nenhum adicional aguardando o
--      estúdio, valor > 0. O valor nunca vem do navegador.
--   2. `registrar_checkout_fatura` — guarda o id da Checkout Session na fatura
--      (reaproveitar a sessão aberta em vez de abrir outra; auditoria).
--      O estúdio não tem UPDATE em `faturas` (RLS), por isso a função.
--   3. `pagamento_simulado_ativo` — a tela decide entre o botão simulado e o
--      checkout real sem enxergar `private.app_config`.
--
-- A confirmação continua em `confirmar_pagamento_fatura` (0026b, só
-- service_role, idempotente), chamada pelo webhook /api/webhooks/pagamento
-- quando a sessão traz `metadata.fatura_id`.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Sessão do Stripe na fatura
-- -----------------------------------------------------------------------------

alter table public.faturas
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists idx_faturas_stripe_checkout_session
  on public.faturas (stripe_checkout_session_id) where stripe_checkout_session_id is not null;

-- -----------------------------------------------------------------------------
-- 2. Modo simulado visível para a tela (só o booleano, nada mais da config)
-- -----------------------------------------------------------------------------

create or replace function public.pagamento_simulado_ativo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select value from private.app_config where key = 'pagamento_simulado'), 'false') = 'true';
$$;

revoke execute on function public.pagamento_simulado_ativo() from public, anon;
grant execute on function public.pagamento_simulado_ativo() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. O que cobrar — e se pode cobrar
-- -----------------------------------------------------------------------------

create or replace function public.preparar_checkout_fatura(p_fatura_id uuid)
returns table (
  fatura_id                  uuid,
  projeto_id                 uuid,
  projeto_nome               text,
  projeto_numero             integer,
  valor_total                numeric,
  stripe_checkout_session_id text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  f record;
begin
  select fa.id, fa.projeto_id, fa.status_pagamento, fa.valor_total, fa.stripe_checkout_session_id,
         p.fotografo_id, p.nome, p.numero
    into f
    from public.faturas fa join public.projetos p on p.id = fa.projeto_id
    where fa.id = p_fatura_id;
  if not found or f.status_pagamento <> 'pendente' then
    raise exception 'Fatura não encontrada ou já processada.' using errcode = '42704';
  end if;
  if f.fotografo_id is distinct from auth.uid() then
    raise exception 'Só o estúdio dono do projeto paga esta fatura.' using errcode = '42501';
  end if;
  if public._fatura_tem_item_aguardando(p_fatura_id) then
    raise exception 'Confirme ou recuse os adicionais pedidos pelo cliente antes de pagar.' using errcode = 'P0001';
  end if;
  if f.valor_total <= 0 then
    raise exception 'Fatura sem valor a cobrar.' using errcode = 'P0001';
  end if;

  return query select f.id, f.projeto_id, f.nome::text, f.numero::integer, f.valor_total, f.stripe_checkout_session_id;
end;
$$;

revoke execute on function public.preparar_checkout_fatura(uuid) from public, anon;
grant execute on function public.preparar_checkout_fatura(uuid) to authenticated;

create or replace function public.registrar_checkout_fatura(p_fatura_id uuid, p_session_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_session_id is null or p_session_id !~ '^cs_[A-Za-z0-9_]+$' then
    raise exception 'Sessão de pagamento inválida.' using errcode = '22023';
  end if;

  update public.faturas fa
    set stripe_checkout_session_id = p_session_id
    from public.projetos p
    where fa.id = p_fatura_id
      and p.id = fa.projeto_id
      and p.fotografo_id = auth.uid()
      and fa.status_pagamento = 'pendente';
  if not found then
    raise exception 'Fatura não encontrada ou já processada.' using errcode = '42704';
  end if;
end;
$$;

revoke execute on function public.registrar_checkout_fatura(uuid, text) from public, anon;
grant execute on function public.registrar_checkout_fatura(uuid, text) to authenticated;
