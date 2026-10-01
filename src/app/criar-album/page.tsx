import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, Clock, ShieldCheck, Smartphone } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageHero } from '@/components/marketing/page-hero'
import { OrderSteps } from '@/components/marketing/order-steps'
import { DesignStyles } from '@/components/marketing/design-styles'
import { CtaBand } from '@/components/marketing/cta-band'
import { getActivePlans } from '@/lib/supabase/queries'
import { FALLBACK_PLANS } from '@/lib/pricing'
import { formatBRL } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Criar meu álbum',
  description:
    'Comece o pedido do seu álbum em cinco passos: escolha o plano, conte sobre o projeto, envie as fotos pelo celular e defina o briefing.',
  alternates: { canonical: '/criar-album' },
}

/** Os valores "a partir de" vêm do catálogo; revalida como as demais páginas comerciais. */
export const revalidate = 3600

/** O que ter à mão antes de abrir o wizard — cada item corresponde a um passo. */
const CHECKLIST = [
  { titulo: 'As fotos selecionadas', texto: 'Na galeria do celular ou numa pasta do Google Drive ou Dropbox.' },
  { titulo: 'Os dados do projeto', texto: 'Nome do casal ou do evento, a data e o contato do seu cliente.' },
  { titulo: 'O estilo desejado', texto: 'Clássico, moderno, editorial, minimalista ou fine art.' },
  { titulo: 'O que não pode faltar', texto: 'Fotos obrigatórias, momentos-chave e observações para a equipe.' },
]

export default async function CriarAlbumPage() {
  const dbPlans = await getActivePlans()
  const plans = dbPlans.length > 0 ? dbPlans : FALLBACK_PLANS

  const precos = (tipo: 'avulso' | 'assinatura') =>
    plans.filter((p) => p.tipo_cobranca === tipo).map((p) => p.preco)
  const menorAvulso = precos('avulso').length > 0 ? Math.min(...precos('avulso')) : null
  const menorAssinatura = precos('assinatura').length > 0 ? Math.min(...precos('assinatura')) : null
  const menorPrazo = plans.length > 0 ? Math.min(...plans.map((p) => p.prazo_dias)) : null

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Criar meu álbum"
          title="Seu próximo álbum começa com as fotos que já estão no seu celular."
          description="Abra o pedido, envie a seleção e conte como imagina o álbum. A diagramação fica com a gente; a assinatura, com você."
          actions={[
            { href: '/dashboard/novo-pedido', label: 'Começar meu álbum' },
            { href: '/auth/register', label: 'Ainda não tenho conta', variant: 'secondary' },
          ]}
          image="/hero/album-still.jpg"
          imageAlt="Álbum fotográfico personalizado sobre still de estúdio"
          provas={[
            { icon: Smartphone, label: 'Fotos direto da galeria' },
            ...(menorPrazo !== null ? [{ icon: Clock, label: `A partir de ${menorPrazo} dias úteis` }] : []),
            { icon: ShieldCheck, label: 'White label' },
          ]}
        />

        <section className="font-marketing bg-white py-20 sm:py-28">
          <div className="container grid gap-12 lg:grid-cols-12 lg:gap-8">
            <header className="lg:col-span-4">
              <p className="text-overline text-[#595959]">Antes de começar</p>
              <h2 className="text-display-l mt-4 text-balance text-[#444444]">Tenha isto à mão</h2>
              <p className="text-body mt-4 text-[#595959]">
                Com esses quatro itens, o pedido fica completo de uma vez e o prazo começa a contar mais cedo.
              </p>
            </header>
            <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
              {CHECKLIST.map((item) => (
                <li key={item.titulo} className="flex gap-4 border-t border-[#EAEAEA] pt-6">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[#444444]" aria-hidden />
                  <div>
                    <h3 className="text-base font-semibold text-[#444444]">{item.titulo}</h3>
                    <p className="text-body mt-1 text-[#595959]">{item.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <OrderSteps
          tone="gray"
          eyebrow="Passo a passo"
          title="Cinco passos entre a seleção e a fila de diagramação"
          description="É exatamente o que você vai ver ao clicar em “Começar meu álbum”."
        />

        <DesignStyles
          title="Escolha a linguagem do seu álbum"
          description="No briefing você indica o estilo — e pode detalhar referências e fotos obrigatórias para a equipe."
        />

        {/* Duas portas de entrada: o avulso passa pelo checkout, a assinatura não. */}
        <section className="font-marketing border-t border-[#EAEAEA] bg-white py-20 sm:py-28">
          <div className="container">
            <header className="mx-auto max-w-2xl text-center">
              <p className="text-overline text-[#595959]">Como pagar</p>
              <h2 className="text-display-l mt-4 text-balance text-[#444444]">Um álbum de cada vez, ou vários por mês</h2>
            </header>

            <div className="mx-auto mt-12 grid max-w-4xl gap-px overflow-hidden border border-[#EAEAEA] bg-[#EAEAEA] sm:grid-cols-2">
              <div className="bg-white p-8 sm:p-10">
                <p className="text-heading text-[#444444]">Avulso</p>
                {menorAvulso !== null ? (
                  <p className="mt-4 text-[#444444]">
                    <span className="text-caption text-[#595959]">a partir de </span>
                    <span className="font-[family-name:var(--font-poppins)] text-3xl font-light">{formatBRL(menorAvulso)}</span>
                    <span className="text-caption text-[#595959]"> /álbum</span>
                  </p>
                ) : null}
                <p className="text-body mt-4 text-[#595959]">
                  Você escolhe o plano no primeiro passo e paga via Pix ou cartão ao final do pedido.
                </p>
              </div>
              <div className="bg-white p-8 sm:p-10">
                <p className="text-heading text-[#444444]">Assinatura</p>
                {menorAssinatura !== null ? (
                  <p className="mt-4 text-[#444444]">
                    <span className="text-caption text-[#595959]">a partir de </span>
                    <span className="font-[family-name:var(--font-poppins)] text-3xl font-light">{formatBRL(menorAssinatura)}</span>
                    <span className="text-caption text-[#595959]"> /mês</span>
                  </p>
                ) : null}
                <p className="text-body mt-4 text-[#595959]">
                  Álbuns inclusos todo mês. O pedido pula o checkout e vai direto para a fila de diagramação.
                </p>
              </div>
            </div>

            <p className="mt-8 text-center">
              <Link
                href="/precos"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[#444444] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#444444]"
              >
                Comparar planos e preços
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </p>
          </div>
        </section>

        <CtaBand
          eyebrow="Tudo pronto?"
          title="Abra o pedido e envie as fotos agora mesmo."
          description="Sem conta ainda? Crie a do estúdio em poucos minutos e comece o pedido logo em seguida."
          actions={[
            { href: '/dashboard/novo-pedido', label: 'Começar meu álbum' },
            { href: '/auth/register', label: 'Criar conta do estúdio', variant: 'secondary' },
          ]}
          image="https://picsum.photos/seed/seualbum-criar-cta/1600/900"
        />
      </main>
      <SiteFooter />
    </div>
  )
}
