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
