import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { downloadLiberadoPortal, lerColecoesPortal, lerFotosColecaoPortal, lerPortal, lerProvaPortal } from '@/lib/portal/servidor'
import { segredoValido, uuidValido } from '@/lib/portal/segredos'
import { PortalProof } from '@/components/portal/portal-proof'
import { PortalGallery } from '@/components/portal/portal-gallery'
export const metadata: Metadata = { title: 'Galeria privada', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'
export default async function PortalPage({ params, searchParams }: { params: Promise<{ link: string }>; searchParams: Promise<{ apos?: string; colecao?: string }> }) {
  const { link } = await params
  const { apos, colecao } = await searchParams
  if (!segredoValido(link)) notFound()
  const colecaoId = uuidValido(colecao) ? colecao : null
  const base = await lerPortal(link, colecaoId ? undefined : uuidValido(apos) ? apos : undefined)
  // Com coleção escolhida, a lista de fotos é a da coleção (mesmas fotos, mesma paginação por cursor).
  const fotosColecao = base && colecaoId ? await lerFotosColecaoPortal(link, colecaoId, uuidValido(apos) ? apos : undefined) : null
  const projeto = base && colecaoId && fotosColecao ? { ...base, fotos: fotosColecao } : base
  const colecoes = projeto ? await lerColecoesPortal(link) : []
  const download = projeto ? await downloadLiberadoPortal(link) : false
  const prova = projeto ? await lerProvaPortal(link) : null
  return <>{projeto && <nav aria-label="Seções da galeria" className="mx-auto flex max-w-3xl justify-end p-4"><Link className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm underline" href={`/portal/${link}/loja`}>Loja</Link></nav>}{projeto && colecoes.length > 0 && <nav aria-label="Coleções" className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4"><Link className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm" aria-current={!colecaoId ? 'page' : undefined} href={`/portal/${link}`}>Todas</Link>{colecoes.map(c => <Link key={c.id} className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm" aria-current={colecaoId === c.id ? 'page' : undefined} href={`/portal/${link}?colecao=${c.id}`}>{c.nome} ({c.total})</Link>)}</nav>}<PortalGallery link={link} projeto={projeto} paginada={Boolean(apos)} colecao={colecaoId} download={download} />{projeto && prova && <PortalProof link={link} prova={prova} />}</>
}
