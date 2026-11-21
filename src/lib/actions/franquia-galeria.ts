'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'

const SLUG = /^[a-z0-9-]{2,40}$/

/**
 * Escolhe o plano simulado da galeria (migration 0050). Não cobra nem bloqueia
 * nada: só registra a escolha e passa a medir o consumo contra a franquia.
 * Quem é o fotógrafo vem da sessão, nunca do argumento.
 */
export async function escolherPlanoGaleria(chave: string, plano: string) {
  const falha = { ok: false as const, erro: 'Não foi possível escolher o plano. Tente novamente.' }
  if (!uuidValido(chave) || typeof plano !== 'string' || !SLUG.test(plano)) return falha
  if (isDemoMode()) return { ok: false as const, erro: 'Demonstração: o plano não será gravado no servidor.' }
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('escolher_plano_galeria', { p_chave: chave, p_plano: plano })
    if (error || typeof data !== 'string') return falha
    revalidatePath('/dashboard/galerias')
    return { ok: true as const }
  } catch { return falha }
}
