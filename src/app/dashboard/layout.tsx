import { previaLocalAtiva } from '@/lib/previa-local/ambiente'
import { redirect } from 'next/navigation'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'
import { getPlatformRole, requireUser } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'
import { rotaDoPapel } from '@/types/platform'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser()
  const role = await getPlatformRole()
  if (role !== 'fotografo') redirect(rotaDoPapel(role))
  return <WorkspaceShell previaDisponivel={previaLocalAtiva()} area="fotografo" role={role} nome={profile?.nome_completo ?? 'Seu estúdio'} demonstracao={isDemoMode()}>{children}</WorkspaceShell>
}
