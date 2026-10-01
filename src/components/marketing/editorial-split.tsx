import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditorialSplitProps {
  eyebrow: string
  title: string
  description: string
  image: string
  imageAlt: string
  bullets?: string[]
  /** Inverte imagem e texto no desktop, para alternar blocos consecutivos. */
  reverse?: boolean
  tone?: 'white' | 'gray'
  /** Espaço para CTA ou link ao final do texto. */
  children?: ReactNode
}

/**
 * Bloco imagem + argumento, em proporção 7/5 de colunas. Usado em sequência,
 * com `reverse` alternado, para contar a proposta de valor como uma revista.
 */
export function EditorialSplit({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  bullets,
  reverse = false,
  tone = 'white',
  children,
}: EditorialSplitProps) {
  return (
    <section className={cn('font-marketing py-20 sm:py-28', tone === 'gray' ? 'bg-[#F5F5F5]' : 'bg-white')}>
      <div className="container grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
        <div className={cn('group overflow-hidden lg:col-span-7', reverse && 'lg:order-2 lg:col-start-6')}>
          <div className="aspect-[4/3] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
            <img
              src={image}
              alt={imageAlt}
              loading="lazy"
              className="h-full w-full object-cover grayscale contrast-[1.05] motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.03]"
            />
          </div>
        </div>

        <div className={cn('lg:col-span-4', reverse ? 'lg:order-1 lg:col-start-1' : 'lg:col-start-9')}>
          <p className="text-overline text-[#595959]">{eyebrow}</p>
          <h2 className="text-display-l mt-4 text-balance text-[#444444]">{title}</h2>
          <p className={cn('text-body mt-4', tone === 'gray' ? 'text-[#444444]' : 'text-[#595959]')}>{description}</p>

          {bullets && bullets.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {bullets.map((item) => (
                <li key={item} className="text-body flex items-start gap-3 text-[#444444]">
                  <Check className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </div>
    </section>
  )
}
