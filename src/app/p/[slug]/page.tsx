import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { getPublicPagina } from '@/lib/supabase/queries'

/** Revalida a cada hora — conteúdo institucional muda pouco. */
export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const pagina = await getPublicPagina(slug)
  if (!pagina) return { title: 'Página não encontrada' }
  return {
    title: pagina.titulo,
    description: pagina.seoDescription ?? undefined,
    alternates: { canonical: `/p/${pagina.slug}` },
  }
}

/**
 * Rota catch-all do CMS no-code ("CMS No-Code Avançado") — qualquer página
 * criada em `/admin/vitrine/paginas` e publicada fica disponível aqui, sem
 * precisar de deploy. `getPublicPagina` já filtra por `status = 'publicado'`,
 * então um rascunho nunca vaza para o site público.
 */
export default async function PaginaDinamicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pagina = await getPublicPagina(slug)
  if (!pagina) notFound()

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1 py-16 sm:py-24">
        <article className="container mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{pagina.titulo}</h1>
          <div
            className="prose-outbox mt-10 text-base text-foreground"
            // eslint-disable-next-line react/no-danger -- conteúdo escrito pela própria equipe no editor do admin (RLS restrita a admin/gestor), não input público.
            dangerouslySetInnerHTML={{ __html: pagina.conteudoHtml }}
          />
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
