import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ProjectHub } from '@/components/cliente/project-hub'
import { getCurrentClient, getPhotographers, getProject } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Meu projeto' }

const VALID_TABS = ['visao-geral', 'fotos', 'detalhes']

export default async function ClienteProjetoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const client = await getCurrentClient()
  const { id } = await params
  const { aba } = await searchParams

  const project = await getProject(id)
  // Um cliente nunca pode ver o projeto de outro (seção 29) — RLS já barra
  // isso no banco; esta checagem é a segunda camada em modo de demonstração.
  if (!project || project.clientId !== client?.id) notFound()

  const photographers = await getPhotographers()
  const photographer = photographers.find((p) => p.id === project.fotografoId)
  const initialTab = aba && VALID_TABS.includes(aba) ? aba : 'visao-geral'

  return <ProjectHub project={project} photographer={photographer} initialTab={initialTab} />
}
