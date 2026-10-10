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

describe('bucket público (vitrine e logos)', () => {
  beforeAll(() => {
    process.env.R2_PUBLIC_BUCKET = 'seualbum-publico'
    process.env.R2_PUBLIC_URL = 'https://midia.exemplo.com.br/'
  })

  it('PUT público vai para o outro bucket, com as mesmas travas', async () => {
    const { urlDeEnvio } = await import('./cliente')
    const u = new URL((await urlDeEnvio('vitrine/a.webp', 'image/webp', 10, 'publico')).url)
    expect(u.pathname).toBe('/seualbum-publico/vitrine/a.webp')
    expect(u.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
  })

  it('endereço público pela chave, sem assinatura e sem barra dobrada', async () => {
    const { urlPublica } = await import('./cliente')
    expect(urlPublica('logos/u/a b.png')).toBe('https://midia.exemplo.com.br/logos/u/a%20b.png')
  })

  it('sem R2_PUBLIC_URL o bucket público não conta como configurado', async () => {
    const guardada = process.env.R2_PUBLIC_URL
    delete process.env.R2_PUBLIC_URL
    try {
      const { r2PublicoConfigurado, urlPublica } = await import('./cliente')
      expect(r2PublicoConfigurado()).toBe(false)
      expect(urlPublica('vitrine/a.webp')).toBeNull()
    } finally {
      process.env.R2_PUBLIC_URL = guardada
    }
  })
})

describe('assinarLeituras', () => {
  it('assina várias chaves de uma vez, sem repetir', async () => {
    const { assinarLeituras } = await import('./cliente')
    const urls = await assinarLeituras(['a.jpg', 'b.jpg', 'a.jpg'], 600)
    expect([...urls.keys()]).toEqual(['a.jpg', 'b.jpg'])
    expect(new URL(urls.get('b.jpg')!).searchParams.get('X-Amz-Expires')).toBe('600')
  })

  it('sem R2 configurado devolve vazio em vez de lançar', async () => {
    const guardado = process.env.R2_BUCKET
    delete process.env.R2_BUCKET
    try {
      const { assinarLeituras } = await import('./cliente')
      const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect((await assinarLeituras(['a.jpg'])).size).toBe(0)
      silencio.mockRestore()
    } finally {
      process.env.R2_BUCKET = guardado
    }
  })
})
