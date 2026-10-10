'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { canAccess, PLATFORM_ROLE_LABEL, type ModuleKey, type PlatformRole } from '@/types/platform'
import { cn } from '@/lib/utils'
import { SeloNaoLidas } from '@/components/mensagens/selo-nao-lidas'

const NAV_ITEMS: { href: string; label: string; module: ModuleKey }[] = [
  { href: '/admin', label: 'Dashboard', module: 'dashboard' },
  { href: '/admin/mensagens', label: 'Mensagens', module: 'mensagens' },
  { href: '/admin/design', label: 'Fila de design', module: 'design' },
  { href: '/admin/albuns', label: 'Álbuns (editor)', module: 'design' },
  { href: '/admin/producao', label: 'Produção', module: 'projetos' },
  { href: '/admin/producao/grafica', label: 'Fila de expedição', module: 'projetos' },
  { href: '/admin/projetos', label: 'Projetos', module: 'projetos' },
  { href: '/admin/clientes', label: 'Clientes', module: 'clientes' },
  { href: '/admin/fotografos', label: 'Fotógrafos', module: 'fotografos' },
  { href: '/admin/pedidos', label: 'Esteira (pedidos)', module: 'projetos' },
  { href: '/admin/equipe', label: 'Equipe', module: 'equipe' },
  { href: '/admin/midia', label: 'Mídia', module: 'midia' },
  { href: '/admin/vitrine/banners', label: 'Banners', module: 'vitrine' },
  { href: '/admin/vitrine/portfolio', label: 'Portfólio', module: 'vitrine' },
  { href: '/admin/vitrine/paginas', label: 'Páginas do site', module: 'vitrine' },
  { href: '/admin/catalogo', label: 'Catálogo de álbuns', module: 'vitrine' },
  { href: '/admin/catalogo/adicionais', label: 'Adicionais (upsell)', module: 'vitrine' },
]

/**
 * Menu lateral do ambiente administrativo (seção 2/4 da especificação). Sem
 * `role` (schema real ainda só tem client/admin) mostra tudo — a
 * granularidade por papel só existe em modo de demonstração.
 */
export function AdminSidebar({ role }: { role: PlatformRole | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const items = NAV_ITEMS.filter((item) => !role || canAccess(role, item.module))

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-[#EAEAEA] px-4 py-3 text-sm font-medium text-[#444444] md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="admin-nav"
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
        Menu
      </button>

      <nav
        id="admin-nav"
        aria-label="Admin"
        className={cn(
          'border-b border-[#EAEAEA] bg-white md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] md:w-56 md:shrink-0 md:border-b-0 md:border-r',
          open ? 'block' : 'hidden',
        )}
      >
        <ul className="space-y-1 p-3">
          {items.map((item) => {
            // /admin/producao não acende junto com /admin/producao/grafica.
            const maisEspecifico = items.some((o) => o.href !== item.href && o.href.startsWith(item.href) && pathname.startsWith(o.href))
            const active = item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href) && !maisEspecifico
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#171717] text-white'
                      : 'text-[#595959] hover:bg-[#F5F5F5] hover:text-[#171717]',
                  )}
                >
                  {item.label}
                  {item.href === '/admin/mensagens' ? <SeloNaoLidas invertido={active} className="ml-2" /> : null}
                </Link>
              </li>
            )
          })}
        </ul>
        {role ? (
          <p className="px-6 pb-4 text-xs text-[#AAAAAA]">
            Visualizando como {PLATFORM_ROLE_LABEL[role]}
          </p>
        ) : null}
      </nav>
    </>
  )
}
