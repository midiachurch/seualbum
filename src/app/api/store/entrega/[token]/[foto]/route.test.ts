import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ rpcPublico: vi.fn(), rpcAdmin: vi.fn(), url: vi.fn(), configurado: true }))
vi.mock('@/lib/supabase/server', () => ({
  createPublicClient: () => ({ rpc: mocks.rpcPublico }),
  createAdminClient: () => ({ rpc: mocks.rpcAdmin }),
}))
vi.mock('@/lib/r2/cliente', () => ({ r2Configurado: () => mocks.configurado, urlDeLeitura: mocks.url }))
const { GET } = await import('./route')
const token = 'a'.repeat(64)
const foto = 'b1000000-0000-4000-8000-000000000001'
const pedido = 'c1000000-0000-4000-8000-000000000001'
const chamar = (t = token, f = foto) => GET(new Request('http://x'), { params: Promise.resolve({ token: t, foto: f }) })

beforeEach(() => {
  vi.clearAllMocks(); mocks.configurado = true
  mocks.rpcPublico.mockResolvedValue({ data: { pedido_id: pedido, bucket: 'r2', path: 'projetos/p/fotos/1.jpg', nome: 'um.jpg' }, error: null })
  mocks.rpcAdmin.mockResolvedValue({ data: true, error: null })
  mocks.url.mockResolvedValue('https://r2.exemplo/assinada')
})

describe('GET /api/store/entrega/[token]/[foto]', () => {
  it('rejeita token ou foto malformados sem consultar o banco', async () => {
    expect((await chamar('curto')).status).toBe(404)
    expect((await chamar(token, 'x')).status).toBe(404)
    expect(mocks.rpcPublico).not.toHaveBeenCalled()
  })
  it('foto comprada: redireciona para URL curta (5 min) com download, sem cache', async () => {
    const r = await chamar()
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).toBe('https://r2.exemplo/assinada')
    expect(r.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.url).toHaveBeenCalledWith('projetos/p/fotos/1.jpg', { nomeDownload: 'um.jpg', expiraEmS: 300 })
  })
  it('envia ao banco o HASH do token, nunca o token', async () => {
    await chamar()
    const args = mocks.rpcPublico.mock.calls[0][1]
    expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/); expect(args.p_token_hash).not.toBe(token)
  })
  it('pedido não pago, estornado ou foto não comprada: 404 sem assinar nada', async () => {
    mocks.rpcPublico.mockResolvedValue({ data: null, error: { message: 'Entrega indisponível.' } })
    expect((await chamar()).status).toBe(404)
    expect(mocks.url).not.toHaveBeenCalled(); expect(mocks.rpcAdmin).not.toHaveBeenCalled()
  })
  it('arquivo legado (fora do R2) nunca é servido por bypass: 503 e falha registrada', async () => {
    mocks.rpcPublico.mockResolvedValue({ data: { pedido_id: pedido, bucket: 'projetos_fotos', path: 'x/y.jpg', nome: 'y.jpg' }, error: null })
    expect((await chamar()).status).toBe(503)
    expect(mocks.url).not.toHaveBeenCalled()
    expect(mocks.rpcAdmin).toHaveBeenCalledWith('store_registrar_falha_entrega', expect.objectContaining({ p_pedido: pedido, p_foto: foto }))
  })
  it('falha ao assinar vira 503, registra a falha e não vaza detalhe', async () => {
    mocks.url.mockRejectedValue(new Error('segredo interno do R2'))
    const r = await chamar()
    expect(r.status).toBe(503)
    expect(await r.text()).not.toContain('segredo interno')
    expect(mocks.rpcAdmin).toHaveBeenCalled()
  })
  it('se até o registro da falha quebrar, a resposta continua sendo 503 limpo', async () => {
    mocks.url.mockRejectedValue(new Error('x')); mocks.rpcAdmin.mockRejectedValue(new Error('sem admin'))
    expect((await chamar()).status).toBe(503)
  })
})
