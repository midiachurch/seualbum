import Link from 'next/link'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { FAQ_ITEMS } from '@/lib/pricing'

export function Faq() {
  return (
    <section id="faq" className="font-marketing bg-[#FFFFFF] py-24 sm:py-28">
      <div className="container grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <header>
          <p className="text-overline text-[#595959]">Dúvidas</p>
          <h2 className="text-display-l mt-4 text-[#444444]">
            Perguntas frequentes
          </h2>
          <p className="text-body mt-4 text-[#595959]">
            Não achou o que procurava?{' '}
            <Link
              href="mailto:contato@seualbum.com.br"
              className="font-medium text-[#444444] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#444444]"
            >
              Fale com a gente
            </Link>
            .
          </p>
        </header>

        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.pergunta} value={`item-${index}`} className="border-[#EAEAEA]">
              <AccordionTrigger className="text-[#444444] hover:text-[#444444]/70">
                {item.pergunta}
              </AccordionTrigger>
              <AccordionContent className="text-[#595959]">{item.resposta}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
