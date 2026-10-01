'use client'

import { useId } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePedidoWizardStore } from '@/store/usePedidoWizardStore'

export const ESTILOS_DESIGN = ['Clássico', 'Moderno', 'Editorial', 'Minimalista', 'Fine art'] as const

export function StepBriefing() {
  const briefing = usePedidoWizardStore((s) => s.briefing)
  const atualizar = usePedidoWizardStore((s) => s.atualizarBriefing)
  const observacoesId = useId()

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold text-[#171717]">Estilo do álbum</legend>
        <div role="radiogroup" aria-label="Estilo do álbum" className="mt-3 flex flex-wrap gap-2">
          {ESTILOS_DESIGN.map((estilo) => {
            const ativo = briefing.estilo === estilo
            return (
              <button
                key={estilo}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => atualizar({ estilo })}
                className={cn(
                  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2',
                  ativo
                    ? 'border-[#171717] bg-[#171717] text-white'
                    : 'border-[#EAEAEA] bg-white text-[#444444] hover:border-[#BDBDBD]',
                )}
              >
                {ativo ? <Check className="h-4 w-4" aria-hidden /> : null}
                {estilo}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor={observacoesId} className="text-sm font-semibold text-[#171717]">
          Observações <span className="font-normal text-[#6B6B6B]">(opcional)</span>
        </label>
        <textarea
          id={observacoesId}
          rows={6}
          value={briefing.observacoes}
          onChange={(e) => atualizar({ observacoes: e.target.value })}
          placeholder="Fotos que não podem faltar, momentos favoritos, pessoas importantes, o que evitar…"
          className="block w-full resize-y rounded-xl border border-[#D4D4D4] bg-white px-3 py-3 text-base placeholder:text-[#AAAAAA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2"
        />
      </div>
    </div>
  )
}
