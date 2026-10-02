import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { EditorAlbum } from '@/components/album-editor/editor-album'
import { CLASSES_FONTES_ALBUM, FAMILIAS_ALBUM } from '@/app/admin/fontes-album'
import { getAlbumParaEditor, requireEdicaoDeProducao, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Editor de álbum' }

export default async function EditorAlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>
}) {
  await requirePlatformAccess(['projetos', 'design'])
  await requireEdicaoDeProducao()
  const { id } = await params
  const { abrir } = await searchParams
  const album = await getAlbumParaEditor(id)
  if (!album) notFound()
  // Álbum de projeto: o endereço canônico é o do projeto.
  if (album.projeto) redirect(`/admin/projetos/${album.projeto.id}/editor${typeof abrir === 'string' ? `?abrir=${encodeURIComponent(abrir)}` : ''}`)
  return (
    <div className={CLASSES_FONTES_ALBUM}>
      <EditorAlbum album={album} familias={FAMILIAS_ALBUM} abrirInicial={typeof abrir === 'string' ? abrir : undefined} />
    </div>
  )
}
