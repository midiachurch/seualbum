import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Fechamento do estúdio (lâminas extras e/ou adicionais): pagar (simulado),
 * cortesia da gestão e decisão do adicional pedido pelo casal, com o Supabase
 * simulado. O fluxo inteiro contra o banco local está em
 * `adicionais.e2e.test.ts` e em `supabase/tests/fluxo_adicionais.test.sql`.
 */

vi.mock('server-only', () => ({}))
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }))
vi.mock('next/cache', () => cache)

const banco = vi.hoisted(() => ({
  rpcs: [] as { nome: string; args: unknown }[],
  resposta: { data: null as unknown, error: null as { message: string; code?: string } | null },
  papel: 'fotografo' as string,
}))

const supabase = {
  rpc: async (nome: string, args: unknown) => (banco.rpcs.push({ nome, args }), banco.resposta),
}

vi.mock('@/lib/supabase/queries', () => ({
  requireUser: async () => ({ supabase, user: { id: 'u-fotografo' }, profile: { role: banco.papel } }),
  requireModuleAction: async () => ({ supabase, role: 'admin' }),
  getPlatformRole: async () => banco.papel,
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://teste.supabase.co'

const { pagarLaminasExtras, dispensarCobranca } = await import('./faturamento')
const { decidirAdicional } = await import('./prova-fotografo')

const FATURA = '11111111-1111-4111-8111-111111111111'
const PROJETO = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  banco.rpcs = []
  banco.resposta = { data: null, error: null }
  banco.papel = 'fotografo'
  cache.revalidatePath.mockClear()
})

describe('pagarLaminasExtras', () => {
  it('paga pela RPC simulada e revalida o painel', async () => {
    expect(await pagarLaminasExtras(FATURA, 'pix')).toEqual({ ok: true })
    expect(banco.rpcs).toEqual([{ nome: 'pagar_fatura_simulada', args: { p_fatura_id: FATURA, p_forma: 'pix' } }])
    expect(cache.revalidatePath).toHaveBeenCalledWith('/dashboard/meus-albuns')
  })

  it('recusa forma de pagamento inventada sem tocar no banco', async () => {
    expect(await pagarLaminasExtras(FATURA, 'boleto' as never)).toMatchObject({ ok: false })
    expect(banco.rpcs).toEqual([])
  })

  it('só o fotógrafo paga', async () => {
    banco.papel = 'cliente'
    expect(await pagarLaminasExtras(FATURA, 'pix')).toEqual({ ok: false, erro: 'Só o estúdio dono do projeto paga esta fatura.' })
    expect(banco.rpcs).toEqual([])
  })

  it('repassa a mensagem do banco quando é regra de negócio (adicional aguardando)', async () => {
    banco.resposta = {
      data: null,
      error: { code: 'P0001', message: 'Confirme ou recuse os adicionais pedidos pelo cliente antes de pagar.' },
    }
    expect(await pagarLaminasExtras(FATURA, 'cartao')).toEqual({
      ok: false,
      erro: 'Confirme ou recuse os adicionais pedidos pelo cliente antes de pagar.',
    })
    expect(cache.revalidatePath).not.toHaveBeenCalled()
  })

  it('esconde erro interno do banco atrás de mensagem genérica', async () => {
    banco.resposta = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
    expect(await pagarLaminasExtras(FATURA, 'pix')).toEqual({
      ok: false,
      erro: 'Não foi possível confirmar o pagamento. Tente de novo.',
    })
  })
})

describe('dispensarCobranca', () => {
  it('dispensa pela RPC com o motivo limitado a 500 caracteres', async () => {
    expect(await dispensarCobranca(FATURA, PROJETO, 'x'.repeat(600))).toEqual({ ok: true })
    expect(banco.rpcs).toEqual([{ nome: 'dispensar_fatura', args: { p_fatura_id: FATURA, p_motivo: 'x'.repeat(500) } }])
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/admin/projetos/${PROJETO}`)
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/producao/grafica')
  })

  it('repassa a recusa do banco com adicional aguardando o estúdio', async () => {
    banco.resposta = {
      data: null,
      error: { code: 'P0001', message: 'O estúdio ainda precisa aceitar ou recusar os adicionais pedidos pelo cliente.' },
    }
    expect(await dispensarCobranca(FATURA, PROJETO, 'cortesia')).toEqual({
      ok: false,
      erro: 'O estúdio ainda precisa aceitar ou recusar os adicionais pedidos pelo cliente.',
    })
  })
})

describe('decidirAdicional', () => {
  it('aceitar mantém a fatura pendente', async () => {
    banco.resposta = { data: 'pendente', error: null }
    expect(await decidirAdicional(FATURA, true)).toEqual({ ok: true, liberado: false })
    expect(banco.rpcs).toEqual([{ nome: 'decidir_adicional', args: { p_item_id: FATURA, p_aceitar: true } }])
  })

  it('recusar o último item libera para impressão', async () => {
    banco.resposta = { data: 'liberado', error: null }
    expect(await decidirAdicional(FATURA, false)).toEqual({ ok: true, liberado: true })
  })

  it('só o fotógrafo decide', async () => {
    banco.papel = 'cliente'
    expect(await decidirAdicional(FATURA, true)).toEqual({ ok: false, erro: 'Só o estúdio decide os adicionais.' })
    expect(banco.rpcs).toEqual([])
  })

  it('decidir de novo traz a mensagem do banco', async () => {
    banco.resposta = { data: null, error: { code: 'P0001', message: 'Este adicional já foi decidido.' } }
    expect(await decidirAdicional(FATURA, true)).toEqual({ ok: false, erro: 'Este adicional já foi decidido.' })
  })
})
