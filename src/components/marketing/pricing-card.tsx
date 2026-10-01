import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatBRL } from '@/lib/utils'
import { planHighlights } from '@/lib/pricing'
import type { Plan } from '@/types/database'

interface PricingCardProps {
  plan: Plan
  /** O plano "Plus" recebe preenchimento sólido, igual ao `.pricing-table.active` de referência. */
  destaque?: boolean
}

export function PricingCard({ plan, destaque = false }: PricingCardProps) {
  const isAssinatura = plan.tipo_cobranca === 'assinatura'
  const sufixo = isAssinatura ? '/mês' : '/álbum'

  return (
    <div
      className={cn(
        'flex flex-col items-center bg-white px-8 py-12 text-center',
        destaque && 'ring-2 ring-inset ring-[#171717]',
      )}
    >
      <p className="text-heading text-[#444444]">{plan.nome_plano}</p>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="font-[family-name:var(--font-poppins)] text-5xl font-light text-[#444444]">
          {formatBRL(plan.preco)}
        </span>
        <span className="text-caption text-[#595959]">{sufixo}</span>
      </div>

      <p className="text-body mt-4 text-[#595959]">{plan.descricao}</p>

      <ul className="mt-6 space-y-2 text-left">
        {planHighlights(plan)
          .slice(0, 3)
          .map((item) => (
            <li key={item} className="text-body flex items-start gap-2 text-[#595959]">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#444444]" aria-hidden />
              {item}
            </li>
          ))}
      </ul>

      <Button
        asChild
        size="lg"
        className={cn(
          'btn-marketing mt-8 w-full border-2',
          destaque
            ? 'border-[#171717] bg-[#171717] text-white hover:bg-[#2E2E2E]'
            : 'border-[#444444]/40 bg-transparent text-[#444444] hover:border-[#444444] hover:bg-transparent',
        )}
      >
        {/* Toda conversão entra pelo cadastro, levando o plano escolhido na query. */}
        <Link href={`/auth/register?plano=${plan.slug}`}>Começar agora</Link>
      </Button>
    </div>
  )
}
