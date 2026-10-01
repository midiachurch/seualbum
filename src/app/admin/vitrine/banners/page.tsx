import type { Metadata } from 'next'
import { BannersManager } from '@/components/admin/vitrine/banners-manager'
import { getBanners, getMediaAssets, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Banners' }

export default async function BannersPage() {
  await requirePlatformAccess('vitrine')
  const [banners, assets] = await Promise.all([getBanners(), getMediaAssets()])
  return <BannersManager initialBanners={banners} assets={assets} />
}
