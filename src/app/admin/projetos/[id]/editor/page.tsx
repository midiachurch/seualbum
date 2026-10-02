import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { EditorAlbum } from '@/components/album-editor/editor-album'
import { CLASSES_FONTES_ALBUM, FAMILIAS_ALBUM } from '@/app/admin/fontes-album'
import { AbrirEditorDoProjeto } from '@/components/album-editor/abrir-editor-do-projeto'
import { getAlbumParaEditor, getLayoutIdDoProjeto, requireEdicaoDeProducao, requirePlatformAccess } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Editor do álbum' }

/**
 * Diagramação de um projeto no editor nativo. Na primeira visita o documento
 * ainda não existe: o componente cliente cria (formato do projeto) e recarrega.
 */
export default async function EditorDoProjetoPage({
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
  const layoutId = await getLayoutIdDoProjeto(id)
  if (!layoutId) return <AbrirEditorDoProjeto projetoId={id} />
  const album = await getAlbumParaEditor(layoutId)
  if (!album) notFound()
  return (
    <div className={CLASSES_FONTES_ALBUM}>
      <EditorAlbum album={album} familias={FAMILIAS_ALBUM} abrirInicial={typeof abrir === 'string' ? abrir : undefined} />
    </div>
  )
}
