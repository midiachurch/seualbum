import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SimpleTabs } from '@/components/ui/simple-tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { getClients, getPhotographers, requirePlatformAccess } from '@/lib/supabase/queries'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Perfil do cliente' }

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAccess('clientes')
  const { id } = await params
  const [clients, photographers] = await Promise.all([getClients(), getPhotographers()])
  const client = clients.find((c) => c.id === id)
  if (!client) notFound()

  const fotografo = photographers.find((p) => p.id === client.fotografoResponsavelId)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/admin/clientes">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para clientes
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{client.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cliente desde {formatDate(client.createdAt)} · {client.cidade}/{client.estado}
          </p>
        </div>
        <span
          className={
            client.status === 'ativo'
              ? 'inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800'
              : 'inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground'
          }
        >
          {client.status === 'ativo' ? 'Ativo' : 'Inativo'}
        </span>
      </header>

      <SimpleTabs
        tabs={[
          {
            value: 'dados',
            label: 'Dados pessoais',
            content: (
              <dl className="grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</dt>
                  <dd className="mt-1 text-sm">{client.email}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</dt>
                  <dd className="mt-1 text-sm">{client.telefone}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Origem</dt>
                  <dd className="mt-1 text-sm">{client.origem}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Fotógrafo responsável
                  </dt>
                  <dd className="mt-1 text-sm">
                    {fotografo ? (
                      <Link href={`/admin/fotografos/${fotografo.id}`} className="underline underline-offset-2">
                        {fotografo.estudio}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
            ),
          },
          {
            value: 'projetos',
            label: `Projetos (${client.projetosCount})`,
            content: (
              <EmptyState
                title="Módulo de projetos ainda não implementado"
                description="Entra na Fase 2 — a listagem de álbuns/projetos deste cliente vai aparecer aqui."
              />
            ),
          },
          {
            value: 'fotografias',
            label: 'Fotografias',
            content: (
              <EmptyState
                title="Nenhuma fotografia associada ainda"
                description="A galeria de arquivos enviados para os projetos deste cliente entra na Fase 2/3."
              />
            ),
          },
          {
            value: 'historico',
            label: 'Histórico',
            content: (
              <EmptyState
                title="Sem atividades registradas"
                description="O histórico de ações relacionadas a este cliente vai aparecer aqui conforme o log do sistema for implementado."
              />
            ),
          },
          {
            value: 'comunicacao',
            label: 'Comunicação',
            content: (
              <EmptyState
                title="Nenhuma mensagem ainda"
                description="Estrutura preparada para futuras mensagens e notificações com o cliente."
              />
            ),
          },
          {
            value: 'internas',
            label: 'Informações internas',
            content: client.observacoesInternas ? (
              <p className="rounded-2xl border bg-card p-5 text-sm">{client.observacoesInternas}</p>
            ) : (
              <EmptyState title="Nenhuma observação interna registrada" />
            ),
          },
        ]}
      />
    </div>
  )
}
