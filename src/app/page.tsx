import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { Hero } from '@/components/marketing/hero'
import { HeroCarousel, type HeroSlide } from '@/components/marketing/hero-carousel'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { PricingSection } from '@/components/marketing/pricing-section'
import { PortfolioShowcase } from '@/components/marketing/portfolio-showcase'
import { Faq } from '@/components/marketing/faq'
import { FinalCta } from '@/components/marketing/final-cta'
import { getActivePlans, getPublicBanners, getPublicMediaUrlMap, getPublicPortfolioCollections } from '@/lib/supabase/queries'
import { FALLBACK_PLANS } from '@/lib/pricing'

export const metadata: Metadata = {
  title: 'Diagramação de álbuns para fotógrafos',
  description:
    'Planos avulsos e por assinatura para diagramação de álbuns. Prazo a partir de 2 dias úteis, aprovação online e arquivo pronto para a gráfica.',
  alternates: { canonical: '/' },
}

/**
 * Landing comercial. Revalida a cada hora: o catálogo muda raramente, então
 * servir HTML estático do CDN da Vercel é melhor que buscar planos por visita.
 */
export const revalidate = 3600

export default async function HomePage() {
  const [dbPlans, banners, collections] = await Promise.all([
    getActivePlans(),
    getPublicBanners(),
    getPublicPortfolioCollections(),
  ])
  // O catálogo estático cobre o ambiente de dev sem Supabase e a indisponibilidade
  // do banco — a página de preços nunca fica vazia.
  const plans = dbPlans.length > 0 ? dbPlans : FALLBACK_PLANS

  const mediaIds = [
    ...banners.map((b) => b.imagemId),
    ...collections.map((c) => c.capaImagemId).filter((id): id is string => Boolean(id)),
  ]
  const mediaMap = await getPublicMediaUrlMap(mediaIds)

  const slides: HeroSlide[] = banners
    .map((b) => ({ id: b.id, imageUrl: mediaMap.get(b.imagemId) ?? '', titulo: b.titulo, subtitulo: b.subtitulo, linkCta: b.linkCta }))
    .filter((s) => s.imageUrl)

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">
        {/* Sem banner ativo cadastrado, cai no Hero estático — a home nunca fica sem herói. */}
        {slides.length > 0 ? <HeroCarousel slides={slides} /> : <Hero />}
        <HowItWorks />
        {collections.length > 0 ? <PortfolioShowcase collections={collections} mediaMap={mediaMap} /> : null}
        <PricingSection plans={plans} defaultCycle="avulso" />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  )
}
