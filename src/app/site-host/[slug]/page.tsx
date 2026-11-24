import { metadadosPublicos, PaginaPublica } from '@/components/sites/pagina-publica'

/** Cache por caminho (inclui o slug): nunca mistura sites. Publicar/retirar/reverter invalida por revalidatePath. */
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return metadadosPublicos(slug, 'inicio', 'host')
}

export default async function SiteInicio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <PaginaPublica slug={slug} paginaSlug="inicio" modo="host" />
}
