import { beforeEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import type { NextRequest } from 'next/server'

/**
 * Webhook do Stripe com eventos assinados localmente
 * (`webhooks.generateTestHeaderString`) — nenhuma chamada sai para o Stripe.
 * O Supabase (service role) é simulado.
 */

vi.mock('server-only', () => ({}))

const banco = vi.hoisted(() => ({
  updates: [] as { tabela: string; dados: unknown; filtros: [string, unknown][] }[],
  linhas: [{ numero: 42 }] as unknown[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => {
      const registro = { tabela, dados: undefined as unknown, filtros: [] as [string, unknown][] }
      const q = {
        update: (dados: unknown) => ((registro.dados = dados), q),
        eq: (col: string, v: unknown) => (registro.filtros.push([col, v]), q),
        select: async () => (banco.updates.push(registro), { data: banco.linhas, error: null }),
      }
      return q
    },
  }),
}))

const SEGREDO = 'whsec_teste_local'
process.env.STRIPE_SECRET_KEY = 'sk_test_local'
process.env.STRIPE_WEBHOOK_SECRET = SEGREDO

const { POST } = await import('./route')
const stripe = new Stripe('sk_test_local')

function requisicao(evento: object, assinatura?: string) {
  const corpo = JSON.stringify(evento)
  const headers = new Headers({ 'content-type': 'application/json' })
  headers.set('stripe-signature', assinatura ?? stripe.webhooks.generateTestHeaderString({ payload: corpo, secret: SEGREDO }))
  return new Request('http://localhost/api/webhooks/pagamento', { method: 'POST', body: corpo, headers }) as unknown as NextRequest
}

function sessao(tipo: string, metadata: Record<string, string>, pago = true) {
  return {
    id: 'evt_teste',
    object: 'event',
    type: tipo,
    data: {
      object: { id: 'cs_test_1', object: 'checkout.session', metadata, payment_status: pago ? 'paid' : 'unpaid', amount_total: 49900 },
    },
  }
}

beforeEach(() => {
  banco.updates = []
  banco.linhas = [{ numero: 42 }]
})

describe('POST /api/webhooks/pagamento', () => {
  it('recusa assinatura inválida sem tocar no banco', async () => {
    const r = await POST(requisicao(sessao('checkout.session.completed', { pedido_id: 'p1' }), 't=1,v1=forjada'))
    expect(r.status).toBe(400)
    expect(banco.updates).toEqual([])
  })

  it('checkout pago confirma o pedido pendente', async () => {
    const r = await POST(requisicao(sessao('checkout.session.completed', { pedido_id: 'p1' })))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, resultado: 'confirmado' })
    expect(banco.updates).toEqual([
      {
        tabela: 'orders',
        dados: expect.objectContaining({ status: 'na_fila_design', valor_pago: 499, stripe_checkout_session_id: 'cs_test_1' }),
        filtros: [
          ['id', 'p1'],
          ['status', 'pendente'],
        ],
      },
    ])
  })

  it('reentrega do mesmo evento é idempotente', async () => {
    banco.linhas = []
    const r = await POST(requisicao(sessao('checkout.session.completed', { pedido_id: 'p1' })))
    expect(await r.json()).toEqual({ ok: true, resultado: 'ja_processado' })
  })

  it('Pix ainda não compensado não confirma', async () => {
    const r = await POST(requisicao(sessao('checkout.session.completed', { pedido_id: 'p1' }, false)))
    expect(await r.json()).toEqual({ ok: true, resultado: 'aguardando_pagamento' })
    expect(banco.updates).toEqual([])
  })

  // As faturas de fechamento (lâminas extras/adicionais) ainda não têm
  // checkout: são pagas por `pagar_fatura_simulada`. Uma sessão sem
  // pedido_id é reconhecida e ignorada — nunca marca pedido por engano.
  it('sessão sem pedido (ex.: fatura de fechamento) é ignorada', async () => {
    const r = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: 'f1' })))
    expect(await r.json()).toEqual({ ok: true, resultado: 'sem_pedido' })
    expect(banco.updates).toEqual([])
  })
})
