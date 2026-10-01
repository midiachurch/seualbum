import type { Metadata } from 'next'
import { NewProjectWizard } from '@/components/admin/projects/new-project-wizard'
import { getClients, getPhotographers, requireModuleAction } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Novo projeto' }

export default async function NovoProjetoPage() {
  await requireModuleAction('projetos', 'criar', '/admin/projetos')
  const [clients, photographers] = await Promise.all([getClients(), getPhotographers()])
  return <NewProjectWizard clients={clients} photographers={photographers} />
}
