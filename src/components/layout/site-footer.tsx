import Link from 'next/link'

const COLUNAS = [
  {
    titulo: 'Serviço',
    links: [
      { href: '/#servicos', label: 'Como funciona' },
      { href: '/#planos', label: 'Planos e preços' },
      { href: '/#comparativo', label: 'Comparar recursos' },
      { href: '/portfolio', label: 'Portfólio' },
    ],
  },
  {
    titulo: 'Conta',
    links: [
      { href: '/auth/login', label: 'Entrar' },
      { href: '/auth/register', label: 'Criar conta' },
      { href: '/dashboard', label: 'Painel do estúdio' },
    ],
  },
  {
    titulo: 'Legal',
    links: [
      { href: '/termos', label: 'Termos de uso' },
      { href: '/privacidade', label: 'Privacidade' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="font-marketing border-t border-[#EAEAEA] bg-[#FFFFFF]">
      <div className="container grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
            <img src="/brand/logo-dark.png" alt="Seu Álbum" className="h-10 w-auto" />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-[#595959]">
            Diagramação e design de álbuns white label para fotógrafos profissionais.
          </p>
        </div>

        {COLUNAS.map((coluna) => (
          <nav key={coluna.titulo} aria-label={coluna.titulo}>
            <h3 className="text-sm font-semibold text-[#444444]">{coluna.titulo}</h3>
            <ul className="mt-4 space-y-2.5">
              {coluna.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#595959] transition-colors hover:text-[#444444]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-[#EAEAEA]">
        <p className="container py-6 text-xs text-[#595959]">
          © {new Date().getFullYear()} SeuÁlbum. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}
