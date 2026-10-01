import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { OrdemServico } from '@/components/admin/production/ordem-servico'
import { getClients, getPhotographers, getProject, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Ordem de serviço' }

export default async function OrdemServicoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAccess('projetos')
  const { id } = await params
  const [project, clients, photographers] = await Promise.all([getProject(id), getClients(), getPhotographers()])
  if (!project) notFound()

  const client = clients.find((c) => c.id === project.clientId)
  const photographer = photographers.find((p) => p.id === project.fotografoId)

  return <OrdemServico project={project} client={client} photographer={photographer} />
}
