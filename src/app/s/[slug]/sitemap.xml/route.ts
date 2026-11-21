import { NextResponse } from 'next/server'
import { obterSitePublicado } from '@/lib/sites/publico'
import { baseAbsoluta, gerarSitemapXml } from '@/lib/sites/seo'

export const revalidate = 60

/** Sitemap por site: só as páginas da versão publicada, com URLs do próprio site. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = await obterSitePublicado(slug)
  if (!site) return new NextResponse('Site indisponível.', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } })
  const base = baseAbsoluta(site) ?? `${new URL(request.url).origin}/s/${site.slug}`
  return new NextResponse(gerarSitemapXml(base, site.conteudo.paginas, site.publicado_em), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
