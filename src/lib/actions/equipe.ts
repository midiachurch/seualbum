'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'

const PAPEIS = ['admin', 'editor', 'visualizador'] as const
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/

/**
 * Adiciona alguém já cadastrado à equipe (0051). Quem pode e quais papéis são
 * decididos no banco pela sessão; aqui só se valida a forma da entrada.
 */
export async function adicionarMembroEquipe(organizacaoId: string, email: string, papel: string) {
  const falha = { ok: false as const, erro: 'Não foi possível adicionar a pessoa. Confira o e-mail e o papel.' }
  if (!uuidValido(organizacaoId) || typeof email !== 'string' || email.length > 254 || !EMAIL.test(email.trim())) return falha
  if (!(PAPEIS as readonly string[]).includes(papel)) return falha
  if (isDemoMode()) return { ok: false as const, erro: 'Demonstração: a equipe não será gravada no servidor.' }
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('adicionar_membro_organizacao', {
      p_org: organizacaoId, p_email: email.trim(), p_papel: papel as (typeof PAPEIS)[number],
    })
    if (error || typeof data !== 'string') return falha
    revalidatePath('/dashboard/equipe')
    return { ok: true as const }
  } catch { return falha }
}

export async function removerMembroEquipe(organizacaoId: string, userId: string) {
  const falha = { ok: false as const, erro: 'Não foi possível remover a pessoa.' }
  if (!uuidValido(organizacaoId) || !uuidValido(userId)) return falha
  if (isDemoMode()) return { ok: false as const, erro: 'Demonstração: a equipe não será gravada no servidor.' }
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('remover_membro_organizacao', { p_org: organizacaoId, p_user: userId })
    if (error || data !== true) return falha
    revalidatePath('/dashboard/equipe')
    return { ok: true as const }
  } catch { return falha }
}
