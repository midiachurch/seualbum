import { Check, Minus } from 'lucide-react'
import { formatBRL } from '@/lib/utils'
import { COMPARISON_GROUPS } from '@/lib/pricing'
import type { Plan } from '@/types/database'

interface FeatureComparisonProps {
  /** Planos do ciclo selecionado, já ordenados. */
  plans: Plan[]
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <>
        <Check className="mx-auto h-4 w-4 text-[#444444]" aria-hidden />
        <span className="sr-only">Incluído</span>
      </>
    )
  }
  if (value === false) {
    return (
      <>
        <Minus className="mx-auto h-4 w-4 text-[#595959]/40" aria-hidden />
        <span className="sr-only">Não incluído</span>
      </>
    )
  }
  return <span className="text-sm text-[#595959]">{value}</span>
}

export function FeatureComparison({ plans }: FeatureComparisonProps) {
  if (plans.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <caption className="sr-only">Comparativo de recursos entre os planos</caption>

        {/* O cabeçalho gruda no topo para o usuário não perder a coluna ao rolar. */}
        <thead className="sticky top-0 z-10 bg-[#FFFFFF]">
          <tr className="border-b border-[#EAEAEA]">
            <th scope="col" className="w-[34%] py-5 pr-4 align-bottom text-sm font-semibold text-[#444444]">
              Compare os recursos
            </th>
            {plans.map((plan) => (
              <th key={plan.id} scope="col" className="py-5 text-center align-bottom">
                <span className="block text-lg font-bold text-[#444444]">
                  {plan.nome_plano}
                </span>
                <span className="block text-sm font-normal text-[#595959]">
                  {formatBRL(plan.preco)}
                  {plan.tipo_cobranca === 'assinatura' ? '/mês' : '/álbum'}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {COMPARISON_GROUPS.map((grupo) => (
          <tbody key={grupo.titulo}>
            <tr>
              <th
                scope="colgroup"
                colSpan={plans.length + 1}
                className="text-overline border-b border-[#EAEAEA] py-3 text-[#595959]"
              >
                {grupo.titulo}
              </th>
            </tr>

            {grupo.linhas.map((linha) => (
              <tr key={linha.label} className="border-b border-[#EAEAEA] last:border-b-0">
                <th scope="row" className="py-4 pr-4 text-sm font-normal">
                  <span className="font-medium text-[#444444]">{linha.label}</span>
                  {linha.hint ? (
                    <span className="mt-0.5 block text-xs text-[#595959]">{linha.hint}</span>
                  ) : null}
                </th>
                {plans.map((plan) => (
                  <td key={plan.id} className="py-4 text-center">
                    <Cell value={linha.render(plan)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
