import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { FinalCta } from '@/components/marketing/final-cta'
import { EmptyState } from '@/components/ui/empty-state'
import { getPublicMediaUrlMap, getPublicPortfolioCollections } from '@/lib/supabase/queries'

export const metadata: Metadata = {
  title: 'Portfólio',
  description: 'Álbuns diagramados pela equipe SeuÁlbum para estúdios de fotografia.',
  alternates: { canonical: '/portfolio' },
}

/** Revalida a cada hora — o portfólio muda pouco, então CDN estático > buscar a cada visita. */
export const revalidate = 3600

export default async function PortfolioPage() {
  const collections = await getPublicPortfolioCollections()
  const mediaMap = await getPublicMediaUrlMap(collections.map((c) => c.capaImagemId).filter((id): id is string => Boolean(id)))

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b bg-secondary/40 py-20">
          <div className="container mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Portfólio</h1>
            <p className="mt-4 text-muted-foreground">
              Uma seleção de álbuns diagramados para estúdios de casamento, ensaio e família.
            </p>
          </div>
        </section>

        <section className="container mx-auto py-16">
          {collections.length === 0 ? (
            <EmptyState title="Portfólio em construção" description="Novos trabalhos entram em breve." />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection) => {
                const capa = collection.capaImagemId ? mediaMap.get(collection.capaImagemId) : null
                return (
                  <div key={collection.id} className="overflow-hidden rounded-2xl border bg-card">
                    <div className="aspect-[4/3] overflow-hidden bg-secondary">
                      {capa ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL pública dinâmica do Storage, varia por coleção.
                        <img src={capa} alt={collection.nome} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="p-5">
                      <p className="font-semibold">{collection.nome}</p>
                      {collection.descricao ? <p className="mt-1 text-sm text-muted-foreground">{collection.descricao}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {collection.itens.length} {collection.itens.length === 1 ? 'foto' : 'fotos'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  )
}
