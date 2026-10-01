'use server'

import { revalidatePath } from 'next/cache'
import { requireModuleAction } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'
import type { NotificacaoCrmStatus } from '@/types/database'

/**
 * CRM de retenção (migration 0024). A detecção roda sozinha todo dia às 09:00
 * de Brasília (pg_cron); estas ações são o lado da gestão. O banco confere o
 * papel (admin/gestor) — aqui só se evita uma ida à toa.
 */

type Resultado<T = undefined> = { ok: true; dados?: T } | { ok: false; erro: string }

const STATUS_VALIDOS: NotificacaoCrmStatus[] = ['aberta', 'contatado', 'resolvida', 'dispensada']

export async function marcarAlertaCrm(id: string, status: NotificacaoCrmStatus): Promise<Resultado> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  if (!STATUS_VALIDOS.includes(status)) return { ok: false, erro: 'Status inválido.' }
  const { supabase } = await requireModuleAction('clientes', 'editar')
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { error } = await supabase.rpc('marcar_alerta_crm', { p_id: id, p_status: status })
  if (error) {
    console.error('[marcarAlertaCrm]', error.message)
    return { ok: false, erro: 'Não foi possível atualizar o alerta. Tente de novo.' }
  }
  revalidatePath('/admin')
  return { ok: true }
}

/** "Atualizar agora": roda a mesma detecção do cron, na hora. */
export async function rodarAlertasCrm(): Promise<Resultado<{ novos: number; resolvidos: number }>> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const { supabase } = await requireModuleAction('clientes', 'editar')
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { data, error } = await supabase.rpc('rodar_alertas_crm')
  if (error || !data) {
    if (error) console.error('[rodarAlertasCrm]', error.message)
    return { ok: false, erro: 'Não foi possível atualizar os alertas agora.' }
  }
  revalidatePath('/admin')
  return {
    ok: true,
    dados: { novos: data.novos_sem_pedido_7d + data.novos_assinante_sem_projeto_mes, resolvidos: data.resolvidos_automaticamente },
  }
}
