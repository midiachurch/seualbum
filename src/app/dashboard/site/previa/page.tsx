import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlocosDaPagina, SiteShell } from '@/components/sites/site-render'
import { requireUser } from '@/lib/supabase/queries'
import { uuidValido } from '@/lib/portal/segredos'
import type { ConteudoSite, MapaMidias } from '@/lib/sites/tipos'
import { validarConteudoSite } from '@/lib/sites/validar'

/** Prévia PRIVADA do rascunho salvo: exige sessão de quem é membro da organização (RLS) e nunca é indexável nem cacheada. */
export const metadata: Metadata = { title: 'Prévia do site', robots: { index: false, follow: false } }

export default async function PreviaSitePage({ searchParams }: { searchParams: Promise<{ site?: string; pagina?: string }> }) {
  const { site: siteId, pagina: paginaSlug = 'inicio' } = await searchParams
  if (!uuidValido(siteId)) notFound()
  const { profile, supabase } = await requireUser()
  if (profile?.role !== 'fotografo' || !supabase) notFound()
  const { data: site } = await supabase.from('sites').select('id,organizacao_id,slug,nome,rascunho').eq('id', siteId).maybeSingle()
  if (!site) notFound()
  const v = validarConteudoSite(site.rascunho)
  if (!v.ok) notFound()
  const conteudo: ConteudoSite = v.conteudo
  const pagina = conteudo.paginas.find((p) => p.slug === paginaSlug)
  if (!pagina) notFound()
  const { data: linhas } = await supabase.from('site_midias').select('id,chave,largura_px,altura_px').eq('organizacao_id', site.organizacao_id)
  const midias: MapaMidias = Object.fromEntries((linhas ?? []).map((m) => [m.id, { chave: m.chave, largura: m.largura_px, altura: m.altura_px }]))
  const hrefs = Object.fromEntries(conteudo.paginas.map((p) => [p.slug, `/dashboard/site/previa?site=${site.id}&pagina=${p.slug}`]))
  return (
    <SiteShell nome={site.nome} conteudo={conteudo} hrefs={hrefs} paginaAtual={pagina.slug} aviso="Prévia privada do rascunho salvo: o público ainda não vê isto.">
      <BlocosDaPagina pagina={pagina} midias={midias} />
    </SiteShell>
  )
}
