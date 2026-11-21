'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { hashPortal, novoSegredo, segredoValido, uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'

const PAPEIS = ['admin', 'editor', 'visualizador'] as const
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
// Separa o hash do convite de qualquer outro uso do mesmo algoritmo.
const hashConvite = (token: string) => hashPortal(`convite:${token}`)

/**
 * Cria um convite por link (0053). O segredo nasce aqui e só o hash vai ao
 * banco; o link completo é devolvido uma única vez e não pode ser relido.
 * Reemitir para o mesmo e-mail invalida o link anterior.
 */
export async function criarConviteEquipe(organizacaoId: string, email: string, papel: string) {
  const falha = { ok: false as const, erro: 'Não foi possível criar o convite. Confira o e-mail e o papel.' }
  if (!uuidValido(organizacaoId) || typeof email !== 'string' || email.length > 254 || !EMAIL.test(email.trim())) return falha
  if (!(PAPEIS as readonly string[]).includes(papel)) return falha
  if (isDemoMode()) return { ok: false as const, erro: 'Demonstração: o convite não será gravado no servidor.' }
  const { supabase } = await requireUser()
  if (!supabase) return falha
  const token = novoSegredo()
  try {
    const { data, error } = await supabase.rpc('criar_convite_organizacao', {
      p_org: organizacaoId, p_email: email.trim(), p_papel: papel as (typeof PAPEIS)[number], p_token_hash: hashConvite(token),
    })
    if (error || typeof data !== 'string') return falha
    revalidatePath('/dashboard/equipe')
    return { ok: true as const, caminho: `/dashboard/convite/${token}` }
  } catch { return falha }
}

export async function revogarConviteEquipe(id: string) {
  const falha = { ok: false as const, erro: 'Não foi possível revogar o convite.' }
  if (!uuidValido(id)) return falha
  if (isDemoMode()) return { ok: false as const, erro: 'Demonstração: nada será gravado no servidor.' }
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('revogar_convite_organizacao', { p_id: id })
    if (error || data !== true) return falha
    revalidatePath('/dashboard/equipe')
    return { ok: true as const }
  } catch { return falha }
}

/** Mensagem única para qualquer convite inválido: não permite sondar links. */
export async function aceitarConviteEquipe(token: string) {
  const falha = { ok: false as const, erro: 'Convite inválido ou expirado. Peça um novo link a quem convidou.' }
  if (!segredoValido(token)) return falha
  if (isDemoMode()) return { ok: false as const, erro: 'Demonstração: o convite não será aceito no servidor.' }
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('aceitar_convite_organizacao', { p_token_hash: hashConvite(token) })
    if (error || typeof data !== 'string') return falha
    revalidatePath('/dashboard/equipe')
    return { ok: true as const }
  } catch { return falha }
}
