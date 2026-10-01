'use client'

import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface WizardFieldProps extends Omit<React.ComponentProps<'input'>, 'id'> {
  label: string
  opcional?: boolean
  hint?: string
  erro?: string | null
}

/**
 * Input do wizard: 48px de altura (zona de toque) e `text-base` — abaixo de
 * 16px o Safari do iOS dá zoom na página ao focar o campo.
 */
export function WizardField({ label, opcional, hint, erro, className, ...props }: WizardFieldProps) {
  const id = useId()
  const descId = `${id}-desc`

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-[#171717]">
        {label}
        {opcional ? <span className="ml-1 font-normal text-[#6B6B6B]">(opcional)</span> : null}
      </Label>
      <Input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={hint || erro ? descId : undefined}
        className={cn(
          'h-12 rounded-xl border-[#D4D4D4] bg-white text-base',
          erro && 'border-destructive focus-visible:ring-destructive',
          className,
        )}
        {...props}
      />
      {erro ? (
        <p id={descId} className="text-sm text-destructive">
          {erro}
        </p>
      ) : hint ? (
        <p id={descId} className="text-sm text-[#595959]">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
