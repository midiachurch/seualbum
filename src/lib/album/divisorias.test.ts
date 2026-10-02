import { describe, expect, it } from 'vitest'
import { quadroNovo } from '@/lib/album/documento'
import { ajustarEspacamento, aplicarDivisoria, encontrarDivisorias, limitarDeslocamento, vaoAtual } from '@/lib/album/divisorias'

/** Grade 2 × 2 com vão de 4 mm, como as composições automáticas. */
function grade2x2() {
  return [
    { ...quadroNovo(10, 10, 100, 80), id: 'a' },
    { ...quadroNovo(114, 10, 100, 80), id: 'b' },
    { ...quadroNovo(10, 94, 100, 80), id: 'c' },
    { ...quadroNovo(114, 94, 100, 80), id: 'd' },
  ]
}

describe('Divisórias entre fotos', () => {
  it('grade 2 × 2: uma divisória vertical (pega as 2 linhas) e uma horizontal (pega as 2 colunas)', () => {
    const ds = encontrarDivisorias(grade2x2())
    const v = ds.filter((d) => d.eixo === 'v')
    const h = ds.filter((d) => d.eixo === 'h')
    expect(v).toHaveLength(1)
    expect(h).toHaveLength(1)
    expect(v[0].antes.sort()).toEqual(['a', 'c'])
    expect(v[0].depois.sort()).toEqual(['b', 'd'])
    expect(h[0].antes.sort()).toEqual(['a', 'b'])
  })

  it('arrastar a vertical 20 mm: coluna da esquerda cresce, a da direita anda e encolhe, o vão se mantém', () => {
    const qs = grade2x2()
    const [v] = encontrarDivisorias(qs).filter((d) => d.eixo === 'v')
    const p = new Map(aplicarDivisoria(v, qs, 20).map((x) => [x.id, x.patch]))
    expect(p.get('a')).toEqual({ w: 120 })
    expect(p.get('c')).toEqual({ w: 120 })
    expect(p.get('b')).toEqual({ x: 134, w: 80 })
    // vão = 134 − (10 + 120) = 4 mm, igual ao original
    expect(134 - (10 + 120)).toBe(4)
  })

  it('não deixa nenhuma foto menor que 1 cm', () => {
    const qs = grade2x2()
    const [v] = encontrarDivisorias(qs).filter((d) => d.eixo === 'v')
    expect(limitarDeslocamento(v, qs, 500)).toBe(90)
    expect(limitarDeslocamento(v, qs, -500)).toBe(-90)
  })

  it('horizontal: de cima cresce, de baixo desce e encolhe', () => {
    const qs = grade2x2()
    const [h] = encontrarDivisorias(qs).filter((d) => d.eixo === 'h')
    const p = new Map(aplicarDivisoria(h, qs, -30).map((x) => [x.id, x.patch]))
    expect(p.get('a')).toEqual({ h: 50 })
    expect(p.get('c')).toEqual({ y: 64, h: 110 })
  })

  it('fotos distantes, giradas, bloqueadas ou ocultas não formam divisória', () => {
    const longe = [{ ...quadroNovo(0, 0, 50, 50), id: 'x' }, { ...quadroNovo(200, 0, 50, 50), id: 'y' }]
    expect(encontrarDivisorias(longe)).toHaveLength(0)
    const girada = grade2x2().map((q) => (q.id === 'a' ? { ...q, rotacao: 15 } : q))
    expect(encontrarDivisorias(girada).some((d) => d.antes.includes('a') || d.depois.includes('a'))).toBe(false)
    const bloqueada = grade2x2().map((q) => (q.id === 'b' ? { ...q, bloqueado: true } : q))
    expect(encontrarDivisorias(bloqueada).some((d) => d.depois.includes('b') || d.antes.includes('b'))).toBe(false)
  })

  it('fotos que se tocam (vão zero) também ajustam', () => {
    const qs = [{ ...quadroNovo(0, 0, 100, 100), id: 'a' }, { ...quadroNovo(100, 0, 100, 100), id: 'b' }]
    const [v] = encontrarDivisorias(qs)
    expect(v.eixo).toBe('v')
  })
})

describe('Espaçamento da página', () => {
  it('vão atual da grade 2 × 2 = 4 mm', () => expect(vaoAtual(grade2x2())).toBe(4))
  it('levar o vão a 10 mm: todos os vãos ficam 10, bordas externas no lugar', () => {
    const qs = grade2x2()
    const p = new Map(ajustarEspacamento(qs, 10).map((x) => [x.id, x.patch]))
    const novo = qs.map((q) => ({ ...q, ...p.get(q.id) }))
    const [a, b, c] = novo
    expect(b.x - (a.x + a.w)).toBeCloseTo(10)
    expect(c.y - (a.y + a.h)).toBeCloseTo(10)
    expect(a.x).toBeCloseTo(10)
    expect(b.x + b.w).toBeCloseTo(214)
  })
  it('sem vizinhas: nada muda', () => {
    expect(ajustarEspacamento([{ ...quadroNovo(0, 0, 50, 50), id: 'x' }], 10)).toEqual([])
    expect(vaoAtual([{ ...quadroNovo(0, 0, 50, 50), id: 'x' }])).toBeNull()
  })
})
