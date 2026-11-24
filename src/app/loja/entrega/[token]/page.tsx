import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { segredoValido } from '@/lib/portal/segredos'
import { hashTokenEntrega } from '@/lib/store/token'
import { createPublicClient } from '@/lib/supabase/server'
import type { StoreEntrega } from '@/types/database'

export const metadata: Metadata = { title: 'Sua compra', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, string> = {
  pendente: 'Aguardando a confirmação do pagamento.',
  recusado: 'O pagamento foi recusado. Nenhuma cobrança foi feita e nada foi liberado.',
  cancelado: 'Este pedido foi cancelado.',
  estornado: 'Este pedido foi estornado: o acesso aos arquivos foi encerrado.',
}

export default async function EntregaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!segredoValido(token)) notFound()
  const { data, error } = await createPublicClient().rpc('store_entrega', { p_token_hash: hashTokenEntrega(token) })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) notFound()
  const entrega = data as unknown as StoreEntrega
  return <main className="mx-auto max-w-2xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Sua compra</h1>
    {entrega.status !== 'pago' ? <p role="status">{STATUS[entrega.status] ?? 'Pedido indisponível.'}</p> : <>
      <p role="status">Pagamento confirmado. Seus arquivos estão abaixo; cada link de download vale por poucos minutos e é gerado a cada clique.</p>
      {entrega.itens.map(item => <section key={item.nome} className="space-y-2 rounded-2xl border p-4" aria-label={item.nome}>
        <h2 className="font-medium">{item.nome}{item.quantidade > 1 ? ` × ${item.quantidade}` : ''}</h2>
        {item.fotos.length === 0 ? <p className="text-sm text-muted-foreground">Este item é entregue pelo estúdio, fora desta página.</p> : <ul className="grid gap-2 sm:grid-cols-2">
          {item.fotos.map((foto, i) => <li key={foto.id}>
            <a className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm underline" href={`/api/store/entrega/${token}/${foto.id}`}>Baixar {foto.nome ?? `foto ${i + 1}`}</a>
          </li>)}
        </ul>}
      </section>)}
    </>}
  </main>
}
