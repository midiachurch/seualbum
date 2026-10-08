/**
 * Apontamento visual na prova (migration 0018): em qual lâmina e, opcional,
 * onde nela (% de 0 a 100 da largura/altura — independe do tamanho da tela).
 * Com `largura`/`altura` (migration 0032) é uma ÁREA: retângulo cujo canto
 * superior esquerdo é (x, y).
 */
export interface Apontamento {
  laminaId: string
  x?: number | null
  y?: number | null
  largura?: number | null
  altura?: number | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Área menor que isso é um clique tremido, não um retângulo. */
export const AREA_MINIMA = 1

// Duas casas: é a precisão das colunas (numeric(5,2)).
const duasCasas = (v: number) => Math.round(v * 100) / 100

/** Colunas de `prova_comentarios` a partir do que veio do navegador — ou erro. */
export function colunasDoApontamento(apontamento: Apontamento | null | undefined) {
  const vazio = { posicao_x: null, posicao_y: null, area_largura: null, area_altura: null }
  if (!apontamento) return { lamina_id: null, ...vazio }
  if (!UUID_RE.test(apontamento.laminaId)) throw new Error('Lâmina inválida.')

  const temPosicao = apontamento.x != null || apontamento.y != null
  if (!temPosicao) return { lamina_id: apontamento.laminaId, ...vazio }

  const x = Number(apontamento.x)
  const y = Number(apontamento.y)
  if (![x, y].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) throw new Error('Posição do apontamento inválida.')
  const ponto = { lamina_id: apontamento.laminaId, posicao_x: duasCasas(x), posicao_y: duasCasas(y) }

  if (apontamento.largura == null && apontamento.altura == null) return { ...ponto, area_largura: null, area_altura: null }
  // Área: cortada na borda da lâmina; pequena demais vira só o ponto.
  const largura = Math.min(Number(apontamento.largura), 100 - x)
  const altura = Math.min(Number(apontamento.altura), 100 - y)
  if (![largura, altura].every(Number.isFinite)) throw new Error('Área do apontamento inválida.')
  if (largura < AREA_MINIMA || altura < AREA_MINIMA) return { ...ponto, area_largura: null, area_altura: null }
  return { ...ponto, area_largura: duasCasas(largura), area_altura: duasCasas(altura) }
}
