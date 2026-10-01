import type { Metadata } from 'next'
import { PhotographersTable } from '@/components/admin/photographers-table'
import { getPhotographers, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Fotógrafos' }

export default async function FotografosPage() {
  await requirePlatformAccess('fotografos')
  const photographers = await getPhotographers()
  return <PhotographersTable photographers={photographers} />
}
