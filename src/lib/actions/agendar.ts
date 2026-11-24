'use server'

import { cookies } from 'next/headers'
import { isDemoMode } from '@/lib/demo-mode'
import { novoSegredo, segredoValido, uuidValido } from '@/lib/portal/segredos'
import { createPublicClient } from '@/lib/supabase/server'
import { emailValido, erroAgenda, instanteValido, nomeValido, slugValido, telefoneValido, type ResultadoAgenda } from '@/lib/agenda/regras'
import { cookieAgenda, hashSegredoReserva, lerSegredoReserva, nomeCookieReserva, nomeCookieTentativa } from '@/lib/agenda/publico'

/**
 * Ações da página pública /agendar (0062). O visitante não tem conta: a posse
 * da reserva é provada por um segredo guardado em cookie httpOnly; o banco só
 * recebe o hash, que também é a chave de idempotência da criação.
 */
const DEMO = { ok: false as const, erro: 'Demonstração: o agendamento não funciona sem o servidor configurado.' }

export type EntradaHold = { slug: string; inicio: string; nome: string; email: string; telefone: string; tentativa: string }

export async function criarHoldPublico(entrada: EntradaHold): Promise<ResultadoAgenda<{ id: string }>> {
  const falha = { ok: false as const, erro: 'Não foi possível reservar o horário. Confira seus dados e tente de novo.' }
  if (!entrada || !slugValido(entrada.slug) || !instanteValido(entrada.inicio) || !nomeValido(entrada.nome)
    || !emailValido(entrada.email) || !telefoneValido(entrada.telefone) || !uuidValido(entrada.tentativa)) return falha
  if (isDemoMode()) return DEMO
  const jar = await cookies()
  // Mesmo clique repetido (retry/duplo envio) reaproveita o segredo e, portanto, a reserva.
  const guardado = jar.get(nomeCookieTentativa(entrada.tentativa))?.value
  const segredo = segredoValido(guardado) ? guardado : novoSegredo()
  try {
    const { data, error } = await createPublicClient().rpc('agenda_criar_hold', {
      p_slug: entrada.slug, p_inicio: entrada.inicio, p_nome: entrada.nome.trim(), p_email: entrada.email.trim().toLowerCase(),
      p_telefone: entrada.telefone.trim() || null, p_token_hash: hashSegredoReserva(segredo),
    })
    if (error || !data || typeof data.id !== 'string') return { ok: false, erro: erroAgenda(error, falha.erro) }
    jar.set(nomeCookieTentativa(entrada.tentativa), segredo, cookieAgenda(24 * 3600))
    jar.set(nomeCookieReserva(data.id), segredo, cookieAgenda(30 * 24 * 3600))
    return { ok: true, id: data.id }
  } catch { return falha }
}

async function comSegredo<T>(id: string, fn: (hash: string) => Promise<T>, falha: { ok: false; erro: string }): Promise<T | { ok: false; erro: string }> {
  if (!uuidValido(id)) return falha
  if (isDemoMode()) return DEMO
  const segredo = await lerSegredoReserva(id)
  if (!segredo) return { ok: false, erro: 'Não encontramos esta reserva neste navegador. Abra o link no mesmo aparelho em que reservou.' }
  try { return await fn(hashSegredoReserva(segredo)) } catch { return falha }
}

export async function confirmarReservaPublica(id: string): Promise<ResultadoAgenda<{ status: string }>> {
  const falha = { ok: false as const, erro: 'Não foi possível confirmar a reserva.' }
  return comSegredo(id, async hash => {
    const { data, error } = await createPublicClient().rpc('agenda_confirmar_publica', { p_id: id, p_token_hash: hash })
    if (error || typeof data !== 'string') return { ok: false as const, erro: erroAgenda(error, falha.erro, { '55000': 'O sinal precisa ser pago antes de confirmar.' }) }
    if (data !== 'confirmada') return { ok: false as const, erro: 'O tempo para confirmar acabou e o horário foi liberado. Escolha outro horário.' }
    return { ok: true as const, status: data }
  }, falha)
}

export async function pagarSinalSimulado(id: string): Promise<ResultadoAgenda<{ status: string }>> {
  const falha = { ok: false as const, erro: 'Não foi possível registrar o sinal.' }
  return comSegredo(id, async hash => {
    const { data, error } = await createPublicClient().rpc('agenda_pagar_sinal_simulado', { p_id: id, p_token_hash: hash })
    if (error || typeof data !== 'string') return { ok: false as const, erro: erroAgenda(error, falha.erro) }
    if (data === 'reembolso_pendente') return { ok: false as const, erro: 'O tempo da reserva já tinha acabado e o horário foi liberado. O sinal será devolvido pelo estúdio.' }
    return { ok: true as const, status: data }
  }, falha)
}

export async function cancelarReservaPublica(id: string): Promise<ResultadoAgenda> {
  const falha = { ok: false as const, erro: 'Não foi possível cancelar a reserva.' }
  return comSegredo(id, async hash => {
    const { data, error } = await createPublicClient().rpc('agenda_cancelar_publica', { p_id: id, p_token_hash: hash })
    if (error || data !== 'cancelada') return { ok: false as const, erro: erroAgenda(error, falha.erro, { '55000': 'O prazo de cancelamento por aqui acabou. Fale com o estúdio.' }) }
    return { ok: true as const }
  }, falha)
}

export async function remarcarReservaPublica(id: string, novoInicio: string): Promise<ResultadoAgenda> {
  const falha = { ok: false as const, erro: 'Não foi possível remarcar. Escolha outro horário.' }
  if (!instanteValido(novoInicio)) return falha
  return comSegredo(id, async hash => {
    const { data, error } = await createPublicClient().rpc('agenda_remarcar_publica', { p_id: id, p_token_hash: hash, p_novo_inicio: novoInicio })
    if (error || typeof data !== 'string') return { ok: false as const, erro: erroAgenda(error, falha.erro, { '55000': 'O prazo de remarcação por aqui acabou. Fale com o estúdio.' }) }
    return { ok: true as const }
  }, falha)
}

/** Slots livres de outra janela de datas, para remarcar. */
export async function listarSlotsParaRemarcar(slug: string, de: string, ate: string): Promise<ResultadoAgenda<{ slots: { slot_inicio: string; slot_fim: string }[] }>> {
  const falha = { ok: false as const, erro: 'Não foi possível carregar os horários.' }
  if (!slugValido(slug) || !/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return falha
  if (isDemoMode()) return DEMO
  try {
    const { data, error } = await createPublicClient().rpc('agenda_listar_slots', { p_slug: slug, p_de: de, p_ate: ate })
    if (error || !Array.isArray(data)) return falha
    return { ok: true, slots: data }
  } catch { return falha }
}
