import type { Metadata } from 'next'
import { PortfolioManager } from '@/components/admin/vitrine/portfolio-manager'
import { getMediaAssets, getPortfolioCollections, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Portfólio' }

export default async function PortfolioPage() {
  await requirePlatformAccess('vitrine')
  const [collections, assets] = await Promise.all([getPortfolioCollections(), getMediaAssets()])
  return <PortfolioManager initialCollections={collections} assets={assets} />
}
