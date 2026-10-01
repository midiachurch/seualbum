'use client'

import { Check } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { planHighlights } from '@/lib/pricing'
import { cn, formatBRL } from '@/lib/utils'
import { usePedidoWizardStore } from '@/store/usePedidoWizardStore'
import type { Plan } from '@/types/database'

/** Cards empilhados: preço e 3 destaques — dá pra decidir sem rolar o card. */
export function StepPlano({ plans, assinaturaId }: { plans: Plan[]; assinaturaId: string | null }) {
  const planoSelecionado = usePedidoWizardStore((s) => s.planoSelecionado)
  const selecionarPlano = usePedidoWizardStore((s) => s.selecionarPlano)

  if (plans.length === 0) {
    return (
      <EmptyState
        title="Nenhum plano disponível"
        description="O catálogo está vazio no momento. Fale com a equipe para liberar um plano."
      />
    )
  }

  return (
    <div role="radiogroup" aria-label="Plano" className="space-y-3">
      {plans.map((plan) => {
        const selecionado = plan.id === planoSelecionado
        const doAssinante = plan.id === assinaturaId
        return (
          <button
            key={plan.id}
            type="button"
            role="radio"
            aria-checked={selecionado}
            onClick={() => selecionarPlano(plan.id)}
            className={cn(
              'relative w-full rounded-2xl border-2 bg-white p-5 text-left transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2',
              'active:scale-[0.99]',
              selecionado
                ? 'border-[#171717] shadow-md'
                : 'border-[#EAEAEA] hover:border-[#BDBDBD]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-[#171717]">{plan.nome_plano}</span>
                  {doAssinante ? (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                      Seu plano
                    </span>
                  ) : plan.destaque ? (
                    <span className="rounded-full bg-[#171717] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                      Mais escolhido
                    </span>
                  ) : null}
                </div>
                {doAssinante ? (
                  // Já pago na mensalidade: o pedido vai direto para a fila de design.
                  <p className="mt-1 text-lg font-bold tracking-tight text-emerald-700">Incluso na sua assinatura</p>
                ) : (
                  <p className="mt-1 text-2xl font-bold tracking-tight text-[#171717]">
                    {formatBRL(plan.preco)}
                    <span className="ml-1 text-sm font-medium text-[#595959]">
                      {plan.tipo_cobranca === 'assinatura' ? '/mês' : '/álbum'}
                    </span>
                  </p>
                )}
              </div>

              <span
                aria-hidden
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  selecionado ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#D4D4D4]',
                )}
              >
                {selecionado ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </span>
            </div>

            <ul className="mt-4 space-y-1.5">
              {planHighlights(plan)
                .slice(0, 3)
                .map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#444444]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#171717]" aria-hidden />
                    {item}
                  </li>
                ))}
            </ul>
          </button>
        )
      })}
    </div>
  )
}
