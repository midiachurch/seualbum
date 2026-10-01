import type { Metadata } from 'next'
import { Poppins, Open_Sans } from 'next/font/google'
import './globals.css'

// Tipografia ÚNICA da aplicação (diretriz de marca do site-piloto): Poppins
// nos títulos, Open Sans no corpo — site, login, painéis, admin, prova e
// páginas públicas. Antes a raiz aplicava Inter e o painel do fotógrafo
// usava Fraunces; páginas fora dos layouts (orçamento público, /p, portfólio)
// caíam em Inter. Agora o `body` já nasce na fonte da marca.
// 700 incluído: títulos `font-bold` do app não viram negrito sintético.
const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  weight: ['300', '400', '600', '700'],
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SeuÁlbum — Diagramação de álbuns para fotógrafos',
    template: '%s | SeuÁlbum',
  },
  description:
    'Serviço white label de diagramação e design de álbuns para fotógrafos. Envie o link das fotos, acompanhe a produção e entregue o arquivo pronto para a gráfica.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: siteUrl,
    siteName: 'SeuÁlbum',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} ${openSans.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  )
}
