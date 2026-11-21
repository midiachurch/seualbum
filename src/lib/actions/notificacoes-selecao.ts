'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'

export async function marcarNotificacaoSelecaoLida(id: string) {
  const falha = { ok: false as const, erro: 'Não foi possível atualizar a notificação.' }
  if (!uuidValido(id) || isDemoMode()) return falha
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('marcar_notificacao_selecao_lida', { p_id: id })
    if (error || data !== true) return falha
    revalidatePath('/dashboard/galerias')
    return { ok: true as const }
  } catch { return falha }
}
