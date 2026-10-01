import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/orders/status-badge'
import { SendProofAction } from '@/components/admin/send-proof-action'
import { getAllOrders, requirePlatformAccess } from '@/lib/supabase/queries'
import { formatDate } from '@/lib/utils'
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/types/database'

export const metadata: Metadata = { title: 'Esteira de produção' }

const FILA: OrderStatus[] = ['pendente', 'na_fila_design', 'em_producao', 'aguardando_aprovacao', 'em_revisao']

export default async function PedidosPage() {
  await requirePlatformAccess('projetos')
  const orders = await getAllOrders()

  const contagem = FILA.map((status) => ({
    status,
    total: orders.filter((o) => o.status === status).length,
  }))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Esteira de produção</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} no total.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {contagem.map(({ status, total }) => (
          <div key={status} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{ORDER_STATUS_LABEL[status]}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{total}</p>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nenhum pedido recebido ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Pedido</th>
                <th scope="col" className="px-4 py-3 font-semibold">Estilo</th>
                <th scope="col" className="px-4 py-3 font-semibold">Recebido</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Fotos brutas</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Prova</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pedidos/${order.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      <span className="font-medium">#{order.numero}</span> · {order.nome_projeto}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{order.estilo_design}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {order.link_fotos_brutas ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={order.link_fotos_brutas}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir link
                        </a>
                      </Button>
                    ) : null}
                    {order.fotos_enviadas > 0 ? (
                      // Storage: pedidos_fotos/{client_id}/{chave_idempotencia}/
                      <span className="ml-2 whitespace-nowrap text-muted-foreground">
                        {order.fotos_enviadas} {order.fotos_enviadas === 1 ? 'foto' : 'fotos'} enviadas
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <SendProofAction orderId={order.id} initialLink={order.link_aprovacao} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
