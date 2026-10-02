import { PT_EM_MM, type TextoDoc } from '@/lib/album/documento'
import { fonteCanvas } from '@/lib/album/fontes'

/**
 * Quebra de linhas e medida dos textos, em mm — usada pelo JPG final e pela
 * verificação. Mesma regra do Konva: quebra por palavra dentro da largura,
 * respeitando as quebras manuais.
 */

let ctxMedida: CanvasRenderingContext2D | null = null
const ESCALA_MEDIDA = 10 // px por mm na medição

function contexto() {
  if (typeof document === 'undefined') return null
  if (!ctxMedida) ctxMedida = document.createElement('canvas').getContext('2d')
  return ctxMedida
}

export function tamanhoEmMm(t: Pick<TextoDoc, 'tamanho'>) {
  return t.tamanho * PT_EM_MM
}

function larguraDe(ctx: CanvasRenderingContext2D, s: string, espacoPx: number) {
  return ctx.measureText(s).width + Math.max(0, s.length - 1) * espacoPx
}

/** Linhas do texto já quebradas para a largura do bloco. */
export function quebrarLinhas(t: TextoDoc): string[] {
  const ctx = contexto()
  const paragrafos = t.texto.split('\n')
  if (!ctx) return paragrafos
  const tamanhoPx = tamanhoEmMm(t) * ESCALA_MEDIDA
  ctx.font = fonteCanvas(t, tamanhoPx)
  const espacoPx = (t.entreLetras / 1000) * tamanhoPx
  const limite = t.w * ESCALA_MEDIDA
  const linhas: string[] = []
  for (const p of paragrafos) {
    const palavras = p.split(' ')
    let atual = ''
    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra
      if (atual && larguraDe(ctx, tentativa, espacoPx) > limite) {
        linhas.push(atual)
        atual = palavra
      } else {
        atual = tentativa
      }
    }
    linhas.push(atual)
  }
  return linhas
}

/** Altura do bloco de texto em mm. */
export function alturaDoTexto(t: TextoDoc) {
  return quebrarLinhas(t).length * tamanhoEmMm(t) * t.entreLinhas
}

export function larguraDaLinhaMm(t: TextoDoc, linha: string) {
  const ctx = contexto()
  if (!ctx) return t.w
  const tamanhoPx = tamanhoEmMm(t) * ESCALA_MEDIDA
  ctx.font = fonteCanvas(t, tamanhoPx)
  return larguraDe(ctx, linha, (t.entreLetras / 1000) * tamanhoPx) / ESCALA_MEDIDA
}
