import { notFound } from 'next/navigation'
import { metadadosPublicos, PaginaPublica } from '@/components/sites/pagina-publica'

export const revalidate = 60

type Props = { params: Promise<{ slug: string; pagina: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug, pagina } = await params
  return metadadosPublicos(slug, pagina, 'plataforma')
}

export default async function SitePagina({ params }: Props) {
  const { slug, pagina } = await params
  // A home só existe na raiz do site; /inicio seria uma cópia.
  if (pagina === 'inicio') notFound()
  return <PaginaPublica slug={slug} paginaSlug={pagina} modo="plataforma" />
}
