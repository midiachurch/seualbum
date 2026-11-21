/**
 * Roteamento por host (domínio próprio). Funções puras, usadas pelo proxy.
 * DESLIGADO por padrão: só liga com SITES_HOST_ROUTING=1. Mesmo ligado, o
 * app só trata como "site de estúdio" um host que NÃO esteja em
 * SITES_APP_HOSTS (domínios do próprio SeuAlbum, previews, localhost).
 * Sem DNS apontando o domínio do cliente para a hospedagem e sem o domínio
 * cadastrado no provedor (certificado), nada disto é alcançado — ver docs.
 */
type Env = Record<string, string | undefined>

export function hostRoutingAtivo(env: Env = process.env): boolean {
  return env.SITES_HOST_ROUTING === '1'
}

/** "Loja.Exemplo.com:443" → "loja.exemplo.com". */
export function hostSemPorta(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
}

export function hostsDoApp(env: Env = process.env): Set<string> {
  const lista = (env.SITES_APP_HOSTS ?? '').split(',').map(hostSemPorta).filter(Boolean)
  const site = env.NEXT_PUBLIC_SITE_URL
  if (site) {
    try { lista.push(new URL(site).hostname.toLowerCase()) } catch { /* URL inválida: ignora */ }
  }
  return new Set(['localhost', '127.0.0.1', '::1', ...lista])
}

/** O host é do próprio SeuAlbum (não é domínio de estúdio)? Previews *.vercel.app contam como do app. */
export function hostEhDoApp(host: string, env: Env = process.env): boolean {
  const h = hostSemPorta(host)
  return hostsDoApp(env).has(h) || h.endsWith('.vercel.app')
}

/** Caminho interno (/site-host/{slug}/…) de um site para o pedido recebido num domínio próprio. */
export function caminhoDoSite(slug: string, pathname: string): string {
  const base = `/site-host/${slug}`
  if (pathname === '/' || pathname === '') return base
  return `${base}${pathname.startsWith('/') ? '' : '/'}${pathname.replace(/\/+$/, '')}`
}

/** Não reescrever recursos internos do Next. */
export const ehRotaInternaDoNext = (pathname: string) => pathname.startsWith('/_next') || pathname === '/favicon.ico'
