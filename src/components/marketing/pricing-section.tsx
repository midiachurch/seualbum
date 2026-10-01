'use client'

import { useMemo, useState } from 'react'
import { BillingToggle } from '@/components/marketing/billing-toggle'
import { PricingCard } from '@/components/marketing/pricing-card'
import { PLAN_FAMILY_ORDER, planFamily, type BillingCycle } from '@/lib/pricing'
import type { Plan } from '@/types/database'

interface PricingSectionProps {
  /** Catálogo completo, com os dois ciclos. O filtro acontece no cliente. */
  plans: Plan[]
  defaultCycle?: BillingCycle
}

/**
 * Dono do estado do toggle. Cards e tabela comparativa são filhos controlados,
 * então trocar o ciclo atualiza preço, prazo e comparativo de uma vez só.
 */
export function PricingSection({ plans, defaultCycle = 'avulso' }: PricingSectionProps) {
  const [cycle, setCycle] = useState<BillingCycle>(defaultCycle)

  const visiblePlans = useMemo(
    () =>
      plans
        .filter((p) => p.tipo_cobranca === cycle)
        .sort(
          (a, b) =>
            a.ordem - b.ordem ||
            PLAN_FAMILY_ORDER.indexOf(planFamily(a)) - PLAN_FAMILY_ORDER.indexOf(planFamily(b)),
        ),
    [plans, cycle],
  )

  // Economia real do plano em destaque: preço por álbum na assinatura vs avulso.
  const economiaLabel = useMemo(() => {
    const avulso = plans.find((p) => p.tipo_cobranca === 'avulso' && p.destaque)
    const mensal = plans.find((p) => p.tipo_cobranca === 'assinatura' && p.destaque)
    if (!avulso || !mensal?.albuns_inclusos) return undefined

    const porAlbum = mensal.preco / mensal.albuns_inclusos
    const desconto = Math.round((1 - porAlbum / avulso.preco) * 100)
    return desconto > 0 ? `economize até ${desconto}%` : undefined
  }, [plans])

  return (
    <section id="planos" className="font-marketing bg-[#F5F5F5] py-24 sm:py-28">
      <div className="container">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-overline text-[#595959]">Planos</p>
          <h2 className="text-display-l mt-4 text-[#444444]">
            Escolha como quer trabalhar com a gente
          </h2>
          <p className="text-body mt-4 text-[#595959]">
            Pague por álbum quando a demanda for pontual, ou assine e reduza o custo por entrega.
            Sem taxa de setup e sem fidelidade.
          </p>
        </header>

        <div className="mt-10 flex justify-center">
          <BillingToggle value={cycle} onChange={setCycle} economiaLabel={economiaLabel} />
        </div>

        {visiblePlans.length > 0 ? (
          <div className="mx-auto mt-16 grid max-w-5xl gap-px overflow-hidden bg-[#EAEAEA] sm:grid-cols-3">
            {visiblePlans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} destaque={plan.destaque} />
            ))}
          </div>
        ) : (
          <p className="text-body mt-12 text-center text-[#595959]">Nenhum plano disponível no momento.</p>
        )}
      </div>
    </section>
  )
}
