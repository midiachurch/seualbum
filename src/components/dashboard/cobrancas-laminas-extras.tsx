'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, CreditCard, Gift, Layers, QrCode, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { pagarLaminasExtras } from '@/lib/actions/faturamento'
import { decidirAdicional } from '@/lib/actions/prova-fotografo'
import { cn, formatBRL, formatDate } from '@/lib/utils'
import type { CobrancaPendente } from '@/lib/supabase/queries'
import type { FaturaItem } from '@/types/platform'

/**
 * Fechamento pendente (Fases 5 e Upsell): a prova foi aprovada e travada; o
 * arquivo só segue para a gráfica depois que o estúdio fecha a fatura —
 * lâminas extras e/ou adicionais. Quem paga é o estúdio; o cliente final
 * nunca vê esta tela (white label).
 *
 * Adicional pedido pelo CASAL chega "aguardando o estúdio": o fotógrafo vê o
 * que cobrou do cliente, quanto paga e a margem, e aceita ou recusa. O
 * pagamento só libera quando nada estiver aguardando.
 *
 * Pagamento SIMULADO enquanto o Stripe estiver congelado.
 */
export function CobrancasLaminasExtras({ cobrancas }: { cobrancas: CobrancaPendente[] }) {
  const router = useRouter()
  const [pagando, setPagando] = useState<CobrancaPendente | null>(null)
  const [forma, setForma] = useState<'cartao' | 'pix'>('pix')
  const [enviando, setEnviando] = useState(false)
  const [decidindo, setDecidindo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  if (cobrancas.length === 0 && !aviso) return null

  async function confirmar() {
    if (!pagando) return
    setEnviando(true)
    setErro(null)
    const r = await pagarLaminasExtras(pagando.id, forma)
    setEnviando(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    setAviso(`Pagamento confirmado: "${pagando.projetoNome}" foi liberado para impressão e entrou na fila da gráfica.`)
    setPagando(null)
    router.refresh()
  }

  async function decidir(c: CobrancaPendente, item: FaturaItem, aceitar: boolean) {
    setDecidindo(item.id)
    setErro(null)
    const r = await decidirAdicional(item.id, aceitar)
    setDecidindo(null)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    if (r.liberado) setAviso(`Sem cobrança: "${c.projetoNome}" foi liberado para impressão.`)
    router.refresh()
  }

  return (
    <section id="laminas-extras" aria-labelledby="laminas-extras-titulo" className="scroll-mt-24 space-y-3">
      <h2 id="laminas-extras-titulo" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Fechamento pendente
      </h2>

      {aviso ? (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{aviso}</span>
        </p>
      ) : null}
      {erro && !pagando ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {cobrancas.map((c) => {
          const itens = (c.detalhes ?? []).filter((i) => i.situacao !== 'removido')
          const aguardando = itens.filter((i) => i.situacao === 'aguardando_estudio')
          return (
            <article key={c.id} className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Projeto #{c.projetoNumero} · aprovado em {formatDate(c.criadaEm)}
                  </p>
                  <p className="break-words font-semibold">{c.projetoNome}</p>
                </div>
                <p className="shrink-0 text-xl font-bold tracking-tight">{formatBRL(c.valorTotal)}</p>
              </div>

              <ul className="mt-3 space-y-2">
                {itens.map((item) => {
                  const pedidoCliente = item.origem === 'cliente'
                  const margem =
                    item.precoRevendaUnitario !== null ? (item.precoRevendaUnitario - item.valorUnitario) * item.quantidade : null
                  return (
                    <li key={item.id} className="rounded-xl bg-white p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex min-w-0 items-start gap-1.5">
                          {item.tipo === 'adicional' ? (
                            <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          ) : (
                            <Layers className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          )}
                          <span className="break-words">
                            {item.quantidade}× {item.descricao}
                            {item.tipo !== 'adicional' && c.laminasVersao !== null ? (
                              <span className="block text-xs text-muted-foreground">
                                {c.laminasVersao} lâminas · plano cobre {c.laminasInclusas ?? '?'}
                              </span>
                            ) : null}
                          </span>
                        </p>
                        <span className="shrink-0 font-semibold tabular-nums">{formatBRL(item.valorTotal)}</span>
                      </div>

                      {pedidoCliente ? (
                        <div className="mt-2 space-y-2 border-t pt-2">
                          <p className="flex items-center gap-1.5 text-xs text-[#444444]">
                            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Pedido pelo seu cliente
                          </p>
                          {margem !== null ? (
                            <dl className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <dt className="text-muted-foreground">Você cobra</dt>
                                <dd className="font-semibold tabular-nums">
                                  {formatBRL((item.precoRevendaUnitario ?? 0) * item.quantidade)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Você paga</dt>
                                <dd className="font-semibold tabular-nums">{formatBRL(item.valorTotal)}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Sua margem</dt>
                                <dd className={cn('font-semibold tabular-nums', margem > 0 ? 'text-emerald-700' : 'text-[#444444]')}>
                                  {formatBRL(margem)}
                                </dd>
                              </div>
                            </dl>
                          ) : null}
                          {item.situacao === 'aguardando_estudio' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                variant="brand"
                                className="min-h-[44px]"
                                disabled={decidindo === item.id}
                                onClick={() => decidir(c, item, true)}
                              >
                                <Check className="h-4 w-4" aria-hidden />
                                Aceitar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-[44px]"
                                disabled={decidindo === item.id}
                                onClick={() => decidir(c, item, false)}
                              >
                                <X className="h-4 w-4" aria-hidden />
                                Recusar
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs font-medium text-emerald-700">Aceito por você</p>
                          )}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              {aguardando.length > 0 ? (
                <p className="mt-3 text-xs font-medium text-amber-900">
                  Decida {aguardando.length === 1 ? 'o pedido do cliente' : `os ${aguardando.length} pedidos do cliente`} para
                  liberar o pagamento.
                </p>
              ) : null}

              <Button
                variant="brand"
                className="mt-3 h-12 w-full whitespace-normal text-base"
                disabled={aguardando.length > 0}
                onClick={() => {
                  setErro(null)
                  setPagando(c)
                }}
              >
                Pagar {formatBRL(c.valorTotal)} e liberar para impressão
              </Button>
            </article>
          )
        })}
      </div>

      <Modal open={pagando !== null} onClose={() => setPagando(null)} title="Fechar e liberar para impressão">
        {pagando ? (
          <div className="space-y-4">
            <ul className="space-y-1 text-sm">
              {(pagando.detalhes ?? [])
                .filter((i) => i.situacao !== 'removido')
                .map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span className="min-w-0 break-words text-[#595959]">
                      {i.quantidade}× {i.descricao}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatBRL(i.valorTotal)}</span>
                  </li>
                ))}
            </ul>
            <p className="flex items-center justify-between gap-3 rounded-xl bg-[#F5F5F5] p-3 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatBRL(pagando.valorTotal)}</span>
            </p>

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Forma de pagamento</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { valor: 'pix', rotulo: 'Pix', Icone: QrCode },
                    { valor: 'cartao', rotulo: 'Cartão', Icone: CreditCard },
                  ] as const
                ).map(({ valor, rotulo, Icone }) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={forma === valor}
                    onClick={() => setForma(valor)}
                    className={cn(
                      'flex min-h-[44px] items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors',
                      forma === valor ? 'border-[#171717] bg-[#171717] text-white' : 'border-input text-foreground',
                    )}
                  >
                    <Icone className="h-4 w-4" aria-hidden />
                    {rotulo}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="text-xs text-muted-foreground">
              Pagamento simulado — o processador real (Stripe) será ligado nesta mesma tela.
            </p>

            {erro ? (
              <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {erro}
              </p>
            ) : null}

            <div className={MODAL_ACOES}>
              <Button variant="outline" onClick={() => setPagando(null)} disabled={enviando}>
                Cancelar
              </Button>
              <Button variant="brand" onClick={confirmar} disabled={enviando}>
                <Check className="h-4 w-4" aria-hidden />
                {enviando ? 'Confirmando…' : `Pagar ${formatBRL(pagando.valorTotal)}`}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
