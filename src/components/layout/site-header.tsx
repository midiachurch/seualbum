'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/albuns', label: 'Álbuns' },
  { href: '/servicos', label: 'Serviços' },
  { href: '/portfolio', label: 'Portfólio' },
  { href: '/como-funciona', label: 'Como funciona' },
  { href: '/precos', label: 'Preços' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="font-marketing sticky top-0 z-50 w-full border-b border-[#EAEAEA] bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
            <img src="/brand/logo-dark.png" alt="Seu Álbum" className="h-10 w-auto" />
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[#595959] transition-colors hover:text-[#444444]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-[#595959] transition-colors hover:text-[#444444]"
            >
              Área do cliente
            </Link>
            <Button
              asChild
              size="sm"
              className="btn-marketing border-2 border-[#444444]/40 bg-transparent text-[#444444] hover:border-[#444444] hover:bg-transparent"
            >
              <Link href="/criar-album">Criar meu álbum</Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-[#444444] hover:bg-[#F5F5F5] md:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Fora do <header> de propósito: backdrop-blur ali cria containing block
          para position:fixed, o que zerava a altura deste painel. */}
      <div
        id="menu-mobile"
        className={cn(
          'font-marketing fixed inset-x-0 top-16 bottom-0 z-40 bg-white md:hidden',
          open ? 'animate-page-in block' : 'hidden',
        )}
      >
        <nav
          aria-label="Principal (mobile)"
          className="container flex h-full flex-col justify-between py-10"
        >
          <ul className="flex flex-col gap-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-display-l block py-2 text-[#444444]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-4">
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-[#595959]"
            >
              Área do cliente
            </Link>
            <Button
              asChild
              size="lg"
              className="btn-marketing border-2 border-[#444444]/40 bg-transparent text-[#444444] hover:border-[#444444] hover:bg-transparent"
            >
              <Link href="/criar-album" onClick={() => setOpen(false)}>
                Criar meu álbum
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </>
  )
}
