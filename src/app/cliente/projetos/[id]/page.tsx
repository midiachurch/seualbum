import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ProjectHub } from '@/components/cliente/project-hub'
import { PainelAprovacao } from '@/components/cliente/painel/painel-aprovacao'
import {
  getCurrentClient,
  getPhotographers,
  getProject,
  getProofComments,
  getRevisoesDasProvas,
  requireUser,
} from '@/lib/supabase/queries'
import { versoesLiberadas } from '@/lib/prova/painel'

export const metadata: Metadata = { title: 'Meu projeto' }

// SLOT Mensagens: a aba de mensagens entra com 'mensagens' aqui e `abaMensagens` no ProjectHub.
const VALID_TABS = ['aprovacao', 'visao-geral', 'fotos', 'detalhes']

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

  const [photographers, comentarios, revisoes, { user }] = await Promise.all([
    getPhotographers(),
    getProofComments(id),
    getRevisoesDasProvas([id]),
    requireUser(),
  ])
  const photographer = photographers.find((p) => p.id === project.fotografoId)

  // Com prova publicada, o projeto abre no painel de aprovação.
  const temProva = versoesLiberadas(project.designVersions).length > 0
  const abaPadrao = temProva ? 'aprovacao' : 'visao-geral'
  const initialTab = aba && VALID_TABS.includes(aba) && (aba !== 'aprovacao' || temProva) ? aba : abaPadrao

  return (
    <ProjectHub
      project={project}
      photographer={photographer}
      initialTab={initialTab}
      painelAprovacao={
        temProva ? (
          <PainelAprovacao
            project={project}
            comentarios={comentarios}
            revisoes={revisoes ? (revisoes.get(id) ?? []) : null}
            meuId={user.id}
          />
        ) : undefined
      }
    />
  )
}
