import type { Quadro } from '@/lib/album/documento'

/**
 * Divisórias entre fotos vizinhas (ajuste manual de grade): arrastar o vão
 * entre duas fotos aumenta uma e diminui a outra, mantendo o espaçamento.
 * Puro (sem Konva) — o canvas desenha as alças e chama `aplicarDivisoria`.
 */

/** Espaço entre duas fotos (mm) que ainda conta como "vizinhas" para a divisória. */
const VAO_MAX_MM = 15
const SOBREPOSICAO_MIN_MM = 10
const LADO_MIN_DIVISORIA_MM = 10

export type Divisoria = {
  eixo: 'v' | 'h'
  /** Borda final dos quadros de antes (direita/baixo) e inicial dos de depois. */
  bordaAntes: number
  bordaDepois: number
  inicio: number
  fim: number
  antes: string[]
  depois: string[]
}

/**
 * Divisórias entre fotos vizinhas: pares lado a lado (ou um sobre o outro)
 * separados por um vão pequeno. Fotos alinhadas na mesma linha entram na
 * mesma divisória — arrastar mantém a grade (todas as colunas/linhas juntas).
 */
export function encontrarDivisorias(quadros: Quadro[]): Divisoria[] {
  const livres = quadros.filter((q) => !q.rotacao && !q.oculto && !q.bloqueado)
  const mapa = new Map<string, Divisoria>()
  const r = (v: number) => Math.round(v * 2) / 2
  for (const a of livres)
    for (const b of livres) {
      if (a === b) continue
      // Vertical: a à esquerda de b.
      const vaoX = b.x - (a.x + a.w)
      const sobY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (vaoX >= -0.5 && vaoX <= VAO_MAX_MM && sobY > SOBREPOSICAO_MIN_MM) {
        const k = `v|${r(a.x + a.w)}|${r(b.x)}`
        const d = mapa.get(k) ?? { eixo: 'v', bordaAntes: a.x + a.w, bordaDepois: b.x, inicio: Infinity, fim: -Infinity, antes: [], depois: [] }
        if (!d.antes.includes(a.id)) d.antes.push(a.id)
        if (!d.depois.includes(b.id)) d.depois.push(b.id)
        d.inicio = Math.min(d.inicio, a.y, b.y)
        d.fim = Math.max(d.fim, a.y + a.h, b.y + b.h)
        mapa.set(k, d)
      }
      // Horizontal: a acima de b.
      const vaoY = b.y - (a.y + a.h)
      const sobX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      if (vaoY >= -0.5 && vaoY <= VAO_MAX_MM && sobX > SOBREPOSICAO_MIN_MM) {
        const k = `h|${r(a.y + a.h)}|${r(b.y)}`
        const d = mapa.get(k) ?? { eixo: 'h', bordaAntes: a.y + a.h, bordaDepois: b.y, inicio: Infinity, fim: -Infinity, antes: [], depois: [] }
        if (!d.antes.includes(a.id)) d.antes.push(a.id)
        if (!d.depois.includes(b.id)) d.depois.push(b.id)
        d.inicio = Math.min(d.inicio, a.x, b.x)
        d.fim = Math.max(d.fim, a.x + a.w, b.x + b.w)
        mapa.set(k, d)
      }
    }
  return [...mapa.values()]
}

/** Deslocamento permitido para a divisória (nenhuma foto fica menor que 1 cm). */
export function limitarDeslocamento(d: Divisoria, quadros: Quadro[], delta: number) {
  const lado = (q: Quadro) => (d.eixo === 'v' ? q.w : q.h)
  const antes = quadros.filter((q) => d.antes.includes(q.id))
  const depois = quadros.filter((q) => d.depois.includes(q.id))
  const minimo = Math.max(...antes.map((q) => LADO_MIN_DIVISORIA_MM - lado(q)))
  const maximo = Math.min(...depois.map((q) => lado(q) - LADO_MIN_DIVISORIA_MM))
  return Math.max(minimo, Math.min(maximo, delta))
}

/** Novos tamanhos ao mover a divisória: os de antes crescem, os de depois andam e encolhem. */
export function aplicarDivisoria(d: Divisoria, quadros: Quadro[], delta: number): { id: string; patch: Partial<Quadro> }[] {
  const dd = limitarDeslocamento(d, quadros, delta)
  return quadros.flatMap((q) => {
    if (d.antes.includes(q.id)) return [{ id: q.id, patch: d.eixo === 'v' ? { w: q.w + dd } : { h: q.h + dd } }]
    if (d.depois.includes(q.id)) return [{ id: q.id, patch: d.eixo === 'v' ? { x: q.x + dd, w: q.w - dd } : { y: q.y + dd, h: q.h - dd } }]
    return []
  })
}
