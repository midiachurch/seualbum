'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LogOut, MessageCircle, MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SeloNaoLidas } from '@/components/mensagens/selo-nao-lidas'

export function ClientBottomNav({ whatsapp }: { whatsapp: string }) {
  const pathname = usePathname()
  const isHome = pathname === '/cliente'

  const waNumber = whatsapp.replace(/\D/g, '')

  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#EAEAEA] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        <Link
          href="/cliente"
          className={cn(
            'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium',
            isHome ? 'text-[#171717]' : 'text-[#6B6B6B]',
          )}
        >
          <Home className="h-5 w-5" aria-hidden />
          Início
        </Link>
        <Link
          href="/cliente/mensagens"
          className={cn(
            'relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium',
            pathname.startsWith('/cliente/mensagens') ? 'text-[#171717]' : 'text-[#6B6B6B]',
          )}
        >
          <span className="relative">
            <MessagesSquare className="h-5 w-5" aria-hidden />
            <SeloNaoLidas className="absolute -right-3 -top-2" />
          </span>
          Mensagens
        </Link>
        <a
          href={`https://wa.me/55${waNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-[#6B6B6B]"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          Suporte
        </a>
        <form action="/auth/signout" method="post" className="flex flex-1">
          <button
            type="submit"
            className="flex min-h-[56px] w-full flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-[#6B6B6B]"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            Sair
          </button>
        </form>
      </div>
    </nav>
  )
}
