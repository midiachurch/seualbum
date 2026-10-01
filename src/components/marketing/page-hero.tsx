import type { LucideIcon } from 'lucide-react'
import { CtaButtons, type CtaAction } from '@/components/marketing/cta-buttons'

interface PageHeroProps {
  eyebrow: string
  title: string
  description: string
  actions: CtaAction[]
  image: string
  imageAlt: string
  /** Selos curtos abaixo dos CTAs, no mesmo padrão do `Hero` da home. */
  provas?: { icon: LucideIcon; label: string }[]
}

/**
 * Herói das páginas internas: texto à esquerda e fotografia vertical à
 * direita no desktop; no celular a imagem desce para depois do texto, assim o
 * h1 e o CTA aparecem sem rolagem. Único `<h1>` da página.
 */
export function PageHero({ eyebrow, title, description, actions, image, imageAlt, provas }: PageHeroProps) {
  return (
    <section className="font-marketing overflow-hidden bg-[#F5F5F5]">
      <div className="container grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-12 lg:gap-8 lg:py-24">
        <div className="lg:col-span-6 xl:col-span-5">
          <p className="text-overline text-[#444444]/70">{eyebrow}</p>
          <h1 className="text-display-xl mt-4 text-balance text-[#444444] sm:text-4xl sm:leading-tight">{title}</h1>
          <p className="text-subheading mt-6 max-w-lg text-[#444444]">{description}</p>

          <CtaButtons actions={actions} className="mt-8" />

          {provas && provas.length > 0 ? (
            <ul className="text-caption mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[#444444]/80">
              {provas.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="relative lg:col-span-6 lg:col-start-7 xl:col-span-6 xl:col-start-7">
          <div className="aspect-[4/5] overflow-hidden sm:aspect-[4/3] lg:aspect-[4/5]">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
            <img src={image} alt={imageAlt} className="h-full w-full object-cover grayscale contrast-[1.05]" />
          </div>
          {/* Filete deslocado — o "passe-partout" editorial que dá profundidade sem sombra. */}
          <div aria-hidden className="pointer-events-none absolute -bottom-4 -left-4 hidden h-2/3 w-2/3 border border-[#444444]/20 lg:block" />
        </div>
      </div>
    </section>
  )
}
