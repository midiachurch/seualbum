import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { atributosImagem } from '@/lib/imagens-locais'

export interface TextImageItem {
  image: string
  alt: string
  title: string
  description: string
  href: string
}

interface TextImageGalleryProps {
  items: TextImageItem[]
}

/**
 * Galeria imagem+texto (Diretriz: elements-textimage.html) — dois itens por
 * linha no desktop, cada um com imagem à esquerda e texto à direita. Gap
 * interno imagem↔texto e entre itens seguem a folga de uma coluna inteira
 * (col-md-offset-1) e o ritmo vertical de 80px das seções da referência.
 */
export function TextImageGallery({ items }: TextImageGalleryProps) {
  return (
    <div className="grid gap-x-16 gap-y-20 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="flex flex-col gap-8 sm:flex-row sm:items-center">
          <div className="relative aspect-video w-full shrink-0 overflow-hidden sm:w-3/5">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
            <img
              {...atributosImagem(item.image, '(min-width: 640px) 30vw, 100vw')}
              alt={item.alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="sm:w-2/5">
            <h3 className="text-title text-[#444444]">{item.title}</h3>
            <p className="text-body mt-2 text-[#595959]">{item.description}</p>
            <Button
              asChild
              size="sm"
              className="btn-marketing mt-4 border-2 border-[#444444]/40 bg-transparent text-[#444444] hover:border-[#444444] hover:bg-transparent"
            >
              <Link href={item.href}>Ver álbum</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
