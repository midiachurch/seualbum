import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), sessao: vi.fn(), r2: vi.fn(), url: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/portal/servidor', () => ({ sessaoPortal: mocks.sessao }))
vi.mock('@/lib/r2/cliente', () => ({ r2Configurado: mocks.r2, urlDeLeitura: mocks.url }))
import { GET } from '@/app/portal/[link]/lamina/[lamina]/route'
const id = '11111111-1111-4111-8111-111111111111'
const request = () => GET(new Request('http://localhost/portal/link/lamina/'+id), { params: Promise.resolve({ link: 'link', lamina: id }) })
beforeEach(() => { vi.clearAllMocks(); mocks.sessao.mockResolvedValue('verified-hash'); mocks.r2.mockReturnValue(true); mocks.rpc.mockResolvedValue({ data: { bucket: 'r2', path: 'projetos/synthetic/prova.jpg' }, error: null }); mocks.url.mockResolvedValue('https://objects.example.invalid/private?signature=synthetic') })
describe('mídia da prova por capacidade', () => {
  it('não consulta nem assina sem sessão', async () => {
    mocks.sessao.mockResolvedValue(null)
    expect((await request()).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.url).not.toHaveBeenCalled()
  })
  it('não assina mídia se banco negar a capacidade', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
    expect((await request()).status).toBe(403); expect(mocks.url).not.toHaveBeenCalled()
  })
  it('Storage legado não recebe bypass', async () => {
    mocks.rpc.mockResolvedValue({ data: { bucket: 'projetos_fotos', path: 'legacy.jpg' }, error: null })
    expect((await request()).status).toBe(503); expect(mocks.url).not.toHaveBeenCalled()
  })
  it('somente assina o path autorizado por 60 segundos sem cache', async () => {
    const resposta = await request()
    expect(resposta.status).toBe(307)
    expect(resposta.headers.get('cache-control')).toBe('private, no-store')
    expect(resposta.headers.get('referrer-policy')).toBe('no-referrer')
    expect(mocks.rpc).toHaveBeenCalledWith('portal_lamina', { p_sessao_hash: 'verified-hash', p_lamina_id: id })
    expect(mocks.url).toHaveBeenCalledWith('projetos/synthetic/prova.jpg', { expiraEmS: 60 })
  })
})
