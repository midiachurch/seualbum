import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlbumNome, AlbumThumb } from '@/components/dashboard/album-thumb'
import { getCapasDosProjetos, getCobrancasPendentes, getMyOrders, requireUser } from '@/lib/supabase/queries'
import { destinoDoAlbum, statusDoAlbum } from '@/lib/status-album'
import { formatBRL, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Painel' }

export default async function DashboardPage() {
  const { profile } = await requireUser()
  const orders = await getMyOrders()

  // Mesma tradução de "Meus álbuns": produção vem do projeto, e todo álbum cai
  // em exatamente um grupo — os contadores sempre batem com a lista.
  // "Em andamento" = aguardando pagamento, na fila, em diagramação, em ajustes.
  const albuns = orders.map((o) => {
    const album = statusDoAlbum({ status: o.status, projetoStatus: o.projetos?.status ?? null })
    return {
      order: o,
      album,
      destino: destinoDoAlbum({ album, projetoId: o.projetos?.id ?? null, linkEntregaFinal: o.link_entrega_final }),
    }
  })
  const recentes = albuns.slice(0, 5)
  const [capas, cobrancas] = await Promise.all([
    getCapasDosProjetos(recentes.flatMap((a) => (a.order.projetos ? [a.order.projetos.id] : []))),
    getCobrancasPendentes(),
  ])
  const totalCobrancas = cobrancas.reduce((soma, c) => soma + c.valorTotal, 0)
  const pedidosDoCliente = cobrancas.reduce(
    (soma, c) => soma + (c.detalhes ?? []).filter((i) => i.situacao === 'aguardando_estudio').length,
    0,
  )
  const emAndamento = albuns.filter((a) => a.album.grupo === 'andamento').length
  const aguardando = albuns.filter((a) => a.album.grupo === 'prova').length
  const finalizados = albuns.filter((a) => a.album.grupo === 'finalizado').length

  const metricas = [
    { label: 'Em andamento', valor: emAndamento },
    { label: 'Aguardando sua aprovação', valor: aguardando },
    { label: 'Finalizados', valor: finalizados },
  ]

  return (
    <div className="space-y-16 md:space-y-24">
      <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Painel
          </p>
          <h1 className="mt-3 break-words text-4xl font-light leading-[1.1] tracking-tight text-foreground md:text-5xl">
            Olá, {profile?.nome_completo}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground md:text-base">
            Acompanhe a esteira dos seus álbuns.
          </p>
        </div>
        <Button asChild variant="brand" size="lg" className="self-start md:self-auto">
          <Link href="/dashboard/novo-pedido">Enviar novo álbum</Link>
        </Button>
      </header>

      {cobrancas.length > 0 ? (
        // Aviso no painel (Fase 5 + Upsell): álbum aprovado esperando o
        // fechamento do estúdio (lâminas extras e/ou adicionais) para a gráfica.
        <Link
          href="/dashboard/meus-albuns#laminas-extras"
          className="-mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 transition-colors hover:bg-amber-100 md:-mt-14"
        >
          <span className="min-w-0 text-sm text-amber-950">
            <strong className="block font-semibold">
              {pedidosDoCliente > 0
                ? `Seu cliente pediu ${pedidosDoCliente === 1 ? '1 adicional' : `${pedidosDoCliente} adicionais`} — confirme para fechar`
                : `${cobrancas.length === 1 ? '1 álbum aprovado aguarda' : `${cobrancas.length} álbuns aprovados aguardam`} o seu fechamento`}
            </strong>
            O arquivo só segue para a gráfica depois do fechamento.
          </span>
          <span className="shrink-0 rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white">
            {pedidosDoCliente > 0 ? 'Ver pedidos' : `Fechar ${formatBRL(totalCobrancas)}`}
          </span>
        </Link>
      ) : null}

      <section
        aria-label="Métricas"
        className="grid grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {metricas.map((m) => (
          <div key={m.label} className="flex flex-col gap-2 py-6 sm:px-8 sm:py-10 sm:first:pl-0">
            <p className="min-h-8 text-xs uppercase leading-4 tracking-[0.15em] text-muted-foreground">
              {m.label}
            </p>
            <p className="font-heading text-4xl font-light tracking-tight text-foreground md:text-5xl">
              {m.valor}
            </p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-medium tracking-tight text-foreground">Pedidos recentes</h2>

        {orders.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-4 border-y border-dashed border-border py-20 text-center">
            <p className="font-heading max-w-sm text-2xl font-light leading-snug text-foreground">
              Você ainda não enviou nenhum álbum.
            </p>
            <Link
              href="/dashboard/novo-pedido"
              className="text-sm font-medium text-[#171717] transition-colors hover:text-[#444444]"
            >
              Comece pelo primeiro pedido →
            </Link>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border border-t border-border">
            {recentes.map(({ order, album, destino }) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm px-2 py-4 transition-colors hover:bg-secondary/50 sm:px-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <AlbumThumb
                    src={order.projetos ? (capas.get(order.projetos.id) ?? null) : null}
                    nome={order.nome_projeto}
                    destino={destino}
                    className="h-14 w-14"
                  />
                  <div className="min-w-0">
                    <p className="break-words font-medium text-foreground">
                      <span className="text-muted-foreground">#{order.numero}</span>{' '}
                      <AlbumNome nome={order.nome_projeto} destino={destino} />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enviado em {formatDate(order.created_at)}
                    </p>
                  </div>
                </div>
                <Badge variant={album.variante}>{album.rotulo}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
