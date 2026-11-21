import type { ConteudoSite, SitePublicado } from './tipos'

/** Modo de acesso: pelo caminho da plataforma (/s/{slug}) ou pelo domínio próprio (/site-host/{slug}, via proxy). */
export type ModoSite = 'plataforma' | 'host'

type Env = Record<string, string | undefined>

/** Endereços das páginas conforme o modo (links internos do site). */
export function hrefsDoSite(slug: string, paginas: ConteudoSite['paginas'], modo: ModoSite): Record<string, string> {
  const base = modo === 'host' ? '' : `/s/${slug}`
  return Object.fromEntries(paginas.map((p) => [p.slug, p.slug === 'inicio' ? base || '/' : `${base}/${p.slug}`]))
}

/**
 * Origem absoluta do site para canonical/sitemap: o domínio próprio ativo, ou
 * NEXT_PUBLIC_SITE_URL + /s/{slug}. `null` se nada disso está disponível.
 */
export function baseAbsoluta(site: Pick<SitePublicado, 'slug' | 'dominio'>, env: Env = process.env): string | null {
  if (site.dominio) return `https://${site.dominio}`
  const origem = env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  if (!origem) return null
  try { return `${new URL(origem).origin}/s/${site.slug}` } catch { return null }
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** `base` já é a raiz do site (domínio próprio, ou origem + /s/{slug}). */
export function gerarSitemapXml(base: string, paginas: ConteudoSite['paginas'], publicadoEm: string): string {
  const raiz = base.replace(/\/+$/, '')
  const lastmod = Number.isNaN(Date.parse(publicadoEm)) ? '' : `<lastmod>${new Date(publicadoEm).toISOString()}</lastmod>`
  const urls = paginas.map((p) => `<url><loc>${xml(p.slug === 'inicio' ? raiz : `${raiz}/${p.slug}`)}</loc>${lastmod}</url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>\n`
}

export function gerarRobotsTxt(base: string | null): string {
  return ['User-agent: *', 'Allow: /', base ? `Sitemap: ${base.replace(/\/+$/, '')}/sitemap.xml` : ''].filter(Boolean).join('\n') + '\n'
}

/** Título/descrição da página para <title> e Open Graph. */
export function metadadosDaPagina(site: Pick<SitePublicado, 'nome' | 'conteudo'>, paginaSlug: string) {
  const pagina = site.conteudo.paginas.find((p) => p.slug === paginaSlug)
  if (!pagina) return null
  const seo = site.conteudo.seo ?? {}
  const titulo = paginaSlug === 'inicio' ? seo.titulo || site.nome : `${pagina.titulo} · ${site.nome}`
  return { pagina, titulo: titulo.slice(0, 90), descricao: seo.descricao || `Portfólio de ${site.nome}.` }
}
