import { previaLocalAtiva } from '@/lib/previa-local/ambiente'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'
import { getPlatformRole, requireAdmin } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin()
  const role = await getPlatformRole()
  return <WorkspaceShell previaDisponivel={previaLocalAtiva()} area="admin" role={role} nome={profile?.nome_completo ?? 'Equipe SeuÁlbum'} demonstracao={isDemoMode()}>{children}</WorkspaceShell>
}
