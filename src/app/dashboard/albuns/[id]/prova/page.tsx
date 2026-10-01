import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProofViewer } from '@/components/cliente/proof/proof-viewer'
import { getOfertasDaProva, getPlatformRole, getProject, getProofComments, getResumoExcedente, requireUser } from '@/lib/supabase/queries'
import { EQUIPE_ROLES } from '@/types/platform'

export const metadata: Metadata = { title: 'Prova do álbum' }

// Mesma trava do portal do cliente: depois de aprovado, só a tela de conclusão.
const STATUS_TRAVADO = ['aprovado_aguardando_pagamento', 'aprovado', 'enviado', 'finalizado', 'arquivado']

/**
 * Prova digital pelo fotógrafo, dono do projeto. `[id]` é o id do PROJETO
 * (o pedido aponta para ele em `orders.projeto_id`, migration 0017).
 * A página nega quem não é o estúdio dono — a RLS de `projetos` também.
 */
export default async function FotografoProvaPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, profile } = await requireUser()
  const role = await getPlatformRole()
  if (role && EQUIPE_ROLES.includes(role)) redirect(`/admin/projetos/${(await params).id}`)
  if (role !== 'fotografo') notFound()

  const { id } = await params
  const project = await getProject(id)
  if (!project || project.fotografoId !== user.id) notFound()

  // Só versões aprovadas internamente chegam ao estúdio (a RLS das lâminas
  // aplica a mesma regra — migration 0018).
  const versoesLiberadas = project.designVersions.filter((v) => v.status === 'aprovada')

  if (versoesLiberadas.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F5F5]">
          <Clock className="h-7 w-7 text-[#171717]" aria-hidden />
        </span>
        <h1 className="text-xl font-bold tracking-tight">A prova ainda não está pronta</h1>
        <p className="text-sm text-muted-foreground">
          A equipe está diagramando &quot;{project.nome}&quot;. Avisamos assim que a primeira versão estiver disponível.
        </p>
        <Button asChild variant="brandOutline" className="min-h-[44px]">
          <Link href="/dashboard/meus-albuns">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar para meus álbuns
          </Link>
        </Button>
      </div>
    )
  }

  // Transparência antes do clique final: lâminas × franquia, pelo banco.
  const aguardandoPagamento = project.status === 'aprovado_aguardando_pagamento'
  const aguardandoDecisao = project.status === 'aguardando_aprovacao_cliente'
  const [comments, excedente, ofertas] = await Promise.all([
    getProofComments(id),
    aguardandoDecisao || aguardandoPagamento ? getResumoExcedente(id) : Promise.resolve(null),
    // Upsell (0026): o estúdio também pode incluir adicionais (pelo custo).
    aguardandoDecisao ? getOfertasDaProva(id) : Promise.resolve([]),
  ])

  return (
    <ProofViewer
      perfil="fotografo"
      projectId={project.id}
      projectName={project.nome}
      autor={profile?.nome_completo ?? 'Você'}
      versions={versoesLiberadas}
      initialComments={comments}
      locked={STATUS_TRAVADO.includes(project.status)}
      podeDecidir={project.status === 'aguardando_aprovacao_cliente'}
      excedente={excedente}
      aguardandoPagamento={aguardandoPagamento}
      ofertas={ofertas}
    />
  )
}
