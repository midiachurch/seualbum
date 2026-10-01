import type { Metadata } from 'next'
import { TeamTable } from '@/components/admin/team-table'
import { getPlatformRole, getTeamMembers, requirePlatformAccess } from '@/lib/supabase/queries'
import { ROLE_PERMISSIONS } from '@/types/platform'

export const metadata: Metadata = { title: 'Equipe' }

export default async function EquipePage() {
  await requirePlatformAccess('equipe')
  const role = await getPlatformRole()
  // Só quem tem 'criar' em 'equipe' (o admin) gerencia — o gestor só visualiza.
  const canManage = !role || Boolean(ROLE_PERMISSIONS[role]?.equipe?.includes('criar'))
  const members = await getTeamMembers()

  return <TeamTable initialMembers={members} canManage={canManage} />
}
