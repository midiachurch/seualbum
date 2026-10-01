import Link from 'next/link'
import { Clock, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PROVAS = [
  { icon: Clock, label: 'Entrega a partir de 2 dias úteis' },
  { icon: Sparkles, label: 'Diagramação white label' },
  { icon: ShieldCheck, label: 'Aprovação online com o seu cliente' },
]

export function Hero() {
  return (
    <section className="font-marketing relative flex min-h-[85vh] items-center overflow-hidden bg-[#F5F5F5]">
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
      <img
        src="/hero/album-still.jpg"
        alt="Álbum fotográfico personalizado sobre still de estúdio"
        className="absolute inset-0 h-full w-full object-cover grayscale contrast-[1.05]"
        style={{ objectPosition: '65% center' }}
      />

      <div className="container relative z-10">
        <div className="max-w-md">
          <p className="text-overline text-[#444444]/70">Seu álbum</p>
          <h1 className="text-display-xl mt-4 text-[#444444]">
            Fotografias merecem virar histórias.
          </h1>
          <p className="text-subheading mt-6 text-[#444444]">
            Envie o link das fotos e o briefing. Devolvemos o álbum diagramado, com prova online
            para o seu cliente aprovar e arquivo pronto para a gráfica.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="btn-marketing border-2 border-[#171717] bg-[#171717] text-white hover:bg-[#2E2E2E]">
              <Link href="/auth/register">Começar agora</Link>
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
    </section>
  )
}
