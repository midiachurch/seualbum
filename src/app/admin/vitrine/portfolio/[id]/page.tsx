import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { CollectionDetail } from '@/components/admin/vitrine/collection-detail'
import { getMediaAssets, getPortfolioCollection, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Coleção' }

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAccess('vitrine')
  const { id } = await params
  const [collection, assets] = await Promise.all([getPortfolioCollection(id), getMediaAssets()])
  if (!collection) notFound()

  return <CollectionDetail collection={collection} assets={assets} />
}
