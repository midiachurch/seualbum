import { describe, expect, it } from 'vitest'
import { geometria, normalizarDocumento } from '@/lib/album/documento'
import { verificarAlbum } from '@/lib/album/verificacao'

const g = geometria({ formato: '30x30', orientacao: 'quadrado', sangriaMm: 3, margemSeguraMm: 5 })!
const dims = (entradas: [string, number, number, number?][]) => new Map(entradas.map(([id, w, h, e]) => [id, { largura: w, altura: h, estouro: e ?? 0 }]))

describe('Verificação — 3 níveis', () => {
  it('álbum vazio: erro de lâmina sem conteúdo', () => {
    const p = verificarAlbum(normalizarDocumento({}), g, new Map())
    expect(p).toEqual([expect.objectContaining({ nivel: 'erro', mensagem: 'Lâmina sem conteúdo.' })])
  })

  it('tudo certo: nenhum problema', () => {
    const doc = normalizarDocumento({ laminas: [{ quadros: [{ x: 20, y: 20, w: 120, h: 80, fotoId: 'a' }] }] })
    expect(verificarAlbum(doc, g, dims([['a', 6000, 4000]]))).toEqual([])
  })

  it('erros: quadro vazio, foto fora da área, texto cortado', () => {
    const doc = normalizarDocumento({
      laminas: [{ quadros: [{ x: 20, y: 20, w: 50, h: 50 }, { x: 700, y: 10, w: 40, h: 40, fotoId: 'a' }], textos: [{ x: 570, y: 20, w: 80, texto: 'Ana' }] }],
    })
    const niveis = verificarAlbum(doc, g, dims([['a', 6000, 4000]])).map((p) => p.nivel)
    expect(niveis.filter((n) => n === 'erro')).toHaveLength(3)
  })

  it('atenção: baixa resolução, estourada, dobra, borda no corte', () => {
    const doc = normalizarDocumento({ laminas: [{ quadros: [{ x: 0, y: 20, w: 400, h: 200, fotoId: 'b' }] }] })
    const msgs = verificarAlbum(doc, g, dims([['b', 1200, 800, 0.4]])).map((p) => `${p.nivel}:${p.mensagem}`)
    expect(msgs.some((m) => m.startsWith('aviso:Foto com'))).toBe(true)
    expect(msgs.some((m) => m.startsWith('aviso:Foto estourada'))).toBe(true)
    expect(msgs.some((m) => m.includes('dobra'))).toBe(true)
    expect(msgs.some((m) => m.includes('filete branco'))).toBe(true)
  })

  it('informação: foto não usada e foto repetida — não são erro', () => {
    const doc = normalizarDocumento({ laminas: [{ quadros: [{ x: 20, y: 20, w: 100, h: 100, fotoId: 'a' }, { x: 320, y: 20, w: 100, h: 100, fotoId: 'a' }] }] })
    const p = verificarAlbum(doc, g, dims([['a', 6000, 4000], ['z', 6000, 4000]]))
    expect(p.map((x) => x.nivel)).toEqual(['info', 'info'])
  })

  it('elementos ocultos não contam', () => {
    const doc = normalizarDocumento({ laminas: [{ quadros: [{ x: 20, y: 20, w: 100, h: 100, fotoId: 'a' }, { x: 900, y: 900, w: 10, h: 10, oculto: true }] }] })
    expect(verificarAlbum(doc, g, dims([['a', 6000, 4000]]))).toEqual([])
  })

  it('foto sangrando a lâmina inteira não acusa corte nem sangria', () => {
    const doc = normalizarDocumento({ laminas: [{ quadros: [{ x: -3, y: -3, w: 606, h: 306, fotoId: 'p' }] }] })
    const msgs = verificarAlbum(doc, g, dims([['p', 12000, 6000]])).map((x) => x.mensagem)
    expect(msgs.some((m) => /corte|sangria/.test(m))).toBe(false)
  })
})
