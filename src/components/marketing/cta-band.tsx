import { CtaButtons, type CtaAction } from '@/components/marketing/cta-buttons'

interface CtaBandProps {
  eyebrow?: string
  title: string
  description: string
  actions: CtaAction[]
  /** Fotografia de fundo opcional, escurecida para manter o contraste do texto. */
  image?: string
}

/**
 * Faixa de fechamento em alto contraste (#171717). Versão configurável do
 * `FinalCta` para as páginas internas, cada uma com o seu argumento final.
 */
export function CtaBand({ eyebrow, title, description, actions, image }: CtaBandProps) {
  return (
    <section className="font-marketing relative isolate overflow-hidden bg-[#171717] py-24 text-center sm:py-28">
      {image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
          <img src={image} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25 grayscale" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[#171717] via-[#171717]/70 to-[#171717]/40" />
        </>
      ) : null}

      <div className="container">
        {eyebrow ? <p className="text-overline text-white/70">{eyebrow}</p> : null}
        <h2 className="text-display-l mx-auto mt-4 max-w-3xl text-balance text-white">{title}</h2>
        <p className="text-body mx-auto mt-4 max-w-xl text-white/80">{description}</p>
        <CtaButtons actions={actions} tone="dark" align="center" className="mx-auto mt-10 max-w-sm sm:max-w-none" />
      </div>
    </section>
  )
}
