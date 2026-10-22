import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { atributosImagem } from '@/lib/imagens-locais'

/**
 * Fechamento da home: foto das mãos folheando um álbum ao fundo, com véu
 * escuro de 70% — o texto branco fica acima do contraste AA em qualquer
 * parte da foto.
 */
export function FinalCta() {
  return (
    <section className="font-marketing relative isolate overflow-hidden bg-[#171717] py-24 text-center sm:py-32">
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
      <img
        {...atributosImagem('/images/cta/album-maos.webp')}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-black/70" aria-hidden />
      <div className="container">
        <h2 className="text-display-l text-white">
          Seu próximo álbum pode sair da sua mesa hoje
        </h2>
        <p className="text-body mx-auto mt-4 max-w-xl text-white/85">
          Crie a conta do estúdio, envie o primeiro pedido e receba a prova dentro do prazo do
          plano escolhido.
        </p>
        <Button
          asChild
          size="lg"
          className="btn-marketing mt-10 border-2 border-white bg-white text-[#171717] hover:bg-[#EAEAEA]"
        >
          <Link href="/auth/register">
            Criar conta do estúdio
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  )
}
