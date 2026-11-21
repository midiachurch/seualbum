'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'
import { chaveValida, mensagemDeErro, normalizarPrazo, type Resultado } from '@/lib/studio/erros'
import { PRIORIDADES } from '@/lib/studio/constantes'
import type { StudioPrioridade, StudioStatusTarefa } from '@/types/database'

/**
 * Tarefas e próxima ação (0081). Responsável precisa ser membro ativo e só o
 * responsável (editor) ou dono/admin altera — decisões do banco. Aqui só se
 * valida a forma e se esconde erro interno.
 */
const DEMO = { ok: false as const, erro: 'Demonstração: as tarefas não serão gravadas no servidor.' }
const STATUS: readonly StudioStatusTarefa[] = ['aberta', 'concluida', 'cancelada']

export type EntradaTarefa = {
  organizacaoId: string
  chave: string
  titulo: string
  responsavelId?: string | null
  prazo?: string | null
  prioridade?: string
  clienteId?: string | null
  negocioId?: string | null
  projetoId?: string | null
  orcamentoId?: string | null
  descricao?: string | null
}

export async function criarTarefaStudio(e: EntradaTarefa): Promise<Resultado<{ id: string }>> {
  const falha = { ok: false as const, erro: 'Não foi possível criar a tarefa. Confira os dados.' }
  const prioridade = (e?.prioridade ?? 'media') as StudioPrioridade
  const prazo = normalizarPrazo(e?.prazo)
  if (!uuidValido(e?.organizacaoId) || !chaveValida(e.chave) || typeof e.titulo !== 'string') return falha
  if (e.titulo.trim().length < 2 || e.titulo.trim().length > 200 || !PRIORIDADES.includes(prioridade) || prazo === undefined) return falha
  for (const id of [e.responsavelId, e.clienteId, e.negocioId, e.projetoId, e.orcamentoId]) if (id && !uuidValido(id)) return falha
  if ((e.descricao ?? '').length > 2000) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('criar_tarefa_studio', {
      p_org: e.organizacaoId, p_chave: e.chave, p_titulo: e.titulo.trim(), p_responsavel: e.responsavelId || null, p_prazo: prazo,
      p_prioridade: prioridade, p_cliente: e.clienteId || null, p_negocio: e.negocioId || null, p_projeto: e.projetoId || null,
      p_orcamento: e.orcamentoId || null, p_descricao: e.descricao?.trim() || null,
    })
    if (error || typeof data !== 'string') return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true, id: data }
  } catch { return falha }
}

export async function atualizarTarefaStudio(
  id: string,
  d: { titulo: string; responsavelId: string; prazo?: string | null; prioridade: string; descricao?: string | null },
): Promise<Resultado> {
  const falha = { ok: false as const, erro: 'Não foi possível atualizar a tarefa.' }
  const prazo = normalizarPrazo(d?.prazo)
  if (!uuidValido(id) || !uuidValido(d?.responsavelId) || typeof d.titulo !== 'string') return falha
  if (d.titulo.trim().length < 2 || d.titulo.trim().length > 200 || !PRIORIDADES.includes(d.prioridade as StudioPrioridade) || prazo === undefined) return falha
  if ((d.descricao ?? '').length > 2000) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('atualizar_tarefa_studio', {
      p_id: id, p_titulo: d.titulo.trim(), p_responsavel: d.responsavelId, p_prazo: prazo,
      p_prioridade: d.prioridade as StudioPrioridade, p_descricao: d.descricao?.trim() || null,
    })
    if (error || data !== true) return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true }
  } catch { return falha }
}

/** Concluir/cancelar/reabrir. Repetir o mesmo status é sucesso sem efeito. */
export async function mudarStatusTarefaStudio(id: string, status: string): Promise<Resultado<{ mudou: boolean }>> {
  const falha = { ok: false as const, erro: 'Não foi possível atualizar a tarefa.' }
  if (!uuidValido(id) || !STATUS.includes(status as StudioStatusTarefa)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('mudar_status_tarefa_studio', { p_id: id, p_status: status as StudioStatusTarefa })
    if (error || typeof data !== 'boolean') return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true, mudou: data }
  } catch { return falha }
}
