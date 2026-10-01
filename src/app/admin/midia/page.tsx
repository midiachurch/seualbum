import type { Metadata } from 'next'
import { MediaLibrary } from '@/components/admin/media/media-library'
import { getMediaAssets, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Biblioteca de mídia' }

export default async function MidiaPage() {
  await requirePlatformAccess('midia')
  const assets = await getMediaAssets()
  return <MediaLibrary initialAssets={assets} />
}
