import { describe, expect, it } from 'vitest'
import { ajustarRecorte, caixaRotacionada, dpiDoQuadro, geometria, moverRecorte, normalizarDocumento, posicaoDaFoto, quadroNovo } from '@/lib/album/documento'

describe('normalizarDocumento — nunca quebra com JSON torto', () => {
  it.each([[null], [undefined], ['texto'], [42], [[]], [{}], [{ laminas: 'x' }], [{ laminas: [null, 1, 'a'] }]])('%j vira documento válido', (bruto) => {
    const d = normalizarDocumento(bruto)
    expect(d.laminas.length).toBeGreaterThanOrEqual(1)
    for (const l of d.laminas) {
      expect(Array.isArray(l.quadros) && Array.isArray(l.textos) && Array.isArray(l.formas)).toBe(true)
      expect(l.fundo).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('documento antigo (sem textos, formas, rotação, exposição) abre com padrões', () => {
    const d = normalizarDocumento({ laminas: [{ quadros: [{ x: 1, y: 2, w: 30, h: 20, fotoId: 'a', recorte: { zoom: 1, cx: 0.5, cy: 0.5 } }] }] })
    const q = d.laminas[0].quadros[0]
    expect(q).toMatchObject({ rotacao: 0, opacidade: 1, espelharH: false, bloqueado: false, oculto: false, borda: null })
    expect(q.ajustes).toEqual({ brilho: 0, contraste: 0, saturacao: 0, temperatura: 0, exposicao: 0, pb: false })
    expect(d.laminas[0].fundoGradiente).toBeNull()
  })

  it('valores absurdos são limitados', () => {
    const d = normalizarDocumento({
      laminas: [{ fundo: 'vermelho', quadros: [{ x: 1e9, y: NaN, w: -5, h: 1e9, recorte: { zoom: 99, cx: -3, cy: 7 }, opacidade: 5, fotoId: 'x'.repeat(500) }] }],
    })
    const q = d.laminas[0].quadros[0]
    expect(q.x).toBe(5000)
    expect(q.y).toBe(0)
    expect(q.w).toBe(1)
    expect(q.recorte.zoom).toBe(8)
    expect(q.recorte.cx).toBe(0)
    expect(q.recorte.cy).toBe(1)
    expect(q.opacidade).toBe(1)
    expect(q.fotoId).toBeNull()
    expect(d.laminas[0].fundo).toBe('#ffffff')
  })

  it('limites de quantidade: 200 lâminas, 40 quadros', () => {
    const d = normalizarDocumento({ laminas: Array.from({ length: 300 }, () => ({ quadros: Array.from({ length: 60 }, () => ({})) })) })
    expect(d.laminas).toHaveLength(200)
    expect(d.laminas[0].quadros).toHaveLength(40)
  })
})

describe('recorte e DPI', () => {
  const q = quadroNovo(0, 0, 300, 300, 'f')
  it('foto 6000 × 4000 cobre o quadro sem deformar', () => {
    const p = posicaoDaFoto(q, 6000, 4000)
    expect(p.h).toBeCloseTo(300)
    expect(p.w / p.h).toBeCloseTo(1.5)
  })
  it('DPI de página inteira 30 cm com 4000 px de altura = 338', () => expect(dpiDoQuadro(q, 6000, 4000)).toBe(338))
  it('arrastar além da foto não deixa borda vazia', () => {
    const r = moverRecorte(q, 10_000, 10_000, 6000, 4000)
    const p = posicaoDaFoto({ ...q, recorte: r }, 6000, 4000)
    expect(p.x).toBeLessThanOrEqual(0.001)
    expect(p.x + p.w).toBeGreaterThanOrEqual(q.w - 0.001)
    expect(p.y).toBeLessThanOrEqual(0.001)
  })
  it('espelhado: arrastar para a direita move o recorte ao contrário', () => {
    const normal = moverRecorte({ ...q, recorte: { zoom: 2, cx: 0.5, cy: 0.5 } }, 20, 0, 6000, 4000)
    const espelhado = moverRecorte({ ...q, espelharH: true, recorte: { zoom: 2, cx: 0.5, cy: 0.5 } }, 20, 0, 6000, 4000)
    expect(normal.cx).toBeLessThan(0.5)
    expect(espelhado.cx).toBeGreaterThan(0.5)
  })
  it('zoom fora do intervalo é limitado', () => expect(ajustarRecorte(q, { zoom: 0.2, cx: 0.5, cy: 0.5 }, 6000, 4000).zoom).toBe(1))
  it('caixa de um retângulo 100 × 50 girado 90°', () => {
    const c = caixaRotacionada({ x: 0, y: 0, w: 100, h: 50, rotacao: 90 })
    expect(c.w).toBeCloseTo(50)
    expect(c.h).toBeCloseTo(100)
  })
})

describe('geometria', () => {
  it('30x30 com sangria 3 e margem 5', () => expect(geometria({ formato: '30x30', orientacao: 'quadrado', sangriaMm: 3, margemSeguraMm: 5 })).toEqual({ laminaW: 600, laminaH: 300, paginaW: 300, sangria: 3, margem: 5 }))
  it('formato inválido → null (editor mostra aviso, não quebra)', () => expect(geometria({ formato: 'lixo', orientacao: 'quadrado', sangriaMm: 3, margemSeguraMm: 5 })).toBeNull())
})
