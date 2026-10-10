import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ProjectHub } from '@/components/cliente/project-hub'
import { MensagensDoCliente } from '@/components/mensagens/mensagens-do-cliente'
import { listarConversas } from '@/lib/actions/mensagens'
import { abrirFio, opcoesDeLaminas } from '@/lib/mensagens-servidor'
import { getCurrentClient, getPhotographers, getProject, requireUser } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Meu projeto' }

const VALID_TABS = ['visao-geral', 'fotos', 'detalhes', 'mensagens']

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

  // Mensagens (0037): o fio com o estúdio, com a marca do estúdio (o cliente
  // não lê `fotografos`; o nome e o logo vêm de `listar_conversas`).
  const { user } = await requireUser()
  const fio = await abrirFio('cliente_estudio', { projetoId: project.id })
  const marca = fio ? await listarConversas({ canal: 'cliente_estudio', projetoId: project.id, incluirVazias: true, limite: 1 }) : null
  const conversa = marca?.ok ? marca.conversas[0] : undefined

  return (
    <ProjectHub
      project={project}
      photographer={photographer}
      initialTab={initialTab}
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
