'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Gift, Layers, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { dispensarCobranca } from '@/lib/actions/faturamento'
import { cn, formatBRL, formatDate } from '@/lib/utils'
import type { Fatura, ProjectStatus, ResumoExcedente } from '@/types/platform'

const STATUS_FATURA: Record<Fatura['statusPagamento'], { rotulo: string; classe: string }> = {
  pendente: { rotulo: 'Aguardando pagamento do estúdio', classe: 'bg-amber-100 text-amber-900' },
  pago: { rotulo: 'Paga', classe: 'bg-emerald-100 text-emerald-900' },
  dispensada: { rotulo: 'Dispensada (cortesia)', classe: 'bg-sky-100 text-sky-900' },
  cancelado: { rotulo: 'Cancelada', classe: 'bg-[#F5F5F5] text-[#595959]' },
}

/**
 * Cobrança de lâminas extras no workspace do projeto (Fase 5). Mostra a
 * franquia congelada no pedido, a prévia da versão liberada e as faturas.
 * A gestão (admin/gestor) pode dispensar a cobrança em aberto — cortesia com
 * motivo, que libera o projeto para impressão sem passar pelo financeiro.
 */
export function CobrancaLaminasCard({
  projetoId,
  status,
  laminasInclusas,
  precoLaminaExtra,
  resumo,
  faturas,
  podeDispensar,
}: {
  projetoId: string
  status: ProjectStatus
  laminasInclusas: number | null
  precoLaminaExtra: number | null
  resumo: ResumoExcedente | null
  faturas: Fatura[]
  podeDispensar: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const pendente = faturas.find((f) => f.statusPagamento === 'pendente') ?? null
  const historico = faturas.filter((f) => f !== pendente)
  // Cortesia não vale para adicional que o estúdio ainda não aceitou (0026).
  const aguardandoEstudio = (pendente?.detalhes ?? []).some((i) => i.situacao === 'aguardando_estudio')

  async function dispensar() {
    if (!pendente) return
    setEnviando(true)
    setErro(null)
    const r = await dispensarCobranca(pendente.id, projetoId, motivo)
    setEnviando(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    setAberto(false)
    setMotivo('')
    router.refresh()
  }

  return (
    <section
      aria-labelledby="cobranca-laminas"
      className={cn('rounded-2xl border bg-card p-4', status === 'aprovado_aguardando_pagamento' && 'border-2 border-amber-300')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="cobranca-laminas" className="flex items-center gap-2 text-base font-semibold">
            <Receipt className="h-4 w-4" aria-hidden />
            Fechamento e cobrança
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {laminasInclusas === null
              ? 'Sem franquia definida — este projeto não gera cobrança de lâminas extras.'
              : `Plano cobre ${laminasInclusas} lâminas (capa não conta) · extra ${formatBRL(precoLaminaExtra ?? 0)} cada · valor congelado no pedido.`}
          </p>
        </div>
        {resumo && laminasInclusas !== null ? (
          <p
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
              resumo.excedente > 0 ? 'bg-amber-100 text-amber-900' : 'bg-[#F5F5F5] text-[#444444]',
            )}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden />
            V{resumo.versao}: {resumo.laminas} lâminas{resumo.temCapa ? ' + capa' : ''}
            {resumo.excedente > 0 ? ` · ${resumo.excedente} extras (${formatBRL(resumo.valor)})` : ' · dentro do plano'}
          </p>
        ) : null}
      </div>

      {pendente ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3">
          <div className="min-w-0 flex-1 text-sm text-amber-950">
            <ul className="space-y-0.5">
              {(pendente.detalhes ?? [])
                .filter((i) => i.situacao !== 'removido')
                .map((i) => (
                  <li key={i.id} className="flex flex-wrap justify-between gap-x-3">
                    <span className="min-w-0 break-words">
                      {i.quantidade}× {i.descricao}
                      {i.origem === 'cliente' ? (
                        <span className="text-xs">
                          {' '}
                          · pedido do cliente{i.situacao === 'aguardando_estudio' ? ' — aguardando o estúdio' : ' — aceito'}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums">{formatBRL(i.valorTotal)}</span>
                  </li>
                ))}
            </ul>
            <p className="mt-1 font-semibold">Total: {formatBRL(pendente.valorTotal)}</p>
            <p className="text-xs">
              Aprovado em {formatDate(pendente.criadaEm)} ·{' '}
              {aguardandoEstudio
                ? 'o estúdio precisa aceitar ou recusar os pedidos do cliente antes do fechamento.'
                : 'aguardando o pagamento do estúdio para seguir à gráfica.'}
            </p>
          </div>
          {podeDispensar && !aguardandoEstudio ? (
            <Button
              variant="outline"
              className="min-h-[44px] border-amber-300 bg-white"
              onClick={() => {
                setErro(null)
                setAberto(true)
              }}
            >
              <Gift className="h-4 w-4" aria-hidden />
              Dispensar cobrança (cortesia)
            </Button>
          ) : null}
        </div>
      ) : null}

      {historico.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {historico.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
              <span className="min-w-0 break-words">
                {f.itens[0]?.descricao ?? 'Fatura'} · {f.itens[0]?.quantidade ?? 0} × {formatBRL(f.itens[0]?.valorUnitario ?? 0)} ={' '}
                <strong>{formatBRL(f.valorTotal)}</strong>
                {f.dispensadaMotivo ? <span className="text-muted-foreground"> — &quot;{f.dispensadaMotivo}&quot;</span> : null}
              </span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_FATURA[f.statusPagamento].classe)}>
                {STATUS_FATURA[f.statusPagamento].rotulo}
                {f.pagaEm ? ` · ${formatDate(f.pagaEm)}` : f.dispensadaEm ? ` · ${formatDate(f.dispensadaEm)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <Modal open={aberto} onClose={() => setAberto(false)} title="Dispensar cobrança (cortesia)">
        {pendente ? (
          <div className="space-y-4">
            <p className="text-sm text-[#595959]">
              O estúdio não vai pagar este fechamento ({formatBRL(pendente.valorTotal)}) e o projeto segue direto para <strong className="text-[#171717]">Aprovado para impressão</strong>. Fica registrado no
              histórico com o seu nome e o motivo.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-cortesia">Motivo</Label>
              <textarea
                id="motivo-cortesia"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ex.: cliente parceiro, compensação por atraso…"
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {erro ? (
              <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {erro}
              </p>
            ) : null}
            <div className={MODAL_ACOES}>
              <Button variant="outline" onClick={() => setAberto(false)} disabled={enviando}>
                Cancelar
              </Button>
              <Button variant="brand" onClick={dispensar} disabled={enviando || motivo.trim().length < 3}>
                {enviando ? 'Liberando…' : 'Dispensar e liberar para impressão'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
