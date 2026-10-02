import { describe, expect, it } from 'vitest'
import { geometria, type FotoEditor, type Geometria } from '@/lib/album/documento'
import {
  documentoDoModelo,
  ESTILOS,
  GRADES_POR_PAGINA,
  gradesDePagina,
  layoutsVazios,
  MODELOS_DE_ALBUM,
  preencherAutomaticamente,
  preencherQuadrosVazios,
  temQuadrosVazios,
  tipoDaComposicao,
  variantesDeLayout,
} from '@/lib/album/modelos'

const FORMATOS: [string, 'quadrado' | 'horizontal' | 'vertical'][] = [
  ['20x20', 'quadrado'],
  ['25x25', 'quadrado'],
  ['30x30', 'quadrado'],
  ['20x30', 'vertical'],
  ['20x30', 'horizontal'],
  ['30x40', 'vertical'],
  ['30x40', 'horizontal'],
  ['15x21', 'vertical'],
]
const geo = (f: string, o: 'quadrado' | 'horizontal' | 'vertical') => geometria({ formato: f, orientacao: o, sangriaMm: 3, margemSeguraMm: 5 })!

/** Mistura de proporções: horizontal, vertical, quadrada, panorâmica e sem dimensão conhecida. */
function fotos(n: number, tipo: 'mista' | 'vertical' | 'panoramica' | 'sem-dimensao' = 'mista'): FotoEditor[] {
  const dims = (i: number): [number | null, number | null] => {
    if (tipo === 'vertical') return [4000, 6000]
    if (tipo === 'panoramica') return [9000, 3000]
    if (tipo === 'sem-dimensao') return [null, null]
    return ([[6000, 4000], [4000, 6000], [4000, 4000], [9000, 3000], [null, null]] as [number | null, number | null][])[i % 5]
  }
  return Array.from({ length: n }, (_, i) => ({ id: `f${i}`, url: '', nome: `f${i}`, largura: dims(i)[0], altura: dims(i)[1] }))
}

function quadrosDentro(g: Geometria, qs: { x: number; y: number; w: number; h: number }[]) {
  const s = g.sangria + 0.01
  return qs.every((q) => [q.x, q.y, q.w, q.h].every(Number.isFinite) && q.w > 0 && q.h > 0 && q.x >= -s && q.y >= -s && q.x + q.w <= g.laminaW + s && q.y + q.h <= g.laminaH + s)
}

describe('Smart Layout — todos os formatos × 1 a 16 fotos × tipos de foto', () => {
  for (const [f, o] of FORMATOS) {
    for (const tipo of ['mista', 'vertical', 'panoramica', 'sem-dimensao'] as const) {
      it(`${f} ${o} · ${tipo}`, () => {
        const g = geo(f, o)
        for (let n = 1; n <= 16; n++) {
          const fs = fotos(n, tipo)
          const vs = variantesDeLayout(fs, g)
          expect(vs.length, `${n} fotos`).toBeGreaterThan(0)
          for (const v of vs) {
            expect(v.quadros).toHaveLength(n)
            const ids = v.quadros.map((q) => q.fotoId)
            expect(new Set(ids).size, 'cada foto uma vez').toBe(n)
            expect(ids.every((id) => fs.some((x) => x.id === id))).toBe(true)
            expect(quadrosDentro(g, v.quadros), 'quadros dentro da lâmina + sangria').toBe(true)
            expect(Number.isFinite(v.erro)).toBe(true)
            expect(tipoDaComposicao(v)).toBeTruthy()
          }
        }
      })
    }
  }

  it('0 ou mais de 16 fotos: sem sugestões (não quebra)', () => {
    const g = geo('30x30', 'quadrado')
    expect(variantesDeLayout([], g)).toEqual([])
    expect(variantesDeLayout(fotos(17), g)).toEqual([])
  })

  it('estilos diferentes também produzem sugestões válidas', () => {
    const g = geo('30x30', 'quadrado')
    for (const e of ESTILOS) for (let n = 1; n <= 8; n++) expect(variantesDeLayout(fotos(n), g, 5, e).length).toBeGreaterThan(0)
  })

  it('foto principal fica com o maior quadro', () => {
    const g = geo('30x30', 'quadrado')
    const fs = fotos(5).map((f, i) => (i === 3 ? { ...f, prioridade: 'principal' as const } : f))
    for (const v of variantesDeLayout(fs, g)) {
      const maior = [...v.quadros].sort((a, b) => b.w * b.h - a.w * a.h)[0]
      expect(maior.fotoId).toBe('f3')
    }
  })

  it('layouts vazios de 1 a 8 quadros', () => {
    const g = geo('30x40', 'horizontal')
    for (let n = 1; n <= 8; n++) {
      const [v] = layoutsVazios(n, g)
      expect(v.quadros).toHaveLength(n)
      expect(v.quadros.every((q) => q.fotoId === null)).toBe(true)
    }
  })
})

describe('Preenchimento automático — cenários de borda', () => {
  const g = geo('30x30', 'quadrado')

  it('nenhuma foto: lâminas vazias, sem quebrar', () => {
    const d = preencherAutomaticamente([], 10, g, false)
    expect(d.laminas).toHaveLength(10)
    expect(d.laminas.every((l) => l.quadros.length === 0)).toBe(true)
  })

  it('1 foto em 30 lâminas: usa a foto uma vez e completa com lâminas vazias', () => {
    const d = preencherAutomaticamente(fotos(1), 30, g, false)
    expect(d.laminas).toHaveLength(30)
    expect(d.laminas.flatMap((l) => l.quadros)).toHaveLength(1)
  })

  it('120 fotos em 30 lâminas: usa todas, sem repetir, no máximo 16 por lâmina', () => {
    const d = preencherAutomaticamente(fotos(120), 30, g, true)
    const ids = d.laminas.flatMap((l) => l.quadros.map((q) => q.fotoId))
    expect(d.laminas).toHaveLength(31)
    expect(d.primeiraEhCapa).toBe(true)
    expect(ids).toHaveLength(120)
    expect(new Set(ids).size).toBe(120)
    expect(Math.max(...d.laminas.map((l) => l.quadros.length))).toBeLessThanOrEqual(16)
  })

  it('500 fotos em 10 lâminas: limita a 16 por lâmina sem travar', () => {
    const d = preencherAutomaticamente(fotos(500), 10, g, false)
    expect(Math.max(...d.laminas.map((l) => l.quadros.length))).toBeLessThanOrEqual(16)
  })

  it('cada estilo distribui todas as fotos', () => {
    for (const e of ESTILOS) {
      const d = preencherAutomaticamente(fotos(60), 20, g, false, e)
      expect(d.laminas.flatMap((l) => l.quadros)).toHaveLength(60)
    }
  })
})

describe('Modelos de álbum — todos os modelos × formatos', () => {
  it.each(MODELOS_DE_ALBUM.map((m) => [m.id]))('%s', (id) => {
    const m = MODELOS_DE_ALBUM.find((x) => x.id === id)!
    for (const [f, o] of FORMATOS) {
      const g = geo(f, o)
      for (const n of [1, 2, 3, m.laminas]) {
        const d = documentoDoModelo(m, n, g, 'Ana & João')
        expect(d.laminas.length).toBe(n + (m.capa ? 1 : 0))
        for (const l of d.laminas) expect(quadrosDentro(g, l.quadros)).toBe(true)
      }
    }
  })

  it('preencher os quadros vazios do modelo: com fotos de sobra, não sobra vazio', () => {
    const g = geo('30x30', 'quadrado')
    const d = documentoDoModelo(MODELOS_DE_ALBUM[0], 10, g)
    const cheio = preencherQuadrosVazios(d, fotos(200))
    expect(temQuadrosVazios(cheio)).toBe(false)
  })

  it('preencher com poucas fotos: preenche o que dá e mantém o resto vazio', () => {
    const g = geo('30x30', 'quadrado')
    const d = documentoDoModelo(MODELOS_DE_ALBUM[0], 10, g)
    const r = preencherQuadrosVazios(d, fotos(3))
    expect(r.laminas.flatMap((l) => l.quadros).filter((q) => q.fotoId)).toHaveLength(3)
  })
})

describe('Grades de página — cada uma é válida', () => {
  for (let n = 1; n <= 8; n++) {
    it(`${n} foto(s): ${GRADES_POR_PAGINA[n]} grades, células dentro da página e sem sobreposição`, () => {
      const grades = gradesDePagina(n)
      expect(grades.length).toBeGreaterThanOrEqual(4)
      for (const g of grades) {
        expect(g).toHaveLength(n)
        for (const [x, y, w, h] of g) {
          expect(x).toBeGreaterThanOrEqual(-1e-9)
          expect(y).toBeGreaterThanOrEqual(-1e-9)
          expect(x + w).toBeLessThanOrEqual(1 + 1e-9)
          expect(y + h).toBeLessThanOrEqual(1 + 1e-9)
          expect(w > 0 && h > 0).toBe(true)
        }
        for (let i = 0; i < g.length; i++)
          for (let j = i + 1; j < g.length; j++) {
            const [ax, ay, aw, ah] = g[i]
            const [bx, by, bw, bh] = g[j]
            const sobrepoe = Math.min(ax + aw, bx + bw) - Math.max(ax, bx) > 1e-6 && Math.min(ay + ah, by + bh) - Math.max(ay, by) > 1e-6
            expect(sobrepoe, `grade de ${n}: células ${i} e ${j} se sobrepõem`).toBe(false)
          }
      }
    })
  }

  it('de 8 a 16 fotos há pelo menos 10 composições por quantidade', () => {
    const g = geo('30x30', 'quadrado')
    for (let n = 8; n <= 16; n++) expect(variantesDeLayout(fotos(n), g, 10_000).length, `${n} fotos`).toBeGreaterThanOrEqual(10)
  })
})
