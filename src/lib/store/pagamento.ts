/**
 * Adaptador de pagamento da Store (venda do estúdio, ADR-004).
 *
 * O ÚNICO adaptador existente é o simulado: nenhum dinheiro se move. Gateway,
 * split, tributação e disputa não têm contrato aprovado, então o banco só
 * aceita o provedor 'simulado' (CHECK na 0055). Para ligar um gateway real é
 * preciso uma migration própria e um novo adaptador com esta mesma interface.
 */
export type ResultadoPagamento = { provedor: 'simulado'; eventoId: string; tipo: 'pago' | 'recusado'; valorCentavos: number }

export interface AdaptadorPagamentoStore {
  readonly provedor: 'simulado'
  iniciar(pedido: { id: string; totalCentavos: number }, desfecho: 'pago' | 'recusado'): Promise<ResultadoPagamento>
}

/**
 * Falha FECHADO: em produção a Store não cobra nada (simulado ou não) sem a
 * flag explícita; em dev/preview precisa da flag ligada. Impede que uma venda
 * simulada pareça real em ambiente indevido.
 */
export function pagamentoSimuladoPermitido(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SEUALBUM_STORE_PAGAMENTO_SIMULADO !== '1') return false
  return env.VERCEL_ENV !== 'production'
}

export function adaptadorSimulado(gerarId: () => string = () => crypto.randomUUID()): AdaptadorPagamentoStore {
  return {
    provedor: 'simulado',
    async iniciar(pedido, desfecho) {
      return { provedor: 'simulado', eventoId: `sim_${gerarId()}`, tipo: desfecho, valorCentavos: pedido.totalCentavos }
    },
  }
}
