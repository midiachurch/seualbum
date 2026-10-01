import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { PortfolioCollection } from '@/types/platform'

/**
 * Seção "Nossos trabalhos" da home — teaser com até 3 coleções publicadas,
 * levando para a galeria completa em `/portfolio`. Some sozinha se não
 * houver nenhuma coleção publicada (ver `page.tsx`), então nunca aparece
 * vazia ou com placeholders.
 */
export function PortfolioShowcase({
  collections,
  mediaMap,
  limit = 3,
}: {
  collections: PortfolioCollection[]
  mediaMap: Map<string, string>
  limit?: number
}) {
  const destaques = collections.slice(0, limit)

  return (
    <section className="font-marketing border-b border-[#EAEAEA] bg-white py-20 sm:py-28">
      <div className="container mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-overline text-[#595959]">Portfólio</p>
            <h2 className="text-display-lg mt-3 text-[#171717]">Nossos trabalhos</h2>
          </div>
          <Link
            href="/portfolio"
            className="flex items-center gap-1.5 text-sm font-medium text-[#171717] transition-colors hover:text-[#444444]"
          >
            Ver portfólio completo
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {destaques.map((collection) => {
            const capa = collection.capaImagemId ? mediaMap.get(collection.capaImagemId) : null
            return (
              <Link
                key={collection.id}
                href="/portfolio"
                className="group overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white transition-shadow hover:shadow-lg"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#F5F5F5]">
                  {capa ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL pública dinâmica do Storage, varia por coleção.
                    <img
                      src={capa}
                      alt={collection.nome}
                      className="h-full w-full object-cover grayscale transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="p-5">
                  <p className="font-medium text-[#171717]">{collection.nome}</p>
                  {collection.descricao ? <p className="mt-1 text-sm text-[#595959]">{collection.descricao}</p> : null}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
