import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { lerPortal } from '@/lib/portal/servidor'
import { segredoValido, uuidValido } from '@/lib/portal/segredos'
import { PortalGallery } from '@/components/portal/portal-gallery'
export const metadata: Metadata = { title: 'Galeria privada', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'
export default async function PortalPage({ params, searchParams }: { params: Promise<{ link: string }>; searchParams: Promise<{ apos?: string }> }) {
  const { link } = await params
  const { apos } = await searchParams
  if (!segredoValido(link)) notFound()
  const projeto = await lerPortal(link, uuidValido(apos) ? apos : undefined)
  return <PortalGallery link={link} projeto={projeto} paginada={Boolean(apos)} />
}
