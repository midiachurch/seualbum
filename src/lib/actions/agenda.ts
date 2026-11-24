'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { hashPortal, novoSegredo, uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'
import {
  TIPOS_RECURSO, emailValido, erroAgenda, instanteValido, janelasValidas, nomeValido, slugValido, telefoneValido,
  type JanelaSemanal, type ResultadoAgenda,
} from '@/lib/agenda/regras'
import type { AgendaTipoRecurso } from '@/types/database'

/**
 * Painel do estúdio (0060-0061). Quem pode o quê é decidido no banco pela
 * sessão (papel na organização); aqui só se valida a forma da entrada e se
 * traduz o erro sem expor detalhe interno.
 */
const CAMINHO = '/dashboard/agenda'
const DEMO = { ok: false as const, erro: 'Demonstração: a agenda não será gravada no servidor.' }

export type DadosRecurso = {
  nome: string; slug: string; tipo: string; descricao: string; fuso: string
  duracaoMin: number; bufferMin: number; intervaloMin: number
  antecedenciaMinMin: number; antecedenciaMaxDias: number; cancelamentoAntecedenciaH: number
  sinalCentavos: number | null; publicado: boolean
}

const inteiro = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

export async function salvarRecursoAgenda(organizacaoId: string, recursoId: string | null, d: DadosRecurso): Promise<ResultadoAgenda<{ id: string }>> {
  const falha = { ok: false as const, erro: 'Não foi possível salvar o recurso. Confira os campos.' }
  if (!uuidValido(organizacaoId) || (recursoId !== null && !uuidValido(recursoId)) || !d || typeof d !== 'object') return falha
  const slug = typeof d.slug === 'string' ? d.slug.trim().toLowerCase() : ''
  if (!nomeValido(d.nome) || !slugValido(slug) || !(TIPOS_RECURSO as readonly string[]).includes(d.tipo)
    || typeof d.descricao !== 'string' || d.descricao.length > 1000 || typeof d.fuso !== 'string' || d.fuso.length < 3 || d.fuso.length > 64
    || !inteiro(d.duracaoMin, 5, 720) || !inteiro(d.bufferMin, 0, 240) || !inteiro(d.intervaloMin, 5, 240)
    || !inteiro(d.antecedenciaMinMin, 0, 20160) || !inteiro(d.antecedenciaMaxDias, 1, 365) || !inteiro(d.cancelamentoAntecedenciaH, 0, 720)
    || (d.sinalCentavos !== null && !inteiro(d.sinalCentavos, 0, 10_000_000)) || typeof d.publicado !== 'boolean') return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('agenda_salvar_recurso', {
      p_org: organizacaoId, p_id: recursoId, p_nome: d.nome.trim(), p_slug: slug, p_tipo: d.tipo as AgendaTipoRecurso,
      p_descricao: d.descricao.trim() || null, p_fuso: d.fuso, p_duracao_min: d.duracaoMin, p_buffer_min: d.bufferMin,
      p_intervalo_min: d.intervaloMin, p_antecedencia_min_min: d.antecedenciaMinMin, p_antecedencia_max_dias: d.antecedenciaMaxDias,
      p_cancelamento_antecedencia_h: d.cancelamentoAntecedenciaH, p_sinal_centavos: d.sinalCentavos, p_publicado: d.publicado,
    })
    if (error || typeof data !== 'string') {
      return { ok: false, erro: erroAgenda(error, 'Não foi possível salvar o recurso. Confira o fuso, o endereço e os números.') }
    }
    revalidatePath(CAMINHO)
    return { ok: true, id: data }
  } catch { return falha }
}

export async function arquivarRecursoAgenda(recursoId: string): Promise<ResultadoAgenda> {
  const falha = { ok: false as const, erro: 'Não foi possível arquivar o recurso.' }
  if (!uuidValido(recursoId)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('agenda_arquivar_recurso', { p_recurso: recursoId })
    if (error || data !== true) return { ok: false, erro: erroAgenda(error, falha.erro) }
    revalidatePath(CAMINHO)
    return { ok: true }
  } catch { return falha }
}

export async function definirDisponibilidadeAgenda(recursoId: string, janelas: JanelaSemanal[]): Promise<ResultadoAgenda> {
  const falha = { ok: false as const, erro: 'Não foi possível salvar os horários. Confira se não há janelas sobrepostas.' }
  if (!uuidValido(recursoId) || !janelasValidas(janelas)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('agenda_definir_disponibilidade', { p_recurso: recursoId, p_janelas: janelas })
    if (error || typeof data !== 'number') return { ok: false, erro: erroAgenda(error, falha.erro) }
    revalidatePath(CAMINHO)
    return { ok: true }
  } catch { return falha }
}

export async function criarBloqueioAgenda(recursoId: string, inicio: string, fim: string, motivo: string): Promise<ResultadoAgenda> {
  const falha = { ok: false as const, erro: 'Não foi possível criar o bloqueio. Confira as datas.' }
  if (!uuidValido(recursoId) || !instanteValido(inicio) || !instanteValido(fim) || Date.parse(fim) <= Date.parse(inicio)
    || typeof motivo !== 'string' || motivo.length > 200) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('agenda_criar_bloqueio', { p_recurso: recursoId, p_inicio: inicio, p_fim: fim, p_motivo: motivo.trim() || null })
    if (error || typeof data !== 'string') return { ok: false, erro: erroAgenda(error, falha.erro) }
    revalidatePath(CAMINHO)
    return { ok: true }
  } catch { return falha }
}

export async function removerBloqueioAgenda(id: string): Promise<ResultadoAgenda> {
  const falha = { ok: false as const, erro: 'Não foi possível remover o bloqueio.' }
  if (!uuidValido(id)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('agenda_remover_bloqueio', { p_id: id })
    if (error || data !== true) return { ok: false, erro: erroAgenda(error, falha.erro) }
    revalidatePath(CAMINHO)
    return { ok: true }
  } catch { return falha }
}

/** Reserva feita pelo estúdio (telefone/balcão): já nasce confirmada. A chave nasce aqui; só o hash vai ao banco. */
export async function reservarPeloEstudio(recursoId: string, inicio: string, nome: string, email: string, telefone: string): Promise<ResultadoAgenda<{ id: string }>> {
  const falha = { ok: false as const, erro: 'Não foi possível reservar. Confira nome, e-mail e horário.' }
  if (!uuidValido(recursoId) || !instanteValido(inicio) || !nomeValido(nome) || !emailValido(email) || !telefoneValido(telefone)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('agenda_reservar_estudio', {
      p_recurso: recursoId, p_inicio: inicio, p_nome: nome.trim(), p_email: email.trim().toLowerCase(),
      p_telefone: telefone.trim() || null, p_token_hash: hashPortal(`agenda:${novoSegredo()}`),
    })
    if (error || typeof data !== 'string') return { ok: false, erro: erroAgenda(error, falha.erro) }
    revalidatePath(CAMINHO)
    return { ok: true, id: data }
  } catch { return falha }
}

type Operacao = 'confirmar' | 'concluir' | 'sinal' | 'reembolso' | 'vincular'

async function operar(id: string, op: Operacao): Promise<ResultadoAgenda> {
  const falha = { ok: false as const, erro: 'Não foi possível concluir a operação.' }
  if (!uuidValido(id)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    if (op === 'confirmar') {
      const { data, error } = await supabase.rpc('agenda_confirmar', { p_id: id })
      if (error) return { ok: false, erro: erroAgenda(error, falha.erro) }
      if (data !== 'confirmada') return { ok: false, erro: 'O tempo desta reserva acabou: ela expirou e o horário foi liberado.' }
    } else if (op === 'concluir') {
      const { data, error } = await supabase.rpc('agenda_concluir', { p_id: id })
      if (error || data !== 'concluida') return { ok: false, erro: erroAgenda(error, falha.erro, { '55000': 'Só dá para concluir uma reserva confirmada que já começou.' }) }
    } else if (op === 'sinal') {
      const { data, error } = await supabase.rpc('agenda_registrar_sinal', { p_id: id })
      if (error || typeof data !== 'string') return { ok: false, erro: erroAgenda(error, falha.erro) }
    } else if (op === 'reembolso') {
      const { data, error } = await supabase.rpc('agenda_registrar_reembolso', { p_id: id })
      if (error || data !== true) return { ok: false, erro: erroAgenda(error, falha.erro, { '55000': 'Não há reembolso pendente nesta reserva.' }) }
    } else {
      const { data, error } = await supabase.rpc('agenda_vincular_cliente', { p_id: id })
      if (error || typeof data !== 'string') return { ok: false, erro: erroAgenda(error, falha.erro, { '55000': 'Confirme a reserva antes de vincular ao cadastro de clientes.' }) }
    }
    revalidatePath(CAMINHO)
    return { ok: true }
  } catch { return falha }
}

export async function confirmarReservaEstudio(id: string) { return operar(id, 'confirmar') }
export async function concluirReservaEstudio(id: string) { return operar(id, 'concluir') }
export async function registrarSinalEstudio(id: string) { return operar(id, 'sinal') }
export async function registrarReembolsoEstudio(id: string) { return operar(id, 'reembolso') }
export async function vincularClienteReserva(id: string) { return operar(id, 'vincular') }

export async function cancelarReservaEstudio(id: string, motivo: string): Promise<ResultadoAgenda> {
  const falha = { ok: false as const, erro: 'Não foi possível cancelar a reserva.' }
  if (!uuidValido(id) || typeof motivo !== 'string' || motivo.length > 300) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('agenda_cancelar', { p_id: id, p_motivo: motivo.trim() || null })
    if (error || data !== 'cancelada') return { ok: false, erro: erroAgenda(error, falha.erro, { '55000': 'Esta reserva não pode mais ser cancelada.' }) }
    revalidatePath(CAMINHO)
    return { ok: true }
  } catch { return falha }
}

export async function remarcarReservaEstudio(id: string, novoInicio: string): Promise<ResultadoAgenda> {
  const falha = { ok: false as const, erro: 'Não foi possível remarcar. Escolha outro horário.' }
  if (!uuidValido(id) || !instanteValido(novoInicio)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('agenda_remarcar', { p_id: id, p_novo_inicio: novoInicio })
    if (error || typeof data !== 'string') return { ok: false, erro: erroAgenda(error, falha.erro, { '55000': 'Só reservas confirmadas podem ser remarcadas.' }) }
    revalidatePath(CAMINHO)
    return { ok: true }
  } catch { return falha }
}

/** Slots livres para o estúdio escolher ao reservar/remarcar (ignora antecedência mínima e máxima). */
export async function listarSlotsEstudio(recursoId: string, de: string, ate: string): Promise<ResultadoAgenda<{ slots: { slot_inicio: string; slot_fim: string }[] }>> {
  const falha = { ok: false as const, erro: 'Não foi possível carregar os horários.' }
  if (!uuidValido(recursoId) || !/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('agenda_listar_slots_estudio', { p_recurso: recursoId, p_de: de, p_ate: ate })
    if (error || !Array.isArray(data)) return { ok: false, erro: erroAgenda(error, falha.erro, { '22023': 'Período inválido (máximo de 62 dias).' }) }
    return { ok: true, slots: data }
  } catch { return falha }
}
