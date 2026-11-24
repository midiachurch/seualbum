/** Regras puras do Booking (0060-0062): validação de entrada e tradução de erros do banco. */

export const EMAIL_AGENDA = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
export const SLUG_AGENDA = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/
export const TIPOS_RECURSO = ['pessoa', 'equipamento', 'espaco'] as const
export const ROTULO_TIPO: Record<(typeof TIPOS_RECURSO)[number], string> = { pessoa: 'Pessoa', equipamento: 'Equipamento', espaco: 'Espaço' }

export type ResultadoAgenda<T extends object = object> = ({ ok: true } & T) | { ok: false; erro: string }

export const slugValido = (v: unknown): v is string => typeof v === 'string' && SLUG_AGENDA.test(v)
export const emailValido = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && EMAIL_AGENDA.test(v.trim())
export const nomeValido = (v: unknown): v is string => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 120
export const telefoneValido = (v: unknown): boolean => v == null || v === '' || (typeof v === 'string' && v.length <= 30 && /^[0-9+()\-\s]{6,30}$/.test(v))

/** Data AAAA-MM-DD existente no calendário. */
export function dataIsoValida(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Instante ISO 8601 com fuso (o que o PostgREST devolve e o banco aceita). */
export function instanteValido(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 20 && v.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v))
}

export const HORA_AGENDA = /^([01]\d|2[0-3]):[0-5]\d$/
export type JanelaSemanal = { dia: number; inicio: string; fim: string }

/** Valida a grade semanal antes de enviar (o banco valida de novo). Aceita fim 24:00. */
export function janelasValidas(v: unknown): v is JanelaSemanal[] {
  if (!Array.isArray(v) || v.length > 70) return false
  const porDia = new Map<number, JanelaSemanal[]>()
  for (const j of v) {
    if (!j || typeof j !== 'object') return false
    const { dia, inicio, fim } = j as JanelaSemanal
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) return false
    if (typeof inicio !== 'string' || !HORA_AGENDA.test(inicio) || typeof fim !== 'string' || !(HORA_AGENDA.test(fim) || fim === '24:00')) return false
    if (fim <= inicio) return false
    const lista = porDia.get(dia) ?? []
    if (lista.some(o => o.inicio < fim && inicio < o.fim)) return false
    lista.push({ dia, inicio, fim })
    porDia.set(dia, lista)
  }
  return true
}

type ErroBanco = { code?: string | null } | null | undefined

/**
 * Traduz o código SQLSTATE em mensagem segura. Nunca repassa `error.message`:
 * detalhes internos não vazam para a tela.
 */
export function erroAgenda(error: ErroBanco, padrao: string, especificos: Partial<Record<string, string>> = {}): string {
  const code = error?.code ?? ''
  if (especificos[code]) return especificos[code] as string
  switch (code) {
    case '23P01': return 'Esse horário acabou de ser ocupado. Escolha outro.'
    case '54000': return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
    case '55000': return 'Isso não é possível agora: a reserva mudou de situação ou o prazo da política passou.'
    case '42501': return 'Você não tem permissão para esta ação.'
    default: return padrao
  }
}

/** Hold vencido ainda aparece como 'hold' até alguém marcar; a tela mostra o estado real. */
export function statusEfetivo(r: { status: string; expira_em: string | null }, agora: number = Date.now()): string {
  return r.status === 'hold' && r.expira_em && Date.parse(r.expira_em) <= agora ? 'expirada' : r.status
}

export const ROTULO_STATUS: Record<string, string> = {
  hold: 'Aguardando confirmação', confirmada: 'Confirmada', cancelada: 'Cancelada', expirada: 'Expirada', concluida: 'Concluída',
}
export const ROTULO_SINAL: Record<string, string> = {
  nenhum: 'Sem sinal', pendente: 'Sinal pendente', pago: 'Sinal pago (simulado)', reembolso_pendente: 'Reembolso pendente', reembolsado: 'Reembolsado',
}
