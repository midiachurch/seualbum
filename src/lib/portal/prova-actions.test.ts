import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), sessao: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/portal/servidor', () => ({ sessaoPortal: mocks.sessao, portalConfigurado: () => true }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
import { comentarProvaPortal } from '@/lib/actions/portal'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { vi.clearAllMocks(); mocks.sessao.mockResolvedValue('verified-session-hash'); mocks.rpc.mockResolvedValue({ data: id, error: null }) })
describe('server action prova guest', () => {
  it('nega payload inválido antes de consultar sessão ou RPC', async () => {
    expect((await comentarProvaPortal('link',id,null,'comentario','texto',id)).ok).toBe(false)
    expect(mocks.sessao).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('nega sessão ausente sem consultar RPC', async () => {
    mocks.sessao.mockResolvedValue(null)
    expect((await comentarProvaPortal('link',id,id,'comentario','texto',id)).ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('leva hash verificado ao banco, sem aceitar projeto vindo do navegador', async () => {
    expect(await comentarProvaPortal('link',id,id,'comentario','  Rever foto  ',id)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('portal_comentar_prova', { p_sessao_hash: 'verified-session-hash', p_versao_id: id, p_lamina_id: id, p_tipo: 'comentario', p_texto: 'Rever foto', p_chave: id })
  })
  it('erro de autorização do banco não é convertido em sucesso', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: '42501', message: 'sensitive details' } })
    const resultado = await comentarProvaPortal('link',id,null,'ajustes','Rever capa',id)
    expect(resultado.ok).toBe(false); expect(JSON.stringify(resultado)).not.toContain('sensitive details')
  })
  it('não confirma resposta vazia como comentário gravado', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect((await comentarProvaPortal('link',id,id,'comentario','Rever foto',id)).ok).toBe(false)
  })
  it('falha de rede conserva a chave e permite retry explícito', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('detalhe interno'))
    expect((await comentarProvaPortal('link',id,id,'comentario','Rever foto',id)).ok).toBe(false)
    expect((await comentarProvaPortal('link',id,id,'comentario','Rever foto',id)).ok).toBe(true)
    expect(mocks.rpc.mock.calls[0][1]).toEqual(mocks.rpc.mock.calls[1][1])
  })
})
