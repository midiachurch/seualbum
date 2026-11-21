'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'
import { chaveValida, mensagemDeErro, type Resultado } from '@/lib/studio/erros'
import { CANAIS, FINALIDADES } from '@/lib/studio/constantes'
import { variaveisValidas } from '@/lib/studio/modelos'
import { adaptadorRegistro, processarFila, type ClienteFila, type ResumoFila } from '@/lib/studio/outbox'
import type { StudioCanal, StudioFinalidadeModelo, StudioPreviaRow } from '@/types/database'

/**
 * Comunicação do Estúdio (0082/0083). NENHUM envio real: a prévia só
 * renderiza texto e a fila só passa pelo adaptador `registro` (simulação).
 */
const DEMO = { ok: false as const, erro: 'Demonstração: nada será gravado no servidor.' }

export type EntradaModelo = {
  organizacaoId: string
  id?: string | null
  nome: string
  finalidade: string
  canal: string
  assunto: string
  corpo: string
  ativo: boolean
}

export async function salvarModeloStudio(e: EntradaModelo): Promise<Resultado<{ id: string }>> {
  const falha = { ok: false as const, erro: 'Não foi possível salvar o modelo. Confira o nome e as variáveis.' }
  if (!uuidValido(e?.organizacaoId) || (e.id != null && e.id !== '' && !uuidValido(e.id))) return falha
  if (typeof e.nome !== 'string' || e.nome.trim().length < 2 || e.nome.trim().length > 80) return falha
  if (!FINALIDADES.includes(e.finalidade as StudioFinalidadeModelo) || !CANAIS.includes(e.canal as StudioCanal)) return falha
  if (typeof e.assunto !== 'string' || e.assunto.length > 200 || typeof e.corpo !== 'string') return falha
  if (e.corpo.trim().length < 1 || e.corpo.length > 4000 || !variaveisValidas(e.assunto) || !variaveisValidas(e.corpo)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('salvar_modelo_studio', {
      p_org: e.organizacaoId, p_id: e.id || null, p_nome: e.nome.trim(), p_finalidade: e.finalidade as StudioFinalidadeModelo,
      p_canal: e.canal as StudioCanal, p_assunto: e.assunto, p_corpo: e.corpo, p_ativo: e.ativo !== false,
    })
    if (error || typeof data !== 'string') return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true, id: data }
  } catch { return falha }
}

/** Prévia: renderiza no servidor e NÃO envia nem enfileira. */
export async function previaModeloStudio(
  organizacaoId: string, modeloId: string, clienteId?: string | null, negocioId?: string | null,
): Promise<Resultado<{ previa: StudioPreviaRow }>> {
  const falha = { ok: false as const, erro: 'Não foi possível gerar a prévia.' }
  if (!uuidValido(organizacaoId) || !uuidValido(modeloId)) return falha
  for (const id of [clienteId, negocioId]) if (id && !uuidValido(id)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('renderizar_modelo_studio', {
      p_org: organizacaoId, p_modelo: modeloId, p_cliente: clienteId || null, p_negocio: negocioId || null,
    })
    const previa = Array.isArray(data) ? data[0] : null
    if (error || !previa) return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    return { ok: true, previa }
  } catch { return falha }
}

export type EntradaMensagem = {
  organizacaoId: string
  chave: string
  canal: string
  clienteId: string
  modeloId?: string | null
  assunto?: string | null
  corpo?: string | null
  negocioId?: string | null
}

/** Coloca na fila (NÃO envia). Idempotente pela chave: retry devolve o mesmo item. */
export async function enfileirarMensagemStudio(e: EntradaMensagem): Promise<Resultado<{ id: string }>> {
  const falha = { ok: false as const, erro: 'Não foi possível colocar a mensagem na fila.' }
  if (!uuidValido(e?.organizacaoId) || !uuidValido(e.clienteId) || !chaveValida(e.chave) || !CANAIS.includes(e.canal as StudioCanal)) return falha
  for (const id of [e.modeloId, e.negocioId]) if (id && !uuidValido(id)) return falha
  if (!e.modeloId) {
    if (typeof e.corpo !== 'string' || e.corpo.trim().length < 1 || e.corpo.length > 4000 || (e.assunto ?? '').length > 200) return falha
    if (!variaveisValidas(e.corpo) || !variaveisValidas(e.assunto ?? '')) return falha
  }
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('enfileirar_mensagem_studio', {
      p_org: e.organizacaoId, p_chave: e.chave, p_canal: e.canal as StudioCanal, p_cliente: e.clienteId,
      p_modelo: e.modeloId || null, p_assunto: e.modeloId ? null : e.assunto ?? '', p_corpo: e.modeloId ? null : e.corpo ?? null,
      p_negocio: e.negocioId || null,
    })
    if (error || typeof data !== 'string') return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true, id: data }
  } catch { return falha }
}

/** Processa a fila com o adaptador registro: grava o que seria enviado e marca como simulada. */
export async function processarFilaStudio(organizacaoId: string): Promise<Resultado<{ resumo: ResumoFila }>> {
  const falha = { ok: false as const, erro: 'Não foi possível processar a fila agora.' }
  if (!uuidValido(organizacaoId)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const resumo = await processarFila(supabase as unknown as ClienteFila, organizacaoId, adaptadorRegistro, 20)
    revalidatePath('/dashboard/estudio')
    return { ok: true, resumo }
  } catch { return falha }
}

export async function cancelarSaidaStudio(id: string): Promise<Resultado> {
  const falha = { ok: false as const, erro: 'Não foi possível cancelar o item.' }
  if (!uuidValido(id)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('cancelar_outbox_studio', { p_id: id })
    if (error || typeof data !== 'boolean') return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return data ? { ok: true } : { ok: false, erro: 'Este item não pode mais ser cancelado.' }
  } catch { return falha }
}

export async function reenfileirarSaidaStudio(id: string): Promise<Resultado> {
  const falha = { ok: false as const, erro: 'Não foi possível reenfileirar o item.' }
  if (!uuidValido(id)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('reenfileirar_outbox_studio', { p_id: id })
    if (error || typeof data !== 'boolean') return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return data ? { ok: true } : { ok: false, erro: 'Só itens que falharam podem ser reenfileirados.' }
  } catch { return falha }
}

/** Automações manuais: só GERAM itens na fila (nunca enviam). */
export async function rodarAutomacoesStudio(organizacaoId: string): Promise<Resultado<{ lembretes: number; followups: number }>> {
  const falha = { ok: false as const, erro: 'Não foi possível rodar as automações agora.' }
  if (!uuidValido(organizacaoId)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('rodar_automacoes_studio', { p_org: organizacaoId })
    if (error || !data) return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true, lembretes: data.lembretes_tarefa, followups: data.followups_proposta }
  } catch { return falha }
}

export async function definirOptoutStudio(organizacaoId: string, clienteId: string, canal: string, ativo: boolean): Promise<Resultado> {
  const falha = { ok: false as const, erro: 'Não foi possível atualizar a preferência do cliente.' }
  if (!uuidValido(organizacaoId) || !uuidValido(clienteId) || !CANAIS.includes(canal as StudioCanal) || typeof ativo !== 'boolean') return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('definir_optout_studio', { p_org: organizacaoId, p_cliente: clienteId, p_canal: canal as StudioCanal, p_ativo: ativo })
    if (error || data !== true) return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true }
  } catch { return falha }
}

export async function definirFollowupDiasStudio(organizacaoId: string, dias: number): Promise<Resultado> {
  const falha = { ok: false as const, erro: 'Informe um prazo entre 1 e 60 dias.' }
  if (!uuidValido(organizacaoId) || !Number.isInteger(dias) || dias < 1 || dias > 60) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('definir_followup_dias_studio', { p_org: organizacaoId, p_dias: dias })
    if (error || data !== dias) return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true }
  } catch { return falha }
}
