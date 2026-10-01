'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard', label: 'Visão geral' },
  { href: '/dashboard/novo-pedido', label: 'Novo pedido' },
  { href: '/dashboard/meus-albuns', label: 'Meus álbuns' },
  { href: '/dashboard/orcamentos', label: 'Meus orçamentos' },
  { href: '/dashboard/catalogo', label: 'Catálogo' },
]

function ativo(pathname: string, href: string) {
  // "Visão geral" só na raiz; as demais valem para as subpáginas (ex.: a prova
  // /dashboard/albuns/… fica sob "Meus álbuns").
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/dashboard/meus-albuns') return pathname.startsWith(href) || pathname.startsWith('/dashboard/albuns')
  return pathname.startsWith(href)
}

/** Links inline no cabeçalho (desktop). */
export function DashboardNavDesktop() {
  const pathname = usePathname()
  return (
    <nav aria-label="Painel" className="hidden items-center gap-6 sm:flex">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={ativo(pathname, item.href) ? 'page' : undefined}
          className={cn(
            'text-sm font-medium transition-colors hover:text-[#171717]',
            ativo(pathname, item.href) ? 'text-[#171717]' : 'text-[#595959]',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

/**
 * Faixa rolável abaixo do cabeçalho (celular). Antes do `sm` a navegação não
 * existia: o fotógrafo só chegava a "Meus álbuns" pelos botões das páginas.
 */
export function DashboardNavMobile() {
  const pathname = usePathname()
  return (
    <nav aria-label="Painel" className="border-t border-[#EAEAEA] sm:hidden">
      <ul className="flex gap-1 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={ativo(pathname, item.href) ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-medium transition-colors',
                ativo(pathname, item.href) ? 'bg-[#171717] text-white' : 'text-[#595959] hover:bg-[#F5F5F5]',
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
