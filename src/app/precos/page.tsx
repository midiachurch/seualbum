import type { Metadata } from 'next'
import { CreditCard, Layers, Zap } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageHero } from '@/components/marketing/page-hero'
import { PlanModels, SubscriptionMath } from '@/components/marketing/plan-models'
import { PricingSection } from '@/components/marketing/pricing-section'
import { FeatureComparison } from '@/components/marketing/feature-comparison'
import { Faq } from '@/components/marketing/faq'
import { CtaBand } from '@/components/marketing/cta-band'
import { getActivePlans } from '@/lib/supabase/queries'
import { FALLBACK_PLANS } from '@/lib/pricing'

export const metadata: Metadata = {
  title: 'Preços',
  description:
    'Pague por álbum no plano avulso, via Pix ou cartão, ou assine e tenha uma cota mensal de álbuns com pedidos direto na fila de diagramação.',
  alternates: { canonical: '/precos' },
}

export const revalidate = 3600

export default async function PrecosPage() {
  const dbPlans = await getActivePlans()
  // Mesmo fallback da home: a página de preços nunca fica vazia sem o banco.
  const plans = dbPlans.length > 0 ? dbPlans : FALLBACK_PLANS
  const planosAvulsos = plans.filter((p) => p.tipo_cobranca === 'avulso')

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Preços"
          title="Preço claro para cada fase do seu estúdio."
          description="Pague por álbum quando a demanda for pontual, ou assine e transforme a diagramação em um custo fixo — com pedidos que vão direto para a produção."
          actions={[
            { href: '/auth/register', label: 'Criar conta do estúdio' },
            { href: '#modelos', label: 'Avulso ou assinatura?', variant: 'secondary' },
          ]}
          image="/hero/album-still.jpg"
          imageAlt="Álbum fotográfico impresso sobre still de estúdio"
          provas={[
            { icon: CreditCard, label: 'Pix ou cartão no avulso' },
            { icon: Layers, label: 'Cota mensal na assinatura' },
            { icon: Zap, label: 'Sem taxa de setup' },
          ]}
        />

        <PlanModels plans={plans} />

        {/* Catálogo completo com toggle — mesmo componente da home. */}
        <PricingSection plans={plans} defaultCycle="avulso" />

        <SubscriptionMath plans={plans} />

        {planosAvulsos.length > 0 ? (
          <section id="comparativo" className="font-marketing border-t border-[#EAEAEA] bg-white py-20 sm:py-28">
            <div className="container">
              <header className="mb-10 max-w-2xl">
                <p className="text-overline text-[#595959]">Comparativo</p>
                <h2 className="text-display-l mt-4 text-[#444444]">O que cada plano inclui</h2>
                <p className="text-body mt-4 text-[#595959]">
                  Os recursos de cada plano são os mesmos no avulso e na assinatura. No celular, deslize a
                  tabela para o lado.
                </p>
              </header>
              <FeatureComparison plans={planosAvulsos} />
            </div>
          </section>
        ) : null}

        <Faq />

        <CtaBand
          eyebrow="Comece pelo primeiro álbum"
          title="Teste com um pedido avulso. Assine quando o volume pedir."
          description="Crie a conta do estúdio em poucos minutos e envie as fotos direto do celular ou por um link do Drive ou Dropbox."
          actions={[
            { href: '/auth/register', label: 'Criar conta do estúdio' },
            { href: '/dashboard/novo-pedido', label: 'Começar um pedido', variant: 'secondary' },
          ]}
          image="https://picsum.photos/seed/seualbum-precos-cta/1600/900"
        />
      </main>
      <SiteFooter />
    </div>
  )
}
