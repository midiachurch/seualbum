import type { Metadata } from 'next'
import { CatalogManager } from '@/components/admin/catalog-manager'
import { requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Vitrine' }

export default async function AdminCatalogoPage() {
  await requirePlatformAccess('vitrine')
  return <CatalogManager />
}
