import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ProofViewer } from '@/components/cliente/proof/proof-viewer'
import { getProject, getProofComments, requirePlatformAccess } from '@/lib/supabase/queries'
import { hasPermission } from '@/types/platform'

export const metadata: Metadata = { title: 'Lâminas e apontamentos' }

/** O cliente/fotógrafo pediu ajustes: a equipe deve uma nova versão. */
const AGUARDANDO_AJUSTES = ['alteracoes_solicitadas', 'em_ajustes']

/**
 * A prova vista pela equipe: todas as versões (inclusive em revisão interna),
 * com os pins que o cliente/fotógrafo marcou — é daqui que o designer sabe
 * exatamente de qual foto estão falando. A equipe não aprova nem comenta pela
 * prova; ela marca cada pin como resolvido (0019) e, com o cliente esperando
 * ajustes, fecha o ciclo em "Finalizar atualizações" (sobe a próxima versão).
 */
export default async function AdminProvaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { profile, role } = await requirePlatformAccess(['projetos', 'design'])
  const podeSubirVersao = !role || hasPermission(role, 'projetos', 'editar') || hasPermission(role, 'design', 'editar')
  const { id } = await params
  const { versao } = await searchParams

  const project = await getProject(id)
  if (!project) notFound()
  const comments = await getProofComments(id)

  return (
    <ProofViewer
      perfil="equipe"
      projectId={project.id}
      projectName={project.nome}
      autor={profile?.nome_completo ?? 'Equipe'}
      versions={project.designVersions}
      initialComments={comments}
      locked={false}
      podeDecidir={false}
      versaoInicial={typeof versao === 'string' ? Number(versao) : undefined}
      finalizarHref={
        podeSubirVersao && AGUARDANDO_AJUSTES.includes(project.status) ? `/admin/design?subir=${project.id}` : undefined
      }
    />
  )
}
