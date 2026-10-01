import type { Metadata } from 'next'
import { PaginasManager } from '@/components/admin/vitrine/paginas-manager'
import { getPaginasConteudo, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Páginas do site' }

export default async function PaginasPage() {
  await requirePlatformAccess('vitrine')
  const paginas = await getPaginasConteudo()
  return <PaginasManager initialPaginas={paginas} />
}
