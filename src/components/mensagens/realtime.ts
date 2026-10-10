'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { EVENTO_MENSAGENS_LIDAS, mapMensagem, type MensagemView } from '@/lib/mensagens'
import type { MensagemRow } from '@/types/database'

/**
 * Supabase Realtime das mensagens (postgres_changes em `mensagens`; o
 * Realtime aplica a RLS de quem assina, então cada um só recebe o que pode
 * ler). Se o canal não sobe (Realtime desligado, rede, token), quem usa cai
 * para consulta periódica — `aoVivo` diz em que modo está.
 */

// Inlined: roda no navegador (NEXT_PUBLIC_* vem embutida no bundle).
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

async function assinar(
  nome: string,
  filtro: string | undefined,
  aoMudar: (row: MensagemRow) => void,
  aoStatus: (aoVivo: boolean) => void,
): Promise<() => void> {
  const supabase = createClient()
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) await supabase.realtime.setAuth(data.session.access_token)
  } catch {
    // Sem sessão no navegador: o canal não recebe nada e o fallback assume.
  }
  let canal: RealtimeChannel | null = supabase
    .channel(nome)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mensagens', ...(filtro ? { filter: filtro } : {}) },
      (payload) => {
        const row = payload.new as Partial<MensagemRow> | undefined
        if (row?.id) aoMudar(row as MensagemRow)
      },
    )
    .subscribe((status) => aoStatus(status === 'SUBSCRIBED'))
  return () => {
    if (canal) void supabase.removeChannel(canal)
    canal = null
  }
}

/** Mensagens novas/apagadas de um fio, ao vivo. */
export function useMensagensAoVivo(conversaId: string, aoReceber: (m: MensagemView) => void): { aoVivo: boolean } {
  const [aoVivo, setAoVivo] = useState(false)
  const handler = useRef(aoReceber)
  useEffect(() => {
    handler.current = aoReceber
  })

  useEffect(() => {
    if (DEMO_MODE) return
    let cancelar: (() => void) | null = null
    let desmontado = false
    void assinar(
      `mensagens:${conversaId}:${Math.random().toString(36).slice(2)}`,
      `conversa_id=eq.${conversaId}`,
      (row) => handler.current(mapMensagem(row)),
      (vivo) => !desmontado && setAoVivo(vivo),
    ).then((fn) => {
      if (desmontado) fn()
      else cancelar = fn
    })
    return () => {
      desmontado = true
      cancelar?.()
      setAoVivo(false)
    }
  }, [conversaId])

  return { aoVivo }
}

// -----------------------------------------------------------------------------
// Contador de não lidas: um único canal e um único contador por aba do
// navegador, compartilhados por todos os selos (menu do celular + desktop).
// -----------------------------------------------------------------------------

type Estado = { total: number; versao: number }
let estado: Estado = { total: 0, versao: 0 }
const ouvintes = new Set<() => void>()
let parar: (() => void) | null = null
let agendado: ReturnType<typeof setTimeout> | null = null

/** `forcar`: chegou mensagem (Realtime) — as listas recarregam mesmo sem mudar o total. */
function emitir(total: number, forcar: boolean) {
  if (!forcar && total === estado.total && estado.versao > 0) return
  estado = { total, versao: estado.versao + 1 }
  ouvintes.forEach((o) => o())
}

async function recontar(forcar = false) {
  try {
    const { data, error } = await createClient().rpc('total_mensagens_nao_lidas')
    if (!error && typeof data === 'number') emitir(data, forcar)
  } catch {
    // Mantém o último valor.
  }
}

let forcarProxima = false
function recontarEmBreve(forcar = false) {
  forcarProxima = forcarProxima || forcar
  if (agendado) clearTimeout(agendado)
  agendado = setTimeout(() => {
    const f = forcarProxima
    forcarProxima = false
    void recontar(f)
  }, 400)
}
const recontarAoAviso = () => recontarEmBreve()

function iniciar() {
  let aoVivo = false
  let poll: ReturnType<typeof setInterval> | null = null
  let cancelarCanal: (() => void) | null = null
  let ativo = true

  const ajustarPoll = () => {
    if (poll) clearInterval(poll)
    // Ao vivo: só um "seguro" lento. Sem Realtime: consulta a cada 30s.
    poll = setInterval(() => {
      if (document.visibilityState === 'visible') void recontar()
    }, aoVivo ? 120_000 : 30_000)
  }
  const aoFocar = () => document.visibilityState === 'visible' && recontarEmBreve()

  void recontar()
  ajustarPoll()
  window.addEventListener(EVENTO_MENSAGENS_LIDAS, recontarAoAviso)
  document.addEventListener('visibilitychange', aoFocar)
  void assinar(
    `mensagens-nao-lidas:${Math.random().toString(36).slice(2)}`,
    undefined,
    () => recontarEmBreve(true),
    (vivo) => {
      if (vivo !== aoVivo) {
        aoVivo = vivo
        ajustarPoll()
      }
    },
  ).then((fn) => {
    if (ativo) cancelarCanal = fn
    else fn()
  })

  return () => {
    ativo = false
    if (poll) clearInterval(poll)
    if (agendado) clearTimeout(agendado)
    window.removeEventListener(EVENTO_MENSAGENS_LIDAS, recontarAoAviso)
    document.removeEventListener('visibilitychange', aoFocar)
    cancelarCanal?.()
  }
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  if (!parar && !DEMO_MODE) parar = iniciar()
  return () => {
    ouvintes.delete(ouvinte)
    if (ouvintes.size === 0 && parar) {
      parar()
      parar = null
    }
  }
}

const SERVIDOR: Estado = { total: 0, versao: 0 }

/** Total de não lidas de quem está logado, ao vivo (com consulta periódica de reserva). */
export function useNaoLidas(): Estado {
  return useSyncExternalStore(inscrever, () => estado, () => SERVIDOR)
}

/** Avise os contadores (ex.: depois de marcar um fio como lido). */
export function avisarMensagensLidas() {
  window.dispatchEvent(new Event(EVENTO_MENSAGENS_LIDAS))
}
