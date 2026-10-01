import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { TextImageGallery, type TextImageItem } from '@/components/marketing/text-image-gallery'

export const metadata: Metadata = {
  title: 'Álbuns',
  description: 'Formatos de álbuns fotográficos SeuÁlbum: 20×20, 25×25, 30×30 e 30×40.',
  alternates: { canonical: '/albuns' },
}

// Formatos reais do catálogo (Diretriz 11) — estrutura preparada para os
// demais dados (capas, acabamentos, preços) serem cadastrados nas próximas etapas.
const FORMATOS: TextImageItem[] = [
  {
    image: 'https://picsum.photos/seed/album-20x20/960/540',
    alt: 'Álbum fotográfico no formato 20 por 20 centímetros',
    title: '20 × 20',
    description: 'Compacto e versátil — ideal para ensaios, mini álbuns e presentes.',
    href: '/portfolio',
  },
  {
    image: 'https://picsum.photos/seed/album-25x25/960/540',
    alt: 'Álbum fotográfico no formato 25 por 25 centímetros',
    title: '25 × 25',
    description: 'O equilíbrio entre presença na estante e portabilidade no dia a dia.',
    href: '/portfolio',
  },
  {
    image: 'https://picsum.photos/seed/album-30x30/960/540',
    alt: 'Álbum fotográfico no formato 30 por 30 centímetros',
    title: '30 × 30',
    description: 'Nosso formato mais escolhido para casamentos e grandes celebrações.',
    href: '/portfolio',
  },
  {
    image: 'https://picsum.photos/seed/album-30x40/960/540',
    alt: 'Álbum fotográfico no formato 30 por 40 centímetros',
    title: '30 × 40',
    description: 'Para histórias que pedem mais espaço e impacto em cada lâmina.',
    href: '/portfolio',
  },
]

export default function AlbunsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <section className="font-marketing bg-white py-24 sm:py-28">
          <div className="container">
            <header className="mx-auto max-w-2xl text-center">
              <p className="text-overline text-[#595959]">Álbuns</p>
              <h1 className="text-display-l mt-4 text-[#444444]">Cada história pede um formato.</h1>
              <p className="text-body mt-4 text-[#595959]">
                Formatos preparados para diferentes projetos — capas, acabamentos e personalização
                entram no catálogo nas próximas etapas.
              </p>
            </header>

            <div className="mt-16">
              <TextImageGallery items={FORMATOS} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
