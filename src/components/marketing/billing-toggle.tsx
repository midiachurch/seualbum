'use client'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { BillingCycle } from '@/lib/pricing'

interface BillingToggleProps {
  value: BillingCycle
  onChange: (value: BillingCycle) => void
  /** Selo ao lado da opção de assinatura (ex.: "economize 24%"). */
  economiaLabel?: string
}

export function BillingToggle({ value, onChange, economiaLabel }: BillingToggleProps) {
  const isAssinatura = value === 'assinatura'

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onChange('avulso')}
        aria-pressed={!isAssinatura}
        className={cn(
          'rounded-md px-1 text-sm font-medium transition-colors',
          isAssinatura ? 'text-[#595959]' : 'text-[#444444]',
        )}
      >
        Avulso
      </button>

      <Switch
        checked={isAssinatura}
        onCheckedChange={(checked) => onChange(checked ? 'assinatura' : 'avulso')}
        aria-label="Alternar entre pagamento avulso e assinatura mensal"
        className="data-[state=checked]:bg-[#171717] data-[state=unchecked]:bg-[#EAEAEA]"
      />

      <button
        type="button"
        onClick={() => onChange('assinatura')}
        aria-pressed={isAssinatura}
        className={cn(
          'rounded-md px-1 text-sm font-medium transition-colors',
          isAssinatura ? 'text-[#444444]' : 'text-[#595959]',
        )}
      >
        Assinatura mensal
      </button>

      {economiaLabel ? (
        <span className="text-xs font-medium uppercase tracking-wide text-[#444444]">
          {economiaLabel}
        </span>
      ) : null}
    </div>
  )
}
