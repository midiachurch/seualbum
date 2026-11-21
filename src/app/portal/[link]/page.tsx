import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { lerPortal, lerProvaPortal } from '@/lib/portal/servidor'
import { segredoValido, uuidValido } from '@/lib/portal/segredos'
import { PortalProof } from '@/components/portal/portal-proof'
import { PortalGallery } from '@/components/portal/portal-gallery'
export const metadata: Metadata = { title: 'Galeria privada', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'
export default async function PortalPage({ params, searchParams }: { params: Promise<{ link: string }>; searchParams: Promise<{ apos?: string }> }) {
  const { link } = await params
  const { apos } = await searchParams
  if (!segredoValido(link)) notFound()
  const projeto = await lerPortal(link, uuidValido(apos) ? apos : undefined)
  const prova = projeto ? await lerProvaPortal(link) : null
  return <>{projeto && <nav aria-label="Seções da galeria" className="mx-auto flex max-w-3xl justify-end p-4"><Link className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm underline" href={`/portal/${link}/loja`}>Loja</Link></nav>}<PortalGallery link={link} projeto={projeto} paginada={Boolean(apos)} />{projeto && prova && <PortalProof link={link} prova={prova} />}</>
}
