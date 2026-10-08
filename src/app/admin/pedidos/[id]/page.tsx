import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, Layers, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/orders/status-badge'
import { SendProofAction } from '@/components/admin/send-proof-action'
import { OrderMediaCard } from '@/components/admin/pedidos/order-media-card'
import { getArquivosPedido, getOrderDetalhe, requirePlatformAccess } from '@/lib/supabase/queries'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Detalhe do pedido' }

export default async function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAccess('projetos')
  const { id } = await params
  const order = await getOrderDetalhe(id)
  if (!order) notFound()

  const arquivos = await getArquivosPedido(order)
  const contato = [order.cliente_final_nome, order.cliente_final_telefone, order.cliente_final_email].filter(Boolean)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/admin/pedidos">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para a esteira
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Pedido #{order.numero}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{order.nome_projeto}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recebido em {formatDate(order.created_at)}</p>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <OrderMediaCard
            orderId={order.id}
            linkExterno={order.link_fotos_brutas}
            fotosEnviadas={order.fotos_enviadas}
            arquivos={arquivos}
          />

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-base font-semibold">Briefing</h2>
            <p className="mt-1 text-sm text-muted-foreground">Estilo: {order.estilo_design}</p>
            {order.briefing ? (
              <p className="mt-3 whitespace-pre-line text-sm">{order.briefing}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Sem observações.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <dl className="space-y-3 text-sm">
              <Item rotulo="Fotógrafo">
                {order.profiles?.nome_completo ?? '—'}
                {order.profiles?.email ? (
                  <span className="block text-muted-foreground">{order.profiles.email}</span>
                ) : null}
                {order.profiles?.telefone ? (
                  <span className="block text-muted-foreground">{order.profiles.telefone}</span>
                ) : null}
              </Item>
              <Item rotulo="Plano">{order.planos?.nome_plano ?? '—'}</Item>
              <Item rotulo="Data do evento">
                {/* `date` puro: meio-dia local evita cair no dia anterior no fuso do Brasil. */}
                {order.data_evento ? formatDate(`${order.data_evento}T12:00:00`) : '—'}
              </Item>
              <Item rotulo="Cliente final">{contato.length > 0 ? contato.join(' · ') : '—'}</Item>
              <Item rotulo="Prazo de entrega">{formatDate(order.prazo_entrega)}</Item>
            </dl>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 text-base font-semibold">Prova</h2>
            {order.projeto_id ? (
              // Revisão do álbum: versões (completas ou só das lâminas alteradas)
              // e as orientações do cliente vivem no projeto de produção.
              <div className="mb-4 flex flex-col gap-2">
                <Button asChild variant="brand" size="sm">
                  <Link href={`/admin/projetos/${order.projeto_id}`}>
                    <Layers className="h-4 w-4" aria-hidden />
                    Versões e envio de lâminas
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/projetos/${order.projeto_id}/prova`}>
                    <MessageSquareText className="h-4 w-4" aria-hidden />
                    Orientações do cliente
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">O projeto de produção nasce quando o pedido é liberado (pago).</p>
            )}
            <SendProofAction orderId={order.id} initialLink={order.link_aprovacao} />
          </section>
        </aside>
      </div>
    </div>
  )
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  )
}
