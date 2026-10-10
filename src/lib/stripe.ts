import 'server-only'

import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Cliente Stripe criado sob demanda: instanciar no import quebraria o build
 * (e qualquer página que importe este módulo) quando `STRIPE_SECRET_KEY` não
 * estiver configurada. Sem `apiVersion` explícita = a versão fixada no SDK.
 */
let client: Stripe | null = null

export function stripeConfigurado() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurada')
  client ??= new Stripe(key, { appInfo: { name: 'SeuAlbum' } })
  return client
}

export type ResultadoConfirmacao =
  | 'confirmado'
  | 'ja_processado'
  | 'aguardando_pagamento'
  | 'sem_pedido'
  | 'sem_service_role'
  | 'erro'

/**
 * Marca o pedido como pago a partir de uma Checkout Session VINDA DO STRIPE
 * (webhook assinado ou `sessions.retrieve`) — nunca de dados do navegador.
 *
 * Usada pelo webhook e pela página de sucesso: a que chegar primeiro confirma,
 * a outra cai em `ja_processado` (o UPDATE só pega pedido ainda `pendente`).
 * Pix confirma depois (`async_payment_succeeded`); até lá `payment_status`
 * é `unpaid`.
 */
export async function confirmarPagamentoPorSessao(session: Stripe.Checkout.Session): Promise<ResultadoConfirmacao> {
  const pedidoId = session.metadata?.pedido_id
  if (!pedidoId) return 'sem_pedido'
  if (session.payment_status !== 'paid') return 'aguardando_pagamento'

  // Sem usuário logado (webhook) e mudando status: só a service role passa
  // pelo trigger `guard_order_admin_fields` (migration 0012).
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    console.error('[pagamento] SUPABASE_SERVICE_ROLE_KEY ausente — pedido', pedidoId, 'pago mas não confirmado')
    return 'sem_service_role'
  }

  const { data, error } = await admin
    .from('orders')
    .update({
      status: 'na_fila_design',
      pago_em: new Date().toISOString(),
      valor_pago: (session.amount_total ?? 0) / 100,
      stripe_checkout_session_id: session.id,
    })
    .eq('id', pedidoId)
    .eq('status', 'pendente')
    .select('numero')

  if (error) {
    console.error('[pagamento] update', pedidoId, error)
    return 'erro'
  }
  if (!data || data.length === 0) {
    // Já confirmado pela outra via — ou pago duas vezes (dois checkouts abertos).
    console.warn('[pagamento] pedido', pedidoId, 'não estava pendente; sessão', session.id)
    return 'ja_processado'
  }

  console.log('[pagamento] pedido', pedidoId, `#${data[0].numero}`, 'pago — na fila de design')
  return 'confirmado'
}

/* ------------------------------------------------------------------------ */
/* Faturas de fechamento (lâminas extras / adicionais) — migration 0035     */
/* ------------------------------------------------------------------------ */

export type ResultadoConfirmacaoFatura =
  | 'confirmado'
  | 'ja_processado'
  | 'aguardando_pagamento'
  | 'sem_fatura'
  /** Pago, mas a fatura já foi encerrada (dispensada/cancelada) ou o banco recusou — estorno manual. */
  | 'recusado'
  /** O valor pago no Stripe não bate com a fatura — ninguém libera nada sozinho. */
  | 'valor_divergente'
  | 'sem_service_role'
  | 'erro'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Metadata que identifica uma Checkout Session de fatura de fechamento. */
export function ehSessaoDeFatura(session: Pick<Stripe.Checkout.Session, 'metadata'>) {
  return Boolean(session.metadata?.fatura_id)
}

/**
 * Pix ou cartão, a partir da sessão. Com o PaymentIntent expandido
 * (`payment_intent.payment_method`) a resposta é exata; sem ele (eventos do
 * webhook), o evento decide: Pix é o único método assíncrono habilitado, então
 * `async_payment_succeeded` é Pix e `completed` já pago é cartão.
 */
export function formaDaSessao(session: Stripe.Checkout.Session, tipoEvento?: string): 'pix' | 'cartao' {
  const intent = session.payment_intent
  if (intent && typeof intent === 'object' && intent.payment_method && typeof intent.payment_method === 'object') {
    return intent.payment_method.type === 'pix' ? 'pix' : 'cartao'
  }
  if (tipoEvento === 'checkout.session.async_payment_succeeded') return 'pix'
  return 'cartao'
}

/**
 * Fecha a fatura de fechamento paga, a partir de uma Checkout Session VINDA DO
 * STRIPE (webhook assinado ou `sessions.retrieve`) — nunca de dados do
 * navegador. Quem libera para impressão é `confirmar_pagamento_fatura` (só
 * service_role, idempotente): webhook e página de retorno podem chegar juntos.
 *
 * Só devolve `erro`/`sem_service_role` quando vale o Stripe reenviar; regra de
 * negócio (fatura encerrada, valor diferente) é registrada e respondida 2xx —
 * repetir não resolveria, precisa de gente olhando.
 */
export async function confirmarFaturaPorSessao(
  session: Stripe.Checkout.Session,
  tipoEvento?: string,
): Promise<ResultadoConfirmacaoFatura> {
  const faturaId = session.metadata?.fatura_id
  if (!faturaId || !UUID.test(faturaId)) return 'sem_fatura'
  if (session.payment_status !== 'paid') return 'aguardando_pagamento'

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    console.error('[pagamento] SUPABASE_SERVICE_ROLE_KEY ausente — fatura', faturaId, 'paga mas não confirmada')
    return 'sem_service_role'
  }

  const { data: fatura, error: erroLeitura } = await admin
    .from('faturas')
    .select('id, status_pagamento, valor_total, stripe_checkout_session_id')
    .eq('id', faturaId)
    .maybeSingle()
  if (erroLeitura) {
    console.error('[pagamento] fatura', faturaId, erroLeitura)
    return 'erro'
  }
  if (!fatura) {
    console.error('[pagamento] fatura', faturaId, 'não existe; sessão', session.id)
    return 'sem_fatura'
  }
  if (fatura.status_pagamento === 'pago') {
    // Reentrega do webhook ou a página de retorno: mesma sessão. Outra sessão
    // paga para a mesma fatura = cobrança em duplicidade — estornar.
    if (fatura.stripe_checkout_session_id && fatura.stripe_checkout_session_id !== session.id) {
      console.error('[pagamento] fatura', faturaId, 'já paga; sessão', session.id, 'diferente da registrada', fatura.stripe_checkout_session_id, '— conferir pagamento em duplicidade')
    }
    return 'ja_processado'
  }
  if (fatura.status_pagamento !== 'pendente') {
    console.error('[pagamento] fatura', faturaId, 'paga no Stripe mas já', fatura.status_pagamento, '— estornar; sessão', session.id)
    return 'recusado'
  }

  const esperado = Math.round(Number(fatura.valor_total) * 100)
  if (session.currency !== 'brl' || session.amount_total !== esperado) {
    console.error('[pagamento] fatura', faturaId, 'valor pago', session.amount_total, session.currency, '≠ esperado', esperado, 'brl; sessão', session.id)
    return 'valor_divergente'
  }

  const { error } = await admin.rpc('confirmar_pagamento_fatura', {
    p_fatura_id: faturaId,
    p_forma: formaDaSessao(session, tipoEvento),
  })
  if (error) {
    // P0001/42704: fatura encerrada ou com adicional aguardando — regra, não falha.
    if (error.code === 'P0001' || error.code === '42704') {
      console.error('[pagamento] fatura', faturaId, 'recusada pelo banco:', error.message, '; sessão', session.id)
      return 'recusado'
    }
    console.error('[pagamento] confirmar fatura', faturaId, error)
    return 'erro'
  }

  console.log('[pagamento] fatura', faturaId, 'paga — liberada para impressão')
  return 'confirmado'
}
