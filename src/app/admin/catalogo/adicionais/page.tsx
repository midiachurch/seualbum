import type { Metadata } from 'next'
import { AdicionaisManager } from '@/components/admin/adicionais-manager'
import { getAdicionaisAdmin, getMediaAssets, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Adicionais' }

export default async function AdminAdicionaisPage() {
  await requirePlatformAccess('vitrine')
  const [itens, assets] = await Promise.all([getAdicionaisAdmin(), getMediaAssets()])
  return <AdicionaisManager itens={itens} assets={assets} />
}
