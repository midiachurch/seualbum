import type { StudioOutboxReservaRow, StudioOutboxStatus } from '@/types/database'

/**
 * Adaptador de envio da outbox do Estúdio (0083). É a ÚNICA fronteira com o
 * mundo externo e hoje só existe o adaptador `registro`: ele não envia nada,
 * apenas devolve sucesso "simulado" e o banco grava o que SERIA enviado.
 * Envio real (e-mail/WhatsApp/SMS) exige integração aprovada e uma migration
 * que o libere; o banco recusa qualquer adaptador diferente de `registro`.
 */
export type ResultadoEnvio = { ok: true; simulada: true } | { ok: false; erro: string }

export interface AdaptadorEnvio {
  readonly nome: 'registro'
  enviar(item: StudioOutboxReservaRow): Promise<ResultadoEnvio>
}

/** Não envia: registra (no banco, via RPC) e marca como simulada. */
export const adaptadorRegistro: AdaptadorEnvio = {
  nome: 'registro',
  async enviar() {
    return { ok: true, simulada: true }
  },
}

/** Subconjunto do cliente Supabase que a fila usa (facilita testar sem rede). */
export type ClienteFila = {
  rpc(
    fn: 'reservar_outbox_studio' | 'concluir_outbox_studio',
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string | null; message?: string | null } | null }>
}

export type ResumoFila = { reservadas: number; simuladas: number; falhas: number; ignoradas: number }

/**
 * Reserva itens prontos, entrega cada um ao adaptador e conclui. Idempotente:
 * `concluir_outbox_studio` só age em itens "enviando", então repetir a
 * conclusão (retry de rede) não duplica registro nem tentativa. Exceções do
 * adaptador contam como falha (com backoff no banco), nunca como sucesso.
 */
export async function processarFila(
  cliente: ClienteFila,
  organizacaoId: string,
  adaptador: AdaptadorEnvio = adaptadorRegistro,
  limite = 20,
): Promise<ResumoFila> {
  const resumo: ResumoFila = { reservadas: 0, simuladas: 0, falhas: 0, ignoradas: 0 }
  const { data, error } = await cliente.rpc('reservar_outbox_studio', { p_org: organizacaoId, p_limite: limite })
  if (error) throw new Error('reserva_falhou')
  const itens = (Array.isArray(data) ? data : []) as StudioOutboxReservaRow[]
  resumo.reservadas = itens.length
  for (const item of itens) {
    let resultado: ResultadoEnvio
    try {
      resultado = await adaptador.enviar(item)
    } catch {
      resultado = { ok: false, erro: 'Falha no adaptador de envio.' }
    }
    const { data: status, error: erroConclusao } = await cliente.rpc('concluir_outbox_studio', {
      p_id: item.id,
      p_ok: resultado.ok,
      p_adaptador: adaptador.nome,
      p_erro: resultado.ok ? null : resultado.erro.slice(0, 300),
    })
    if (erroConclusao) { resumo.ignoradas += 1; continue }
    const s = status as StudioOutboxStatus
    if (s === 'enviada') resumo.simuladas += 1
    else if (s === 'pendente' || s === 'falhou') resumo.falhas += 1
    else resumo.ignoradas += 1
  }
  return resumo
}
