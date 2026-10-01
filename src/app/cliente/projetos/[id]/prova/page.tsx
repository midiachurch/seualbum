import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ProofViewer } from '@/components/cliente/proof/proof-viewer'
import { getCurrentClient, getOfertasDaProva, getProject, getProofComments } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Prova digital' }

const STATUS_TRAVADO = ['aprovado_aguardando_pagamento', 'aprovado', 'enviado', 'finalizado', 'arquivado']

export default async function ClienteProvaPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await getCurrentClient()
  const { id } = await params

  const project = await getProject(id)
  if (!project || project.clientId !== client?.id) notFound()

  const locked = STATUS_TRAVADO.includes(project.status)
  // Só versões aprovadas internamente chegam ao cliente (a RLS das lâminas
  // aplica a mesma regra — migration 0018).
  const versoesLiberadas = project.designVersions.filter((v) => v.status === 'aprovada')
  // White label (Fase 5): lâminas extras são cobradas do fotógrafo, nunca
  // aparecem aqui. O banco decide a cobrança quando o cliente aprova.
  const podeDecidir = project.status === 'aguardando_aprovacao_cliente'
  // Upsell (0026): adicionais que o estúdio oferece, pelo preço de revenda dele.
  const [comments, ofertas] = await Promise.all([getProofComments(id), podeDecidir ? getOfertasDaProva(id) : Promise.resolve([])])

  return (
    <ProofViewer
      projectId={project.id}
      projectName={project.nome}
      autor={client?.nome ?? 'Você'}
      versions={versoesLiberadas}
      initialComments={comments}
      locked={locked}
      podeDecidir={podeDecidir}
      ofertas={ofertas}
    />
  )
}
