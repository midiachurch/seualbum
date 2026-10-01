import type { Metadata } from 'next'
import { ProjectsBoard } from '@/components/admin/projects/projects-board'
import { getClients, getPhotographers, getPlatformRole, getProjects, requirePlatformAccess } from '@/lib/supabase/queries'
import { hasPermission } from '@/types/platform'

export const metadata: Metadata = { title: 'Projetos' }

export default async function ProjetosPage() {
  await requirePlatformAccess('projetos')
  const role = await getPlatformRole()
  const canEdit = !role || hasPermission(role, 'projetos', 'editar')
  const canCreate = !role || hasPermission(role, 'projetos', 'criar')
  const [projects, clients, photographers] = await Promise.all([getProjects(), getClients(), getPhotographers()])

  return (
    <ProjectsBoard
      projects={projects}
      clients={clients}
      photographers={photographers}
      canEdit={canEdit}
      canCreate={canCreate}
    />
  )
}
