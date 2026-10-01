import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FinalCta() {
  return (
    <section className="font-marketing bg-[#F5F5F5] py-24 text-center">
      <div className="container">
        <h2 className="text-display-l text-[#444444]">
          Seu próximo álbum pode sair da sua mesa hoje
        </h2>
        <p className="text-body mx-auto mt-4 max-w-xl text-[#595959]">
          Crie a conta do estúdio, envie o primeiro pedido e receba a prova dentro do prazo do
          plano escolhido.
        </p>
        <Button
          asChild
          size="lg"
          className="btn-marketing mt-10 border-2 border-[#171717] bg-[#171717] text-white hover:bg-[#2E2E2E]"
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
