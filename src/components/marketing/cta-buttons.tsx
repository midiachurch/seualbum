import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface CtaAction {
  href: string
  label: string
  /** Só a ação principal ganha preenchimento sólido; as demais ficam em contorno. */
  variant?: 'primary' | 'secondary'
}

interface CtaButtonsProps {
  actions: CtaAction[]
  /** `dark` inverte as cores para fundos #171717 (ver `CtaBand`). */
  tone?: 'light' | 'dark'
  align?: 'start' | 'center'
  className?: string
}

const ESTILOS = {
  light: {
    primary: 'border-[#171717] bg-[#171717] text-white hover:bg-[#2E2E2E]',
    secondary: 'border-[#444444]/40 bg-transparent text-[#444444] hover:border-[#444444] hover:bg-transparent',
  },
  dark: {
    primary: 'border-white bg-white text-[#171717] hover:bg-[#EAEAEA]',
    secondary: 'border-white/40 bg-transparent text-white hover:border-white hover:bg-transparent',
  },
} as const

/**
 * Par de CTAs no padrão do site-piloto (cantos retos, versalete). Altura `lg`
 * (48px) garante alvo de toque confortável no celular; no mobile os botões
 * ocupam a largura toda para não quebrarem em linhas desalinhadas.
 */
export function CtaButtons({ actions, tone = 'light', align = 'start', className }: CtaButtonsProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center',
        align === 'center' && 'sm:justify-center',
        className,
      )}
    >
      {actions.map((action) => {
        const variant = action.variant ?? 'primary'
        return (
          <Button
            key={action.href + action.label}
            asChild
            size="lg"
            className={cn('btn-marketing w-full border-2 sm:w-auto', ESTILOS[tone][variant])}
          >
            <Link href={action.href}>
              {action.label}
              {variant === 'primary' ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
            </Link>
          </Button>
        )
      })}
    </div>
  )
}
