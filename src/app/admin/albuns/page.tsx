import type { Metadata } from 'next'
import { AlbunsHub } from '@/components/album-editor/albuns-hub'
import { getAlbuns, getPlatformRole, requirePlatformAccess } from '@/lib/supabase/queries'
import { hasPermission } from '@/types/platform'

export const metadata: Metadata = { title: 'Álbuns' }

export default async function AlbunsPage() {
  await requirePlatformAccess(['projetos', 'design'])
  const role = await getPlatformRole()
  const podeEditar = !role || hasPermission(role, 'projetos', 'editar') || hasPermission(role, 'design', 'editar')
  const albuns = await getAlbuns()
  return <AlbunsHub albuns={albuns} podeEditar={podeEditar} />
}
