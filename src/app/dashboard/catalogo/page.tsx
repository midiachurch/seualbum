import type { Metadata } from 'next'
import { CatalogoEstudio } from '@/components/dashboard/catalogo-estudio'
import { getCatalogoDoEstudio } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Catálogo de adicionais' }

/**
 * Catálogo B2B do estúdio (Upsell, migration 0026): o que a Seu Álbum
 * oferece, quanto custa para o estúdio e por quanto ele vende ao casal.
 */
export default async function CatalogoPage() {
  const itens = await getCatalogoDoEstudio()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Catálogo de adicionais</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Escolha o que oferecer aos seus clientes no momento da aprovação do álbum e defina o seu preço de venda. Você paga o custo
          Seu Álbum; a diferença é o seu lucro.
        </p>
      </header>
      <CatalogoEstudio itens={itens} />
    </div>
  )
}
