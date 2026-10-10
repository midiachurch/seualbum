import Link from 'next/link'
import type { Metadata } from 'next'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PayOrderButton } from '@/components/orders/pay-order-button'
import {
  confirmarFaturaPorSessao,
  confirmarPagamentoPorSessao,
  getStripe,
  stripeConfigurado,
  type ResultadoConfirmacao,
  type ResultadoConfirmacaoFatura,
} from '@/lib/stripe'
import { AlbumNome, AlbumThumb } from '@/components/dashboard/album-thumb'
import { CobrancasLaminasExtras } from '@/components/dashboard/cobrancas-laminas-extras'
import {
  getCapasDosProjetos,
  getCobrancasPendentes,
  getMyOrders,
  getPagamentoSimuladoAtivo,
  requireUser,
  type PedidoDoFotografo,
} from '@/lib/supabase/queries'
import { destinoDoAlbum, statusDoAlbum, type StatusAlbum } from '@/lib/status-album'
import { formatBRL, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Meus álbuns' }

/**
 * Volta do Stripe Checkout (`?sucesso=true&session_id=cs_…`). Confere a sessão
 * direto no Stripe e confirma o pagamento aqui mesmo, sem esperar o webhook —
 * a mesma função do webhook, então quem chegar primeiro confirma. Só aceita
 * sessão de pedido do próprio fotógrafo.
 */
async function conferirRetornoDoCheckout(sessionId: string): Promise<ResultadoConfirmacao | null> {
  if (!stripeConfigurado() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    const pedidoId = session.metadata?.pedido_id
    if (!pedidoId) return null

    const { supabase, user } = await requireUser()
    if (!supabase) return null
    const { data: dono } = await supabase
      .from('orders')
      .select('id')
      .eq('id', pedidoId)
      .eq('client_id', user.id)
      .maybeSingle()
    if (!dono) return null

    return await confirmarPagamentoPorSessao(session)
  } catch (e) {
    console.error('[meus-albuns] conferir checkout', e)
    return null
  }
}

/**
 * Volta do Checkout de uma fatura de fechamento (`?fechamento=sucesso&session_id=cs_…`).
 * Mesma ideia dos pedidos: confere no Stripe e confirma pela mesma função do
 * webhook. Só aceita sessão de fatura de projeto do próprio estúdio.
 */
async function conferirRetornoDaFatura(sessionId: string): Promise<ResultadoConfirmacaoFatura | null> {
  if (!stripeConfigurado() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null

  try {
    // PaymentIntent expandido: registra Pix ou cartão sem adivinhar.
    const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.payment_method'] })
    const faturaId = session.metadata?.fatura_id
    if (!faturaId) return null

    const { supabase, user } = await requireUser()
    if (!supabase) return null
    const { data: dono } = await supabase
      .from('faturas')
      .select('id, projetos!inner(fotografo_id)')
      .eq('id', faturaId)
      .eq('projetos.fotografo_id', user.id)
      .maybeSingle()
    if (!dono) return null

    return await confirmarFaturaPorSessao(session)
  } catch (e) {
    console.error('[meus-albuns] conferir checkout da fatura', e)
    return null
  }
}

export default async function MeusAlbunsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { enviado, fila, sucesso, session_id: sessionId, pagamento, fechamento } = await searchParams

  // Antes de listar: se o pagamento confirmar aqui, a lista já sai atualizada.
  const retorno =
    sucesso === 'true' && typeof sessionId === 'string' ? await conferirRetornoDoCheckout(sessionId) : null
  const retornoFatura =
    fechamento === 'sucesso' && typeof sessionId === 'string' ? await conferirRetornoDaFatura(sessionId) : null

  const orders = await getMyOrders()
  // `?enviado=<numero>` vem do wizard de novo pedido depois do envio.
  const numeroEnviado = typeof enviado === 'string' && /^\d+$/.test(enviado) ? enviado : null
  // Produção vem do projeto (migration 0017); sem projeto, do pedido.
  const [capas, cobrancas, pagamentoSimulado] = await Promise.all([
    getCapasDosProjetos(orders.flatMap((o) => (o.projetos ? [o.projetos.id] : []))),
    getCobrancasPendentes(),
    getPagamentoSimuladoAtivo(),
  ])
  const linhas = orders.map((order) => {
    const album = statusDoAlbum({ status: order.status, projetoStatus: order.projetos?.status ?? null })
    return {
      order,
      album,
      prazo: order.projetos?.prazo ?? order.prazo_entrega,
      capa: order.projetos ? (capas.get(order.projetos.id) ?? null) : null,
      destino: destinoDoAlbum({ album, projetoId: order.projetos?.id ?? null, linkEntregaFinal: order.link_entrega_final }),
    }
  })
  const aguardandoPagamento = orders.filter(
    (o) => o.status === 'pendente' && o.planos && o.planos.tipo_cobranca !== 'assinatura',
  )

  return (
    <div className="space-y-6">
      {enviado ? (
        <Aviso tipo="sucesso" titulo={numeroEnviado ? `Pedido #${numeroEnviado} enviado!` : 'Pedido enviado!'}>
          {fila === '1'
            ? 'Incluso na sua assinatura: o pedido já está na fila de design.'
            : 'Fotos e briefing recebidos. Falta só o pagamento para o pedido entrar na fila de design.'}
        </Aviso>
      ) : null}

      {sucesso === 'true' ? (
        retorno === 'confirmado' || retorno === 'ja_processado' ? (
          <Aviso tipo="sucesso" titulo="Pagamento confirmado!">
            Seu pedido está na fila de design. Avisamos quando a prova estiver pronta.
          </Aviso>
        ) : retorno === 'aguardando_pagamento' ? (
          <Aviso tipo="pendente" titulo="Pagamento em processamento">
            Pagamentos por Pix podem levar alguns minutos. O pedido entra na fila assim que for confirmado.
          </Aviso>
        ) : (
          <Aviso tipo="pendente" titulo="Pagamento recebido">
            Estamos confirmando com o banco. Em instantes o pedido aparece na fila de design.
          </Aviso>
        )
      ) : null}

      {fechamento === 'sucesso' ? (
        retornoFatura === 'confirmado' || retornoFatura === 'ja_processado' ? (
          <Aviso tipo="sucesso" titulo="Fechamento pago!">
            O álbum foi liberado para impressão e entrou na fila da gráfica.
          </Aviso>
        ) : retornoFatura === 'recusado' || retornoFatura === 'valor_divergente' ? (
          <Aviso tipo="erro" titulo="Pagamento recebido — em conferência">
            Nossa equipe vai conferir este pagamento e falar com você. Não pague de novo.
          </Aviso>
        ) : retornoFatura === 'aguardando_pagamento' ? (
          <Aviso tipo="pendente" titulo="Pagamento em processamento">
            Pagamentos por Pix podem levar alguns minutos. O álbum segue para impressão assim que for confirmado.
          </Aviso>
        ) : (
          <Aviso tipo="pendente" titulo="Pagamento recebido">
            Estamos confirmando com o banco. Em instantes o álbum segue para impressão.
          </Aviso>
        )
      ) : null}

      {fechamento === 'cancelado' ? (
        <Aviso tipo="erro" titulo="Fechamento não pago">
          Nada foi cobrado. O álbum só segue para impressão depois do pagamento.
        </Aviso>
      ) : null}

      {pagamento === 'cancelado' ? (
        <Aviso tipo="erro" titulo="Pagamento não concluído">
          Nada foi cobrado. Você pode tentar de novo quando quiser.
        </Aviso>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus álbuns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} no total.
          </p>
        </div>
        <Button asChild variant="brand" className="h-11">
          <Link href="/dashboard/novo-pedido">Enviar novo álbum</Link>
        </Button>
      </header>

      <CobrancasLaminasExtras cobrancas={cobrancas} pagamentoSimulado={pagamentoSimulado} />

      {aguardandoPagamento.length > 0 ? (
        <section aria-labelledby="aguardando-pagamento" className="space-y-3">
          <h2 id="aguardando-pagamento" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Aguardando pagamento
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {aguardandoPagamento.map((order) => (
              <article key={order.id} className="rounded-2xl border-2 border-[#171717] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Pedido #{order.numero}</p>
                    <p className="truncate font-semibold">{order.nome_projeto}</p>
                    <p className="text-sm text-muted-foreground">Plano {order.planos?.nome_plano}</p>
                  </div>
                  <p className="shrink-0 text-xl font-bold tracking-tight">{formatBRL(Number(order.planos?.preco ?? 0))}</p>
                </div>
                <PayOrderButton pedidoId={order.id} className="mt-4" />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nenhum pedido por aqui ainda.
        </p>
      ) : (
        <>
          {/* Celular: cards — a tabela escondia Status e Ação fora da tela. */}
          <ul className="space-y-3 sm:hidden">
            {linhas.map(({ order, album, prazo, capa, destino }) => (
              <li key={order.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-start gap-3">
                  <AlbumThumb src={capa} nome={order.nome_projeto} destino={destino} className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Pedido #{order.numero}</p>
                      <Badge variant={album.variante} className="shrink-0">
                        {album.rotulo}
                      </Badge>
                    </div>
                    <p className="mt-0.5 break-words font-semibold leading-snug">
                      <AlbumNome nome={order.nome_projeto} destino={destino} />
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Enviado em</dt>
                    <dd>{formatDate(order.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Prazo</dt>
                    <dd>{prazo ? formatDate(prazo) : '—'}</dd>
                  </div>
                </dl>
                <AcaoDoAlbum order={order} album={album} aguardandoPagamento={aguardandoPagamento.includes(order)} bloco />
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Pedido</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Enviado em</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Prazo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map(({ order, album, prazo, capa, destino }) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AlbumThumb src={capa} nome={order.nome_projeto} destino={destino} className="h-12 w-12" />
                        <span className="min-w-0 break-words">
                          <span className="font-medium">#{order.numero}</span> ·{' '}
                          <AlbumNome nome={order.nome_projeto} destino={destino} />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{prazo ? formatDate(prazo) : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={album.variante}>{album.rotulo}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AcaoDoAlbum order={order} album={album} aguardandoPagamento={aguardandoPagamento.includes(order)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/** A próxima ação de cada álbum — a mesma no card (celular) e na tabela. */
function AcaoDoAlbum({
  order,
  album,
  aguardandoPagamento,
  bloco = false,
}: {
  order: PedidoDoFotografo
  album: StatusAlbum
  aguardandoPagamento: boolean
  /** Card do celular: botão de largura total e 48px, ou nada. */
  bloco?: boolean
}) {
  const classeBotao = bloco ? 'mt-4 h-12 w-full text-base' : undefined

  if (album.grupo === 'finalizado' && order.link_entrega_final) {
    return (
      <Button asChild size="sm" variant="outline" className={classeBotao}>
        <a href={order.link_entrega_final} target="_blank" rel="noopener noreferrer">
          Baixar
        </a>
      </Button>
    )
  }
  if (album.temProva && order.projetos) {
    return (
      <Button asChild size="sm" variant={album.aguardaDecisao ? 'brand' : 'outline'} className={classeBotao}>
        <Link href={`/dashboard/albuns/${order.projetos.id}/prova`}>
          {album.aguardaDecisao ? 'Revisar prova' : 'Ver prova'}
        </Link>
      </Button>
    )
  }
  // O card de pagamento já aparece no topo; no card do celular não repete.
  if (aguardandoPagamento) {
    return bloco ? null : <span className="text-xs font-medium text-[#171717]">Aguardando pagamento</span>
  }
  return bloco ? null : <span className="text-xs text-muted-foreground">—</span>
}

function Aviso({
  tipo,
  titulo,
  children,
}: {
  tipo: 'sucesso' | 'pendente' | 'erro'
  titulo: string
  children: React.ReactNode
}) {
  const estilo = {
    sucesso: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    pendente: 'border-amber-200 bg-amber-50 text-amber-900',
    erro: 'border-[#EAEAEA] bg-[#FAFAFA] text-[#444444]',
  }[tipo]
  const Icone = { sucesso: CheckCircle2, pendente: Clock, erro: AlertCircle }[tipo]

  return (
    <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${estilo}`}>
      <Icone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{titulo}</p>
        <p className="mt-0.5 opacity-90">{children}</p>
      </div>
    </div>
  )
}
