import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ProjectHub } from '@/components/cliente/project-hub'
import { PainelAprovacao } from '@/components/cliente/painel/painel-aprovacao'
import { MensagensDoCliente } from '@/components/mensagens/mensagens-do-cliente'
import { listarConversas } from '@/lib/actions/mensagens'
import { abrirFio, opcoesDeLaminas } from '@/lib/mensagens-servidor'
import { versoesLiberadas } from '@/lib/prova/painel'
import {
  getCurrentClient,
  getPhotographers,
  getProject,
  getProofComments,
  getRevisoesDasProvas,
  requireUser,
} from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Meu projeto' }

const VALID_TABS = ['aprovacao', 'visao-geral', 'fotos', 'detalhes', 'mensagens']

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

  // Com prova publicada, o projeto abre no painel de aprovação (0039).
  const temProva = versoesLiberadas(project.designVersions).length > 0
  const abaPadrao = temProva ? 'aprovacao' : 'visao-geral'
  const initialTab = aba && VALID_TABS.includes(aba) && (aba !== 'aprovacao' || temProva) ? aba : abaPadrao

  // Mensagens (0037): o fio com o estúdio, com a marca do estúdio (o cliente
  // não lê `fotografos`; o nome e o logo vêm de `listar_conversas`).
  const fio = await abrirFio('cliente_estudio', { projetoId: project.id })
  const marca = fio ? await listarConversas({ canal: 'cliente_estudio', projetoId: project.id, incluirVazias: true, limite: 1 }) : null
  const conversa = marca?.ok ? marca.conversas[0] : undefined

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
      painelMensagens={
        <MensagensDoCliente
          estudio={conversa?.estudio ?? photographer?.estudio ?? 'Seu fotógrafo'}
          logoUrl={conversa?.estudioLogoUrl ?? null}
          fio={fio}
          meuId={user.id}
          laminas={opcoesDeLaminas(project, { somenteLiberadas: true })}
        />
      }
    />
  )
}
