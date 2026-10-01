/**
 * Apontamento visual na prova (migration 0018): em qual lâmina e, opcional,
 * onde nela (% de 0 a 100 da largura/altura — independe do tamanho da tela).
 */
export interface Apontamento {
  laminaId: string
  x?: number | null
  y?: number | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Colunas de `prova_comentarios` a partir do que veio do navegador — ou erro. */
export function colunasDoApontamento(apontamento: Apontamento | null | undefined) {
  if (!apontamento) return { lamina_id: null, posicao_x: null, posicao_y: null }
  if (!UUID_RE.test(apontamento.laminaId)) throw new Error('Lâmina inválida.')

  const temPosicao = apontamento.x != null || apontamento.y != null
  if (!temPosicao) return { lamina_id: apontamento.laminaId, posicao_x: null, posicao_y: null }

  const x = Number(apontamento.x)
  const y = Number(apontamento.y)
  if (![x, y].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) throw new Error('Posição do apontamento inválida.')
  // Duas casas: é a precisão da coluna (numeric(5,2)).
  return { lamina_id: apontamento.laminaId, posicao_x: Math.round(x * 100) / 100, posicao_y: Math.round(y * 100) / 100 }
}
