import type { Metadata } from 'next'
import { DespachoManager } from '@/components/admin/production/despacho-manager'
import { getAdicionaisDeProducao, getClients, getPhotographers, getProjects, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Fila de expedição' }

export default async function GraficaPage() {
  await requirePlatformAccess('projetos')
  const [allProjects, clients, photographers] = await Promise.all([getProjects(), getClients(), getPhotographers()])
  const projects = allProjects.filter((p) => p.status === 'aprovado')
  // Adicionais pagos (ou dispensados) seguem para a produção junto com o álbum.
  const adicionais = Object.fromEntries(await getAdicionaisDeProducao(projects.map((p) => p.id)))

  return <DespachoManager projects={projects} clients={clients} photographers={photographers} adicionais={adicionais} />
}
