import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import { NovoPedidoWizard } from '@/components/dashboard/novo-pedido/wizard'
import { getActivePlans, getMinhaAssinaturaId, getPlatformRole, requireUser } from '@/lib/supabase/queries'
import { EQUIPE_ROLES } from '@/types/platform'

export const metadata: Metadata = { title: 'Novo pedido' }

// `cover` libera `env(safe-area-inset-bottom)` para o rodapé fixo do wizard
// não ficar embaixo do indicador de home do iPhone.
export const viewport: Viewport = { viewportFit: 'cover' }

/**
 * Wizard de novo pedido em 5 passos (Plano → Projeto → Fotos → Briefing →
 * Revisão). O estado vive em `src/store/usePedidoWizardStore.ts`, persistido no
 * `localStorage` para o fotógrafo não perder o rascunho ao trocar de app.
 * Fotos sobem direto do navegador para o Storage (`src/lib/upload-pedido-foto.ts`)
 * e o envio final é `criarPedidoAction` (`src/lib/actions/pedidos.ts`).
 */
export default async function NovoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user } = await requireUser()
  // O wizard é exclusivo do estúdio: pedido criado por conta de equipe nunca
  // vira projeto (o dono do projeto precisa ser um fotógrafo, migration 0017).
  const role = await getPlatformRole()
  if (role !== 'fotografo') redirect(role && EQUIPE_ROLES.includes(role) ? '/admin' : '/')

  // `?plano=<slug>` vem da vitrine, passando pelo cadastro (register-form).
  const { plano } = await searchParams
  const [todosPlanos, assinaturaId] = await Promise.all([getActivePlans(), getMinhaAssinaturaId()])

  // Avulsos para todos; plano mensal só o que o estúdio contratou — os outros
  // mensais não fazem sentido por pedido (e a RLS barraria o bypass).
  const plans = todosPlanos
    .filter((p) => p.tipo_cobranca !== 'assinatura' || p.id === assinaturaId)
    .sort((a, b) => Number(b.id === assinaturaId) - Number(a.id === assinaturaId))

  // Planos de assinatura que este estúdio não contratou: se a vitrine mandou um
  // deles, o wizard explica por que não dá para pré-selecionar.
  const assinaturasNaoContratadas = todosPlanos
    .filter((p) => p.tipo_cobranca === 'assinatura' && p.id !== assinaturaId)
    .map((p) => ({ slug: p.slug, nome: p.nome_plano }))

  // `userId` é a primeira pasta do path no Storage (a RLS confere contra auth.uid()).
  return (
    <NovoPedidoWizard
      plans={plans}
      userId={user.id}
      assinaturaId={assinaturaId}
      planoDaUrl={typeof plano === 'string' ? plano : null}
      assinaturasNaoContratadas={assinaturasNaoContratadas}
    />
  )
}
