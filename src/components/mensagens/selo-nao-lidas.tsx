'use client'

import { useNaoLidas } from '@/components/mensagens/realtime'
import { cn } from '@/lib/utils'

/** Selo de mensagens não lidas para os menus (some quando é zero). */
export function SeloNaoLidas({ invertido = false, className }: { invertido?: boolean; className?: string }) {
  const { total } = useNaoLidas()
  if (total <= 0) return null
  return (
    <span
      aria-label={`${total} ${total === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`}
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none',
        invertido ? 'bg-white text-[#171717]' : 'bg-[#171717] text-white',
        className,
      )}
    >
      {total > 99 ? '99+' : total}
    </span>
  )
}
