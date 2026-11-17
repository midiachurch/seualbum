'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Images, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
const items = [
  { href: '/dashboard/galerias', label: 'Galerias', icon: Images },
  { href: '/dashboard/conta', label: 'Minha conta', icon: UserRound },
]
function Navigation({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname()
  return (
    <nav
      aria-label={mobile ? 'Painel no celular' : 'Painel'}
      className={mobile ? 'border-t bg-white sm:hidden' : 'hidden sm:block'}
    >
      <ul className={cn('flex gap-2', mobile && 'px-4 py-2')}>
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={path.startsWith(href) ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors',
                path.startsWith(href) ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <Icon size={17} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
export function DashboardNavDesktop() {
  return <Navigation />
}
export function DashboardNavMobile() {
  return <Navigation mobile />
}
