'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PROVAS = [
  { icon: Clock, label: 'Entrega a partir de 2 dias úteis' },
  { icon: Sparkles, label: 'Diagramação white label' },
  { icon: ShieldCheck, label: 'Aprovação online com o seu cliente' },
]

export type HeroSlide = {
  id: string
  imageUrl: string
  titulo: string
  subtitulo: string
  linkCta: string
}

/**
 * Versão dinâmica do Hero estático (`components/marketing/hero.tsx`) — usada
 * quando existe pelo menos um banner ativo cadastrado em `/admin/vitrine/banners`.
 * Gira sozinho a cada 6s; para no hover/foco para não atrapalhar quem está lendo.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (slides.length <= 1 || paused) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000)
    return () => clearInterval(timer)
  }, [slides.length, paused])

  const slide = slides[index]
  if (!slide) return null

  return (
    <section
      className="font-marketing relative flex min-h-[85vh] items-center overflow-hidden bg-[#F5F5F5]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage (URL pública dinâmica), next/image exigiria domínio fixo por slide.
        <img
          key={s.id}
          src={s.imageUrl}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover grayscale contrast-[1.05] transition-opacity duration-700',
            i === index ? 'opacity-100' : 'opacity-0',
          )}
          style={{ objectPosition: '65% center' }}
        />
      ))}
      <div className="absolute inset-0 bg-black/10" aria-hidden />

      <div className="container relative z-10">
        <div className="max-w-md">
          <p className="text-overline text-[#444444]/70">Seu álbum</p>
          <h1 className="text-display-xl mt-4 text-[#444444]">{slide.titulo}</h1>
          {slide.subtitulo ? <p className="text-subheading mt-6 text-[#444444]">{slide.subtitulo}</p> : null}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="btn-marketing border-2 border-[#171717] bg-[#171717] text-white hover:bg-[#2E2E2E]">
              <Link href={slide.linkCta || '/auth/register'}>Começar agora</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="btn-marketing border-2 border-[#444444]/40 bg-transparent text-[#444444] hover:border-[#444444] hover:bg-transparent"
            >
              <Link href="#planos">Ver planos e preços</Link>
            </Button>
          </div>

          <ul className="text-caption mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[#444444]/70">
            {PROVAS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            aria-label="Banner anterior"
            className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#171717] shadow-sm transition-colors hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            aria-label="Próximo banner"
            className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#171717] shadow-sm transition-colors hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ir para o banner ${i + 1}`}
                className="flex h-8 items-center p-2"
              >
                <span className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-6 bg-[#171717]' : 'w-1.5 bg-[#171717]/30')} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
