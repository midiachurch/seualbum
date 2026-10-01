'use client'

import { ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WizardFooterProps {
  mostrarVoltar: boolean
  ultimoPasso: boolean
  podeAvancar: boolean
  enviando?: boolean
  onVoltar: () => void
  onAvancar: () => void
}

/**
 * Navegação fixa na base da tela — fica na "thumb zone" do celular e acima do
 * indicador de home do iOS (`safe-area-inset-bottom`, precisa do
 * `viewportFit: 'cover'` declarado na página).
 */
export function WizardFooter({
  mostrarVoltar,
  ultimoPasso,
  podeAvancar,
  enviando = false,
  onVoltar,
  onAvancar,
}: WizardFooterProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#EAEAEA] bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex max-w-xl gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        {mostrarVoltar ? (
          <Button
            type="button"
            variant="brandOutline"
            onClick={onVoltar}
            disabled={enviando}
            className="h-12 min-w-[44px] shrink-0 px-4 text-base"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
            Voltar
          </Button>
        ) : null}

        <Button
          type="button"
          variant="brand"
          onClick={onAvancar}
          disabled={!podeAvancar || enviando}
          aria-busy={enviando || undefined}
          className={cn('h-12 flex-1 text-base', ultimoPasso && 'shadow-lg shadow-black/10')}
        >
          {ultimoPasso ? (
            enviando ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Enviando…
              </>
            ) : (
              <>
                Finalizar e enviar
                <Send className="h-5 w-5" aria-hidden />
              </>
            )
          ) : (
            <>
              Avançar
              <ChevronRight className="h-5 w-5" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
