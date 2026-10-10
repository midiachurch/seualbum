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
  leituras: [] as { tabela: string; colunas: string; filtros: [string, unknown][] }[],
  faturas: {} as Record<string, { id: string; status_pagamento: string; valor_total: number; stripe_checkout_session_id?: string | null }>,
  rpcs: [] as { nome: string; args: unknown }[],
  respostaRpc: { data: null as unknown, error: null as { code?: string; message: string } | null },
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => {
      const registro = { tabela, dados: undefined as unknown, filtros: [] as [string, unknown][] }
      let colunas = ''
      const q = {
        update: (dados: unknown) => ((registro.dados = dados), q),
        eq: (col: string, v: unknown) => (registro.filtros.push([col, v]), q),
        // Depois de update(): fim da cadeia (UPDATE … RETURNING). Sem update: leitura.
        select: (cols: string) => {
          if (registro.dados === undefined) return (colunas = cols), q
          return Promise.resolve((banco.updates.push(registro), { data: banco.linhas, error: null }))
        },
        maybeSingle: async () => {
          banco.leituras.push({ tabela, colunas, filtros: registro.filtros })
          const id = registro.filtros.find(([c]) => c === 'id')?.[1] as string
          return { data: banco.faturas[id] ?? null, error: null }
        },
      }
      return q
    },
    rpc: async (nome: string, args: unknown) => (banco.rpcs.push({ nome, args }), banco.respostaRpc),
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

function sessao(tipo: string, metadata: Record<string, string>, pago = true, amountTotal = 49900, currency = 'brl') {
  return {
    id: 'evt_teste',
    object: 'event',
    type: tipo,
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        metadata,
        payment_status: pago ? 'paid' : 'unpaid',
        amount_total: amountTotal,
        currency,
        payment_intent: 'pi_test_1',
      },
    },
  }
}

const FATURA = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  banco.updates = []
  banco.linhas = [{ numero: 42 }]
  banco.leituras = []
  banco.faturas = { [FATURA]: { id: FATURA, status_pagamento: 'pendente', valor_total: 499 } }
  banco.rpcs = []
  banco.respostaRpc = { data: null, error: null }
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

  it('sessão sem pedido nem fatura é ignorada', async () => {
    const r = await POST(requisicao(sessao('checkout.session.completed', {})))
    expect(await r.json()).toEqual({ ok: true, resultado: 'sem_pedido' })
    expect(banco.updates).toEqual([])
    expect(banco.rpcs).toEqual([])
  })
})

/**
 * Faturas de fechamento (lâminas extras/adicionais, migration 0035): a sessão
 * traz `metadata.fatura_id` e o webhook chama `confirmar_pagamento_fatura`
 * com a service role — nunca mexe em `orders`.
 */
describe('POST /api/webhooks/pagamento — fatura de fechamento', () => {
  const confirmar = (forma: 'cartao' | 'pix') => [
    { nome: 'confirmar_pagamento_fatura', args: { p_fatura_id: FATURA, p_forma: forma } },
  ]

  it('recusa assinatura inválida sem tocar no banco', async () => {
    const r = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA }), 't=1,v1=forjada'))
    expect(r.status).toBe(400)
    expect(banco.leituras).toEqual([])
    expect(banco.rpcs).toEqual([])
  })

  it('cartão pago confirma a fatura pela RPC (service role) e não toca em pedidos', async () => {
    const r = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA })))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, resultado: 'confirmado' })
    expect(banco.leituras).toEqual([
      { tabela: 'faturas', colunas: 'id, status_pagamento, valor_total, stripe_checkout_session_id', filtros: [['id', FATURA]] },
    ])
    expect(banco.rpcs).toEqual(confirmar('cartao'))
    expect(banco.updates).toEqual([])
  })

  it('Pix: completed ainda não compensado espera; async_payment_succeeded confirma como Pix', async () => {
    const pendente = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA }, false)))
    expect(await pendente.json()).toEqual({ ok: true, resultado: 'aguardando_pagamento' })
    expect(banco.rpcs).toEqual([])

    const compensado = await POST(requisicao(sessao('checkout.session.async_payment_succeeded', { fatura_id: FATURA })))
    expect(await compensado.json()).toEqual({ ok: true, resultado: 'confirmado' })
    expect(banco.rpcs).toEqual(confirmar('pix'))
  })

  it('reentrega com a fatura já paga é idempotente (nem chama a RPC)', async () => {
    banco.faturas[FATURA].status_pagamento = 'pago'
    const r = await POST(requisicao(sessao('checkout.session.async_payment_succeeded', { fatura_id: FATURA })))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, resultado: 'ja_processado' })
    expect(banco.rpcs).toEqual([])
  })

  it('valor pago diferente do valor da fatura não libera (2xx, sem reenvio)', async () => {
    const r = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA }, true, 100)))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, resultado: 'valor_divergente' })
    expect(banco.rpcs).toEqual([])
  })

  it('mesmo valor em outra moeda não libera', async () => {
    const r = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA }, true, 49900, 'usd')))
    expect(await r.json()).toEqual({ ok: true, resultado: 'valor_divergente' })
    expect(banco.rpcs).toEqual([])
  })

  it('segunda sessão paga para a fatura já paga é sinalizada como duplicidade', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    banco.faturas[FATURA] = { ...banco.faturas[FATURA], status_pagamento: 'pago', stripe_checkout_session_id: 'cs_test_1' }
    await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA })))
    expect(erro).not.toHaveBeenCalled()

    banco.faturas[FATURA].stripe_checkout_session_id = 'cs_test_outra'
    const r = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA })))
    expect(await r.json()).toEqual({ ok: true, resultado: 'ja_processado' })
    expect(erro).toHaveBeenCalledWith(expect.anything(), FATURA, expect.anything(), 'cs_test_1', expect.anything(), 'cs_test_outra', expect.stringContaining('duplicidade'))
    expect(banco.rpcs).toEqual([])
    erro.mockRestore()
  })

  it('fatura já dispensada (cortesia) não é paga de novo', async () => {
    banco.faturas[FATURA].status_pagamento = 'dispensada'
    const r = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA })))
    expect(await r.json()).toEqual({ ok: true, resultado: 'recusado' })
    expect(banco.rpcs).toEqual([])
  })

  it('regra de negócio do banco (P0001) responde 2xx; erro interno pede reenvio (500)', async () => {
    banco.respostaRpc = { data: null, error: { code: 'P0001', message: 'Fatura com adicionais aguardando o estúdio.' } }
    const regra = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA })))
    expect(regra.status).toBe(200)
    expect(await regra.json()).toEqual({ ok: true, resultado: 'recusado' })

    banco.respostaRpc = { data: null, error: { code: '08006', message: 'connection failure' } }
    const falha = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: FATURA })))
    expect(falha.status).toBe(500)
    expect(await falha.json()).toEqual({ error: 'erro' })
  })

  it('fatura inexistente ou id malformado não chama a RPC', async () => {
    const outra = await POST(
      requisicao(sessao('checkout.session.completed', { fatura_id: '99999999-9999-4999-8999-999999999999' })),
    )
    expect(await outra.json()).toEqual({ ok: true, resultado: 'sem_fatura' })

    const malformada = await POST(requisicao(sessao('checkout.session.completed', { fatura_id: "1' or 1=1" })))
    expect(await malformada.json()).toEqual({ ok: true, resultado: 'sem_fatura' })
    expect(banco.rpcs).toEqual([])
  })

  it('Pix que falhou só é registrado', async () => {
    const r = await POST(requisicao(sessao('checkout.session.async_payment_failed', { fatura_id: FATURA }, false)))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(banco.rpcs).toEqual([])
  })
})
