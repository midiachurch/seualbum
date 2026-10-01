import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
            <img src={item.image} alt={item.alt} className="h-full w-full object-cover grayscale contrast-[1.05]" />
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
