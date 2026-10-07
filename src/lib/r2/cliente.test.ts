import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

beforeAll(() => {
  process.env.R2_ACCOUNT_ID = 'conta123'
  process.env.R2_ACCESS_KEY_ID = 'chave'
  process.env.R2_SECRET_ACCESS_KEY = 'segredo'
  process.env.R2_BUCKET = 'seualbum-teste'
})

// Assinar é só criptografia local: nenhum teste aqui fala com a Cloudflare.
describe('URLs assinadas do R2', () => {
  it('PUT aponta para o endpoint da conta, expira em 15 min e trava tipo e tamanho', async () => {
    const { urlDeEnvio } = await import('./cliente')
    const { url } = await urlDeEnvio('pedidos/u/c/a.jpg', 'image/jpeg', 1234)
    const u = new URL(url)
    expect(u.host).toBe('conta123.r2.cloudflarestorage.com')
    expect(u.pathname).toBe('/seualbum-teste/pedidos/u/c/a.jpg')
    expect(u.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(u.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect(u.searchParams.has('x-amz-checksum-crc32')).toBe(false)
  })

  it('GET de download pede attachment com o nome sem aspas', async () => {
    const { urlDeLeitura } = await import('./cliente')
    const u = new URL(await urlDeLeitura('pedidos/u/c/a.jpg', { nomeDownload: 'Foto "1".jpg' }))
    expect(u.searchParams.get('response-content-disposition')).toBe('attachment; filename="Foto _1_.jpg"')
    expect(u.searchParams.get('X-Amz-Expires')).toBe('3600')
  })
})
