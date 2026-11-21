'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'

const demo = { ok: false as const, erro: 'Demonstração: nada será gravado no servidor.' }

/** Cria ou renomeia uma coleção. Quem pode é decidido no banco pela sessão. */
export async function salvarColecao(projetoId: string, id: string, nome: string, ordem = 0) {
  const falha = { ok: false as const, erro: 'Não foi possível salvar a coleção. Confira o nome (já pode existir uma igual).' }
  if (!uuidValido(projetoId) || !uuidValido(id) || typeof nome !== 'string' || nome.trim().length < 2 || nome.length > 80) return falha
  if (!Number.isInteger(ordem) || ordem < 0 || ordem > 10000) return falha
  if (isDemoMode()) return demo
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('salvar_colecao', { p_id: id, p_projeto: projetoId, p_nome: nome.trim(), p_ordem: ordem })
    if (error || data !== id) return falha
    revalidatePath(`/dashboard/albuns/${projetoId}/compartilhar`)
    return { ok: true as const }
  } catch { return falha }
}

/** Remove só a coleção (a visão); as fotos e os originais ficam intactos. */
export async function removerColecao(projetoId: string, id: string) {
  const falha = { ok: false as const, erro: 'Não foi possível remover a coleção.' }
  if (!uuidValido(projetoId) || !uuidValido(id)) return falha
  if (isDemoMode()) return demo
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('remover_colecao', { p_id: id })
    if (error || data !== true) return falha
    revalidatePath(`/dashboard/albuns/${projetoId}/compartilhar`)
    return { ok: true as const }
  } catch { return falha }
}

/** Estado desejado: a coleção passa a conter exatamente estas fotos. */
export async function definirFotosColecao(projetoId: string, colecaoId: string, fotoIds: string[]) {
  const falha = { ok: false as const, erro: 'Não foi possível atualizar as fotos da coleção.' }
  if (!uuidValido(projetoId) || !uuidValido(colecaoId) || !Array.isArray(fotoIds) || fotoIds.length > 1000 || !fotoIds.every(uuidValido)) return falha
  if (isDemoMode()) return demo
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('definir_fotos_colecao', { p_colecao: colecaoId, p_foto_ids: [...new Set(fotoIds)] })
    if (error || typeof data !== 'number') return falha
    revalidatePath(`/dashboard/albuns/${projetoId}/compartilhar`)
    return { ok: true as const, total: data }
  } catch { return falha }
}

/** Download dos originais pelo portal: desligado por padrão, com validade e limite por acesso. */
export async function definirDownloadGaleria(projetoId: string, liberado: boolean, expiraEm: string | null, limite: number) {
  const falha = { ok: false as const, erro: 'Não foi possível salvar a configuração de download.' }
  if (!uuidValido(projetoId) || typeof liberado !== 'boolean' || !Number.isInteger(limite) || limite < 1 || limite > 5000) return falha
  if (expiraEm !== null && (typeof expiraEm !== 'string' || Number.isNaN(Date.parse(expiraEm)) || Date.parse(expiraEm) <= Date.now())) return falha
  if (isDemoMode()) return demo
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('definir_download_galeria', { p_projeto: projetoId, p_liberado: liberado, p_expira_em: expiraEm, p_limite: limite })
    if (error || data !== true) return falha
    revalidatePath(`/dashboard/albuns/${projetoId}/compartilhar`)
    return { ok: true as const }
  } catch { return falha }
}
