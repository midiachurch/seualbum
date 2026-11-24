import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
const { caminhoDoSite, ehRotaInternaDoNext, hostEhDoApp, hostRoutingAtivo, hostSemPorta } = await import('./host')
const { limparCacheDeHosts, resolverSlugPorHost } = await import('./proxy-host')

describe('roteamento por host', () => {
  it('vem desligado por padrão', () => {
    expect(hostRoutingAtivo({})).toBe(false)
    expect(hostRoutingAtivo({ SITES_HOST_ROUTING: '0' })).toBe(false)
    expect(hostRoutingAtivo({ SITES_HOST_ROUTING: '1' })).toBe(true)
  })
  it('tira porta, caixa e ponto final do host', () => {
    expect(hostSemPorta('Fotos.Exemplo.com.br:443')).toBe('fotos.exemplo.com.br')
    expect(hostSemPorta('exemplo.com.')).toBe('exemplo.com')
  })
  it('hosts do próprio app e previews não são tratados como site de estúdio', () => {
    const env = { SITES_APP_HOSTS: 'seualbum.com.br, www.seualbum.com.br', NEXT_PUBLIC_SITE_URL: 'https://app.seualbum.com.br' }
    for (const h of ['localhost:3000', 'seualbum.com.br', 'WWW.seualbum.com.br', 'app.seualbum.com.br', 'projeto-git-x.vercel.app']) expect(hostEhDoApp(h, env)).toBe(true)
    for (const h of ['fotos.exemplo.com.br', 'seualbum.com.br.atacante.com', 'meuseualbum.com.br']) expect(hostEhDoApp(h, env)).toBe(false)
  })
  it('reescreve sempre para /site-host/{slug}, nunca para outra rota do app', () => {
    expect(caminhoDoSite('estudio-a', '/')).toBe('/site-host/estudio-a')
    expect(caminhoDoSite('estudio-a', '/portfolio')).toBe('/site-host/estudio-a/portfolio')
    expect(caminhoDoSite('estudio-a', '/sitemap.xml')).toBe('/site-host/estudio-a/sitemap.xml')
    // tentativa de alcançar rotas do app ou de outro site pelo domínio do estúdio:
    expect(caminhoDoSite('estudio-a', '/dashboard')).toBe('/site-host/estudio-a/dashboard')
    expect(caminhoDoSite('estudio-a', '/s/estudio-b')).toBe('/site-host/estudio-a/s/estudio-b')
  })
  it('não reescreve recursos internos do Next', () => {
    expect(ehRotaInternaDoNext('/_next/static/x.js')).toBe(true)
    expect(ehRotaInternaDoNext('/portfolio')).toBe(false)
  })
})

describe('host → slug (cache por host)', () => {
  beforeEach(() => {
    vi.clearAllMocks(); limparCacheDeHosts()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.invalid'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-sintetica'
    mocks.createClient.mockReturnValue({ rpc: mocks.rpc })
    mocks.rpc.mockImplementation(async (_n: string, a: { p_host: string }) => ({ data: ({ 'a.com.br': 'site-a', 'b.com.br': 'site-b' } as Record<string, string>)[a.p_host] ?? null, error: null }))
  })
  it('cada host resolve para o próprio site e o cache nunca mistura hosts', async () => {
    expect(await resolverSlugPorHost('A.com.br:443')).toBe('site-a')
    expect(await resolverSlugPorHost('b.com.br')).toBe('site-b')
    expect(await resolverSlugPorHost('a.com.br')).toBe('site-a')
    expect(await resolverSlugPorHost('c.com.br')).toBeNull()
    expect(mocks.rpc).toHaveBeenCalledTimes(3) // a.com.br repetido veio do cache
    expect(mocks.rpc).toHaveBeenCalledWith('resolver_site_por_host', { p_host: 'a.com.br' })
  })
  it('o cache expira (retirada de publicação/domínio vale em segundos)', async () => {
    const t0 = 1_000_000
    await resolverSlugPorHost('a.com.br', t0)
    await resolverSlugPorHost('a.com.br', t0 + 5_000)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await resolverSlugPorHost('a.com.br', t0 + 20_000)).toBeNull()
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })
  it('falha do banco não é cacheada e não derruba o pedido', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000' } })
    expect(await resolverSlugPorHost('a.com.br')).toBeNull()
    expect(await resolverSlugPorHost('a.com.br')).toBe('site-a')
    mocks.rpc.mockRejectedValueOnce(new Error('rede'))
    limparCacheDeHosts()
    expect(await resolverSlugPorHost('a.com.br')).toBeNull()
  })
})
