import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import {
  confirmarFaturaPorSessao,
  confirmarPagamentoPorSessao,
  ehSessaoDeFatura,
  getStripe,
  stripeConfigurado,
} from '@/lib/stripe'

/**
 * Webhook do Stripe Checkout. Autenticado pela assinatura `stripe-signature`
 * (STRIPE_WEBHOOK_SECRET) sobre o corpo CRU — por isso `request.text()`, não
 * `request.json()`. Sem assinatura válida, 400 e nada acontece.
 *
 * Eventos (configurar no painel do Stripe ou no `stripe listen`):
 *   - checkout.session.completed           → cartão já vem `paid`
 *   - checkout.session.async_payment_succeeded → Pix compensado
 *   - checkout.session.async_payment_failed    → Pix expirou / falhou (só log)
 *
 * Duas origens de sessão, separadas pelo `metadata`:
 *   - `pedido_id` → pedido (orders) pago, entra na fila de design;
 *   - `fatura_id` → fatura de fechamento (lâminas extras/adicionais) paga pelo
 *     estúdio: `confirmar_pagamento_fatura` (service role, idempotente) libera
 *     o projeto para impressão. Ver `iniciarPagamentoFaturaAction`.
 *
 * Responde 2xx para qualquer evento verificado, mesmo os que ignoramos — do
 * contrário o Stripe reenvia. Só devolve 500 quando vale a pena ele tentar de
 * novo (erro nosso ao gravar).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeConfigurado() || !secret) {
    console.error('[webhook:pagamento] STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET ausentes')
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const assinatura = request.headers.get('stripe-signature')
  if (!assinatura) return NextResponse.json({ error: 'missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), assinatura, secret)
  } catch (e) {
    console.warn('[webhook:pagamento] assinatura inválida', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object
      if (ehSessaoDeFatura(session)) {
        const resultado = await confirmarFaturaPorSessao(session, event.type)
        console.log('[webhook:pagamento]', event.type, session.id, 'fatura', session.metadata?.fatura_id, '→', resultado)
        if (resultado === 'erro' || resultado === 'sem_service_role') {
          return NextResponse.json({ error: resultado }, { status: 500 })
        }
        return NextResponse.json({ ok: true, resultado })
      }
      const resultado = await confirmarPagamentoPorSessao(session)
      console.log('[webhook:pagamento]', event.type, session.id, 'pedido', session.metadata?.pedido_id, '→', resultado)
      if (resultado === 'erro' || resultado === 'sem_service_role') {
        return NextResponse.json({ error: resultado }, { status: 500 })
      }
      return NextResponse.json({ ok: true, resultado })
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object
      console.warn(
        '[webhook:pagamento] pagamento falhou',
        session.id,
        ehSessaoDeFatura(session) ? `fatura ${session.metadata?.fatura_id}` : `pedido ${session.metadata?.pedido_id}`,
      )
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ ok: true, ignorado: event.type })
  }
}
