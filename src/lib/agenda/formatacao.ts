/** Formatação de datas no fuso do RECURSO (nunca do servidor ou do navegador). */

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const

const partes = (iso: string | number | Date, fuso: string, opcoes: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, ...opcoes }).format(new Date(iso))

/** AAAA-MM-DD do instante no fuso informado. */
export function chaveDia(iso: string | number | Date, fuso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

export const hojeNoFuso = (fuso: string, agora: number = Date.now()) => chaveDia(agora, fuso)

export function somarDias(dataIso: string, n: number): string {
  const d = new Date(`${dataIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const rotuloHora = (iso: string, fuso: string) => partes(iso, fuso, { hour: '2-digit', minute: '2-digit', hour12: false })
export const rotuloDia = (iso: string | number | Date, fuso: string) => partes(iso, fuso, { weekday: 'short', day: '2-digit', month: 'short' })
export const rotuloDataHora = (iso: string, fuso: string) =>
  partes(iso, fuso, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

export function formatarReais(centavos: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos ?? 0) / 100)
}

export type SlotLivre = { slot_inicio: string; slot_fim: string }
export type GrupoDeSlots = { dia: string; rotulo: string; slots: { inicio: string; hora: string }[] }

/** Agrupa slots por dia LOCAL do recurso, preservando a ordem. */
export function agruparSlotsPorDia(slots: SlotLivre[], fuso: string): GrupoDeSlots[] {
  const grupos = new Map<string, GrupoDeSlots>()
  for (const s of [...slots].sort((a, b) => Date.parse(a.slot_inicio) - Date.parse(b.slot_inicio))) {
    const dia = chaveDia(s.slot_inicio, fuso)
    const g = grupos.get(dia) ?? { dia, rotulo: rotuloDia(s.slot_inicio, fuso), slots: [] }
    g.slots.push({ inicio: s.slot_inicio, hora: rotuloHora(s.slot_inicio, fuso) })
    grupos.set(dia, g)
  }
  return [...grupos.values()]
}

/** Lê o `tstzrange` textual do PostgREST (`["2026-11-26 03:00:00+00","2026-11-27 03:00:00+00")`). */
export function lerPeriodo(periodo: string): { inicio: string; fim: string } | null {
  const m = /^[[(]"?([^",]+)"?,\s*"?([^")\]]+)"?[)\]]$/.exec(periodo.trim())
  if (!m) return null
  const iso = (t: string) => new Date(t.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')).toISOString()
  try { return { inicio: iso(m[1]), fim: iso(m[2]) } } catch { return null }
}

/** Deslocamento (ms) do fuso em relação ao UTC no instante dado. */
function deslocamentoDoFuso(instante: number, fuso: string): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instante))
  const n = (t: string) => Number(p.find(x => x.type === t)?.value)
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - Math.floor(instante / 1000) * 1000
}

/**
 * Converte um horário de relógio local do recurso (`2026-11-26T14:30`, como o
 * `datetime-local` entrega) no instante UTC correto, mesmo em dia de horário de
 * verão. Horário inexistente no salto avança para o primeiro horário válido.
 */
export function instanteLocal(dataHora: string, fuso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dataHora)
  if (!m) return null
  const alvo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  let palpite = alvo - deslocamentoDoFuso(alvo, fuso)
  palpite = alvo - deslocamentoDoFuso(palpite, fuso)
  // Se o relógio local não bate com o pedido, o horário não existe (salto): avança o tempo do salto.
  if (palpite + deslocamentoDoFuso(palpite, fuso) !== alvo) palpite += 3600_000
  const d = new Date(palpite)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Hora do banco (`09:00:00`) para o campo (`09:00`). */
export const horaCurta = (t: string) => t.slice(0, 5)

/** Nome amigável do fuso para o visitante conferir (ex.: America/Sao_Paulo → Sao Paulo). */
export const nomeDoFuso = (fuso: string) => fuso.split('/').pop()?.replace(/_/g, ' ') ?? fuso
