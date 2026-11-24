import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), url: vi.fn(), sessao: 'a'.repeat(64) as string | null, configurado: true }))
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/portal/servidor', () => ({ sessaoPortal: async () => mocks.sessao }))
vi.mock('@/lib/r2/cliente', () => ({ r2Configurado: () => mocks.configurado, urlDeLeitura: mocks.url }))
const { GET } = await import('./route')
const link = 'c'.repeat(64)
const foto = 'b1000000-0000-4000-8000-000000000001'
const chamar = (f = foto) => GET(new Request('http://x'), { params: Promise.resolve({ link, foto: f }) })

beforeEach(() => {
  vi.clearAllMocks(); mocks.sessao = 'a'.repeat(64); mocks.configurado = true
  mocks.rpc.mockResolvedValue({ data: { bucket: 'r2', path: 'projetos/p/fotos/1.jpg', nome: 'um.jpg' }, error: null })
  mocks.url.mockResolvedValue('https://r2.exemplo/assinada')
})

describe('GET /portal/[link]/download/[foto]', () => {
  it('sem sessão do portal ou com foto malformada: 403 sem consultar o banco', async () => {
    mocks.sessao = null
    expect((await chamar()).status).toBe(403)
    mocks.sessao = 'a'.repeat(64)
    expect((await chamar('x')).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('download liberado: URL curta (5 min) que força o download, sem cache', async () => {
    const r = await chamar()
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).toBe('https://r2.exemplo/assinada')
    expect(r.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.url).toHaveBeenCalledWith('projetos/p/fotos/1.jpg', { nomeDownload: 'um.jpg', expiraEmS: 300 })
  })
  it('download não liberado ou expirado: 403 sem assinar nada', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Download não liberado.' } })
    expect((await chamar()).status).toBe(403)
    expect(mocks.url).not.toHaveBeenCalled()
  })
  it('limite por acesso atingido: 429 com mensagem clara', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Limite de downloads atingido.' } })
    const r = await chamar()
    expect(r.status).toBe(429)
    expect(await r.text()).toMatch(/limite/i)
  })
  it('arquivo legado fora do R2 nunca é servido por bypass', async () => {
    mocks.rpc.mockResolvedValue({ data: { bucket: 'projetos_fotos', path: 'x/y.jpg', nome: 'y.jpg' }, error: null })
    expect((await chamar()).status).toBe(503)
    expect(mocks.url).not.toHaveBeenCalled()
  })
  it('falha ao assinar vira 503 sem vazar detalhe', async () => {
    mocks.url.mockRejectedValue(new Error('segredo interno do R2'))
    const r = await chamar()
    expect(r.status).toBe(503)
    expect(await r.text()).not.toContain('segredo interno')
  })
})
