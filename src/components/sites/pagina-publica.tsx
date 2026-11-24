import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { obterSitePublicado, urlDaMidia } from '@/lib/sites/publico'
import { baseAbsoluta, hrefsDoSite, metadadosDaPagina, type ModoSite } from '@/lib/sites/seo'
import { BlocosDaPagina, SiteShell } from './site-render'

/**
 * Página pública de um site, compartilhada pelas duas árvores de rota:
 *  - /s/{slug}/…          (modo 'plataforma'): se o site tem domínio ativo, redireciona para ele;
 *  - /site-host/{slug}/…  (modo 'host'): alvo do rewrite do proxy para domínios próprios
 *                         (links relativos à raiz do domínio; bloqueado nos hosts do app).
 * Só lê a versão PUBLICADA (RPC pública). A chave de cache é o caminho (inclui o slug).
 */
export async function metadadosPublicos(slug: string, paginaSlug: string, modo: ModoSite): Promise<Metadata> {
  const site = await obterSitePublicado(slug)
  const meta = site ? metadadosDaPagina(site, paginaSlug) : null
  if (!site || !meta) return { title: 'Site indisponível', robots: { index: false, follow: false } }
  const base = baseAbsoluta(site)
  const caminho = paginaSlug === 'inicio' ? '' : `/${paginaSlug}`
  const url = base ? `${base}${caminho}` : modo === 'host' ? undefined : `/s/${site.slug}${caminho}`
  const midia = site.conteudo.seo?.midia_id ?? Object.keys(site.midias)[0]
  const imagem = midia ? urlDaMidia(site.midias[midia]) : null
  return {
    title: meta.titulo,
    description: meta.descricao,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title: meta.titulo, description: meta.descricao, type: 'website', siteName: site.nome, url, images: imagem ? [{ url: imagem }] : undefined },
    twitter: { card: imagem ? 'summary_large_image' : 'summary', title: meta.titulo, description: meta.descricao, images: imagem ? [imagem] : undefined },
  }
}

export async function PaginaPublica({ slug, paginaSlug, modo }: { slug: string; paginaSlug: string; modo: ModoSite }) {
  const site = await obterSitePublicado(slug)
  if (!site) notFound()
  const pagina = site.conteudo.paginas.find((p) => p.slug === paginaSlug)
  if (!pagina) notFound()
  // Domínio próprio ativo: ele é o endereço canônico (evita conteúdo duplicado).
  if (modo === 'plataforma' && site.dominio) redirect(`https://${site.dominio}${paginaSlug === 'inicio' ? '' : `/${paginaSlug}`}`)
  return (
    <SiteShell nome={site.nome} conteudo={site.conteudo} hrefs={hrefsDoSite(site.slug, site.conteudo.paginas, modo)} paginaAtual={pagina.slug}>
      <BlocosDaPagina pagina={pagina} midias={site.midias} />
    </SiteShell>
  )
}
