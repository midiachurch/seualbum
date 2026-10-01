'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VisualOption } from '@/types/platform'

/** Cards visuais para escolha de produto (seção 13) — imagens de referência no lugar de <select>. */
export function VisualOptionCards<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: VisualOption<T>[]
  value: T | null
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'group overflow-hidden rounded-2xl border-2 text-left transition-colors',
              active ? 'border-foreground' : 'border-transparent hover:border-border',
            )}
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
              <img
                src={option.image}
                alt={option.label}
                className="h-full w-full object-cover grayscale transition-transform duration-300 group-hover:scale-105"
              />
              {active ? (
                <span className="absolute right-2 top-2 rounded-full bg-foreground p-1 text-background">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
              ) : null}
            </div>
            <div className="p-3">
              <p className="font-medium">{option.label}</p>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
