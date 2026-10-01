'use client'

import { useRef, useState } from 'react'
import { AlertCircle, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { iniciarPagamentoAction } from '@/lib/actions/pagamentos'
import { cn } from '@/lib/utils'

export function PayOrderButton({ pedidoId, className }: { pedidoId: string; className?: string }) {
  const [abrindo, setAbrindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const abrindoRef = useRef(false)

  async function pagar() {
    if (abrindoRef.current) return
    abrindoRef.current = true
    setAbrindo(true)
    setErro(null)

    try {
      const result = await iniciarPagamentoAction(pedidoId)
      if (result.ok) {
        // Página do Stripe: fica "Abrindo…" até o navegador sair daqui.
        window.location.assign(result.url)
        return
      }
      setErro(result.erro)
    } catch {
      setErro('Sem conexão com o servidor. Tente de novo.')
    }
    abrindoRef.current = false
    setAbrindo(false)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        type="button"
        variant="brand"
        onClick={pagar}
        disabled={abrindo}
        aria-busy={abrindo || undefined}
        className="h-12 w-full text-base"
      >
        {abrindo ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Abrindo pagamento…
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" aria-hidden />
            Pagar e liberar produção
          </>
        )}
      </Button>
      {erro ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : null}
    </div>
  )
}
