import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), sessao: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/portal/servidor', () => ({ sessaoPortal: mocks.sessao, portalConfigurado: () => true }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
import { aprovarProvaPortal } from '@/lib/actions/portal'
import { lerContratoProva } from './prova'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { vi.clearAllMocks(); mocks.sessao.mockResolvedValue('capacidade-verificada'); mocks.rpc.mockResolvedValue({ data: { id, status: 'aprovado' }, error: null }) })

describe('aprovação final por capacidade', () => {
  it('nega IDs inválidos antes da sessão e não aceita preço ou projeto do navegador', async () => {
    expect((await aprovarProvaPortal('link','outra',id)).ok).toBe(false)
    expect(mocks.sessao).not.toHaveBeenCalled()
    expect(await aprovarProvaPortal('link',id,id)).toEqual({ ok: true, aguardaFechamento: false })
    expect(mocks.rpc).toHaveBeenCalledWith('portal_aprovar_prova', { p_sessao_hash: 'capacidade-verificada', p_versao_id: id, p_chave: id })
  })
  it('mantém a informação de fechamento pendente vinda do banco', async () => {
    mocks.rpc.mockResolvedValue({ data: { id, status: 'aprovado_aguardando_pagamento' }, error: null })
    expect(await aprovarProvaPortal('link',id,id)).toEqual({ ok: true, aguardaFechamento: true })
  })
  it('sem capacidade não consulta a RPC', async () => {
    mocks.sessao.mockResolvedValue(null)
    expect((await aprovarProvaPortal('link',id,id)).ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([null, { id, status: 'pago' }, { id: 'outro', status: 'aprovado' }])('não confirma resposta inválida: %j', async data => {
    mocks.rpc.mockResolvedValue({ data, error: null })
    expect((await aprovarProvaPortal('link',id,id)).ok).toBe(false)
  })
  it('erro de rede permite retry com a mesma chave sem expor detalhes internos', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('detalhe interno'))
    const resultado = await aprovarProvaPortal('link',id,id)
    expect(resultado.ok).toBe(false)
    expect(JSON.stringify(resultado)).not.toContain('detalhe interno')
    expect((await aprovarProvaPortal('link',id,id)).ok).toBe(true)
    expect(mocks.rpc.mock.calls[0][1]).toEqual(mocks.rpc.mock.calls[1][1])
  })
  it('valida o registro de aprovação no resumo sem aceitar fechamento adulterado', () => {
    const prova = { id, numero: 1, aberta: false, laminas: [], comentarios: [] }
    expect(lerContratoProva({ ...prova, aprovacao: { data: '2026-11-21T18:00:00Z', aguardaFechamento: true } })?.aprovacao?.aguardaFechamento).toBe(true)
    expect(lerContratoProva({ ...prova, aprovacao: { data: 'inválida', aguardaFechamento: true } })).toBeNull()
    expect(lerContratoProva({ ...prova, aprovacao: { data: '2026-11-21T18:00:00Z', aguardaFechamento: 'pago' } })).toBeNull()
  })
})
