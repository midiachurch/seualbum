'use server'

import { revalidatePath } from 'next/cache'
import { requireModuleAction } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'
import type { MediaTag } from '@/types/platform'

/**
 * Server Actions da Vitrine e Biblioteca de Mídia — só chamadas fora do modo
 * de demonstração (ver cada componente). Todas passam por
 * `requireModuleAction('midia'|'vitrine', ...)`, que já resolve "apenas Admin
 * e Gestores de Marketing" (seção 18/19/20).
 */

function assertRealMode() {
  if (isDemoMode()) throw new Error('Ação indisponível em modo de demonstração.')
}

export async function registerMediaAsset(input: {
  storagePath: string
  url: string
  nome: string
  tags: MediaTag[]
  larguraPx: number
  alturaPx: number
  tamanhoKb: number
}) {
  assertRealMode()
  const { supabase } = await requireModuleAction('midia', 'criar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('media_assets')
    .insert({
      storage_path: input.storagePath,
      url: input.url,
      nome: input.nome,
      tags: input.tags,
      largura_px: input.larguraPx,
      altura_px: input.alturaPx,
      tamanho_kb: input.tamanhoKb,
      criado_por: userData.user?.id ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível registrar o arquivo.')

  revalidatePath('/admin/midia')
  return data.id as string
}

export async function deleteMediaAsset(id: string, storagePath: string) {
  assertRealMode()
  const { supabase } = await requireModuleAction('midia', 'excluir')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  await supabase.storage.from('midia_vitrine').remove([storagePath])
  const { error } = await supabase.from('media_assets').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/midia')
}

export async function createBanner(input: { imagemId: string; titulo: string; subtitulo: string; linkCta: string; ordem: number }) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'criar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('banners').insert({
    imagem_id: input.imagemId,
    titulo: input.titulo,
    subtitulo: input.subtitulo || null,
    link_cta: input.linkCta || null,
    ordem: input.ordem,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/admin/vitrine/banners')
  revalidatePath('/')
}

export async function updateBanner(
  id: string,
  input: { imagemId: string; titulo: string; subtitulo: string; linkCta: string },
) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase
    .from('banners')
    .update({ imagem_id: input.imagemId, titulo: input.titulo, subtitulo: input.subtitulo || null, link_cta: input.linkCta || null })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/vitrine/banners')
  revalidatePath('/')
}

export async function deleteBanner(id: string) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'excluir')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('banners').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/vitrine/banners')
  revalidatePath('/')
}

export async function toggleBannerActive(id: string, ativo: boolean) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('banners').update({ ativo }).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/vitrine/banners')
  revalidatePath('/')
}

/** Reescreve a ordem de todos os banners na sequência recebida (drag&drop / setas). */
export async function reorderBanners(orderedIds: string[]) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  await Promise.all(orderedIds.map((id, i) => supabase.from('banners').update({ ordem: i + 1 }).eq('id', id)))

  revalidatePath('/admin/vitrine/banners')
  revalidatePath('/')
}

export async function createCollection(input: { nome: string; descricao: string; capaImagemId: string | null; status: 'publicado' | 'rascunho'; ordem: number }) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'criar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { data, error } = await supabase
    .from('portfolio_collections')
    .insert({ nome: input.nome, descricao: input.descricao || null, capa_imagem_id: input.capaImagemId, status: input.status, ordem: input.ordem })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível criar a coleção.')

  revalidatePath('/admin/vitrine/portfolio')
  revalidatePath('/portfolio')
  return data.id as string
}

export async function updateCollection(
  id: string,
  input: { nome: string; descricao: string; capaImagemId: string | null; status: 'publicado' | 'rascunho' },
) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase
    .from('portfolio_collections')
    .update({ nome: input.nome, descricao: input.descricao || null, capa_imagem_id: input.capaImagemId, status: input.status })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/vitrine/portfolio')
  revalidatePath('/portfolio')
}

export async function deleteCollection(id: string) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'excluir')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('portfolio_collections').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/vitrine/portfolio')
  revalidatePath('/portfolio')
}

export async function addPortfolioItems(collectionId: string, imageIds: string[]) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { count } = await supabase
    .from('portfolio_items')
    .select('id', { count: 'exact', head: true })
    .eq('collection_id', collectionId)

  const rows = imageIds.map((imagemId, i) => ({ collection_id: collectionId, imagem_id: imagemId, ordem: (count ?? 0) + i + 1 }))
  const { error } = await supabase.from('portfolio_items').insert(rows)
  if (error) throw new Error(error.message)

  // Primeira foto da coleção vira capa automaticamente, se ainda não tiver uma.
  const { data: collection } = await supabase.from('portfolio_collections').select('capa_imagem_id').eq('id', collectionId).single()
  if (collection && !collection.capa_imagem_id && imageIds[0]) {
    await supabase.from('portfolio_collections').update({ capa_imagem_id: imageIds[0] }).eq('id', collectionId)
  }

  revalidatePath(`/admin/vitrine/portfolio/${collectionId}`)
  revalidatePath('/portfolio')
}

export async function removePortfolioItem(itemId: string, collectionId: string) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('portfolio_items').delete().eq('id', itemId)
  if (error) throw new Error(error.message)

  revalidatePath(`/admin/vitrine/portfolio/${collectionId}`)
  revalidatePath('/portfolio')
}

export async function setCollectionCover(collectionId: string, imagemId: string) {
  assertRealMode()
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('portfolio_collections').update({ capa_imagem_id: imagemId }).eq('id', collectionId)
  if (error) throw new Error(error.message)

  revalidatePath(`/admin/vitrine/portfolio/${collectionId}`)
  revalidatePath('/portfolio')
}
