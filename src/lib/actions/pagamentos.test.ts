import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Checkout real da fatura de fechamento (migration 0035): o banco diz se pode
 * pagar e quanto; a action abre a Checkout Session com `metadata.fatura_id`.
 * Supabase e Stripe simulados — nada sai da máquina.
 */

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'app.seualbum.test', 'x-forwarded-proto': 'https' }),
}))

const banco = vi.hoisted(() => ({
  rpcs: [] as { nome: string; args: unknown }[],
  respostas: {} as Record<string, { data: unknown; error: { message: string; code?: string } | null }>,
  papel: 'fotografo' as string,
}))

const stripe = vi.hoisted(() => ({
  configurado: true,
  criadas: [] as Record<string, unknown>[],
  recuperadas: [] as string[],
  anterior: null as Record<string, unknown> | null,
  falhaAoCriar: false,
}))

vi.mock('@/lib/stripe', () => ({
  stripeConfigurado: () => stripe.configurado,
  getStripe: () => ({
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          if (stripe.falhaAoCriar) throw new Error('stripe fora do ar')
          stripe.criadas.push(params)
          return { id: 'cs_test_novo', url: 'https://checkout.stripe.com/c/pay/cs_test_novo' }
        },
        retrieve: async (id: string) => {
          stripe.recuperadas.push(id)
          if (!stripe.anterior) throw new Error('No such checkout.session')
          return stripe.anterior
        },
      },
    },
  }),
}))

const supabase = {
  rpc: async (nome: string, args: unknown) => (
    banco.rpcs.push({ nome, args }), banco.respostas[nome] ?? { data: null, error: null }
  ),
}

vi.mock('@/lib/supabase/queries', () => ({
  requireUser: async () => ({
    supabase,
    user: { id: 'u-fotografo', email: 'estudio@teste.local' },
    profile: { role: banco.papel, email: 'estudio@teste.local' },
  }),
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://teste.supabase.co'

const { iniciarPagamentoFaturaAction } = await import('./pagamentos')

const FATURA = '11111111-1111-4111-8111-111111111111'
const PROJETO = '22222222-2222-4222-8222-222222222222'

function faturaDoBanco(extra: Record<string, unknown> = {}) {
  return {
    data: [
      {
        fatura_id: FATURA,
        projeto_id: PROJETO,
        projeto_nome: 'Ana & Bruno',
        projeto_numero: 7,
        valor_total: 123.45,
        stripe_checkout_session_id: null,
        ...extra,
      },
    ],
    error: null,
  }
}

beforeEach(() => {
  banco.rpcs = []
  banco.respostas = { preparar_checkout_fatura: faturaDoBanco() }
  banco.papel = 'fotografo'
  stripe.configurado = true
  stripe.criadas = []
  stripe.recuperadas = []
  stripe.anterior = null
  stripe.falhaAoCriar = false
})

describe('iniciarPagamentoFaturaAction', () => {
  it('abre a Checkout Session com o valor do banco e guarda a sessão na fatura', async () => {
    expect(await iniciarPagamentoFaturaAction(FATURA)).toEqual({
      ok: true,
      url: 'https://checkout.stripe.com/c/pay/cs_test_novo',
    })
    expect(stripe.criadas).toHaveLength(1)
    expect(stripe.criadas[0]).toMatchObject({
      mode: 'payment',
      locale: 'pt-BR',
      line_items: [{ quantity: 1, price_data: { currency: 'brl', unit_amount: 12345 } }],
      metadata: { fatura_id: FATURA, projeto_id: PROJETO },
      payment_intent_data: { metadata: { fatura_id: FATURA } },
      client_reference_id: FATURA,
      customer_email: 'estudio@teste.local',
      success_url: 'https://app.seualbum.test/dashboard/meus-albuns?fechamento=sucesso&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://app.seualbum.test/dashboard/meus-albuns?fechamento=cancelado',
    })
    // Sem payment_method_types: o Checkout mostra o que estiver ativo (Pix/cartão), como nos pedidos.
    expect(stripe.criadas[0]).not.toHaveProperty('payment_method_types')
    // Nada de pedido_id: o webhook não pode confundir a fatura com um pedido.
    expect(stripe.criadas[0].metadata).not.toHaveProperty('pedido_id')
    expect(banco.rpcs).toEqual([
      { nome: 'preparar_checkout_fatura', args: { p_fatura_id: FATURA } },
      { nome: 'registrar_checkout_fatura', args: { p_fatura_id: FATURA, p_session_id: 'cs_test_novo' } },
    ])
  })

  it('repassa as travas do banco (adicional aguardando o estúdio) sem abrir checkout', async () => {
    banco.respostas.preparar_checkout_fatura = {
      data: null,
      error: { code: 'P0001', message: 'Confirme ou recuse os adicionais pedidos pelo cliente antes de pagar.' },
    }
    expect(await iniciarPagamentoFaturaAction(FATURA)).toEqual({
      ok: false,
      erro: 'Confirme ou recuse os adicionais pedidos pelo cliente antes de pagar.',
    })
    expect(stripe.criadas).toEqual([])
  })

  it('fatura de outro estúdio ou já paga: mensagem do banco, sem checkout', async () => {
    banco.respostas.preparar_checkout_fatura = {
      data: null,
      error: { code: '42704', message: 'Fatura não encontrada ou já processada.' },
    }
    expect(await iniciarPagamentoFaturaAction(FATURA)).toEqual({ ok: false, erro: 'Fatura não encontrada ou já processada.' })
    expect(stripe.criadas).toEqual([])
  })

  it('esconde erro interno do banco atrás de mensagem genérica', async () => {
    banco.respostas.preparar_checkout_fatura = { data: null, error: { code: '08006', message: 'connection failure' } }
    expect(await iniciarPagamentoFaturaAction(FATURA)).toEqual({
      ok: false,
      erro: 'Não foi possível carregar a fatura. Tente de novo.',
    })
  })

  it('só o fotógrafo paga; id inválido nem chega ao banco', async () => {
    banco.papel = 'cliente'
    expect(await iniciarPagamentoFaturaAction(FATURA)).toEqual({
      ok: false,
      erro: 'Só o estúdio dono do projeto paga esta fatura.',
    })
    banco.papel = 'fotografo'
    expect(await iniciarPagamentoFaturaAction('nao-e-uuid')).toEqual({ ok: false, erro: 'Fatura inválida.' })
    expect(banco.rpcs).toEqual([])
  })

  it('sem Stripe configurado não faz nada', async () => {
    stripe.configurado = false
    expect(await iniciarPagamentoFaturaAction(FATURA)).toMatchObject({ ok: false })
    expect(banco.rpcs).toEqual([])
  })

  it('valor zero nunca vira checkout', async () => {
    banco.respostas.preparar_checkout_fatura = faturaDoBanco({ valor_total: 0 })
    expect(await iniciarPagamentoFaturaAction(FATURA)).toEqual({ ok: false, erro: 'Fatura sem valor a cobrar.' })
    expect(stripe.criadas).toEqual([])
  })

  it('reaproveita a sessão aberta do mesmo valor (clique duplo)', async () => {
    banco.respostas.preparar_checkout_fatura = faturaDoBanco({ stripe_checkout_session_id: 'cs_test_antiga' })
    stripe.anterior = {
      id: 'cs_test_antiga',
      status: 'open',
      url: 'https://checkout.stripe.com/c/pay/cs_test_antiga',
      amount_total: 12345,
      metadata: { fatura_id: FATURA },
    }
    expect(await iniciarPagamentoFaturaAction(FATURA)).toEqual({
      ok: true,
      url: 'https://checkout.stripe.com/c/pay/cs_test_antiga',
    })
    expect(stripe.recuperadas).toEqual(['cs_test_antiga'])
    expect(stripe.criadas).toEqual([])
  })

  it('Pix gerado e não compensado: não abre um segundo checkout', async () => {
    banco.respostas.preparar_checkout_fatura = faturaDoBanco({ stripe_checkout_session_id: 'cs_test_antiga' })
    stripe.anterior = { id: 'cs_test_antiga', status: 'complete', url: null, amount_total: 12345, metadata: { fatura_id: FATURA } }
    expect(await iniciarPagamentoFaturaAction(FATURA)).toMatchObject({ ok: false, erro: expect.stringContaining('processamento') })
    expect(stripe.criadas).toEqual([])
  })

  it('sessão anterior de outro valor ou expirada: abre uma nova', async () => {
    banco.respostas.preparar_checkout_fatura = faturaDoBanco({ stripe_checkout_session_id: 'cs_test_antiga' })
    stripe.anterior = { id: 'cs_test_antiga', status: 'open', url: 'https://x', amount_total: 999, metadata: { fatura_id: FATURA } }
    expect(await iniciarPagamentoFaturaAction(FATURA)).toMatchObject({ ok: true, url: expect.stringContaining('cs_test_novo') })
    expect(stripe.criadas).toHaveLength(1)
  })

  it('falha no Stripe vira mensagem amigável e não grava sessão', async () => {
    stripe.falhaAoCriar = true
    expect(await iniciarPagamentoFaturaAction(FATURA)).toEqual({
      ok: false,
      erro: 'Não foi possível abrir o pagamento. Tente de novo em instantes.',
    })
    expect(banco.rpcs.map((r) => r.nome)).toEqual(['preparar_checkout_fatura'])
  })
})
