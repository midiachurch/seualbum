import { describe, expect, it } from 'vitest'
import { geometria, novaLamina, quadroNovo, type FotoEditor } from '@/lib/album/documento'
import {
  aplicarTemplate,
  assinaturaDasFotos,
  assinaturaDosQuadros,
  bibliotecaPadrao,
  compatibilidade,
  filtrarTemplates,
  orientacaoDe,
  reorganizacoes,
  templateDaLamina,
} from '@/lib/album/templates'

const g30 = geometria({ formato: '30x30', orientacao: 'quadrado', sangriaMm: 3, margemSeguraMm: 5 })!
const g2030 = geometria({ formato: '20x30', orientacao: 'vertical', sangriaMm: 3, margemSeguraMm: 5 })!
const P = (id: string): FotoEditor => ({ id, url: '', nome: id, largura: 4000, altura: 6000 })
const L = (id: string): FotoEditor => ({ id, url: '', nome: id, largura: 6000, altura: 4000 })
const S = (id: string): FotoEditor => ({ id, url: '', nome: id, largura: 5000, altura: 5000 })

/** Lâmina P-L-P: retrato à esquerda, paisagem e retrato na direita. */
function laminaPLP() {
  return {
    ...novaLamina(),
    quadros: [
      { ...quadroNovo(20, 20, 120, 180), id: 'q1' },
      { ...quadroNovo(320, 20, 260, 120), id: 'q2' },
      { ...quadroNovo(320, 150, 120, 140), id: 'q3' },
    ],
  }
}

describe('Assinatura (P / L / S)', () => {
  it('orientação', () => {
    expect(orientacaoDe(4000, 6000)).toBe('P')
    expect(orientacaoDe(6000, 4000)).toBe('L')
    expect(orientacaoDe(5000, 5100)).toBe('S')
    expect(orientacaoDe(null, null)).toBe('L')
  })
  it('a ordem importa: P-L-P ≠ L-P-P', () => {
    expect(assinaturaDasFotos([P('a'), L('b'), P('c')])).toBe('P-L-P')
    expect(assinaturaDasFotos([L('b'), P('a'), P('c')])).toBe('L-P-P')
  })
  it('quadros em ordem de leitura (esquerda → direita, cima → baixo)', () => {
    expect(assinaturaDosQuadros(laminaPLP().quadros, g30.paginaW)).toBe('P-L-P')
  })
})

describe('Salvar como template / reaplicar', () => {
  it('guarda só geometria e assinatura — nenhuma foto', () => {
    const l = laminaPLP()
    l.quadros[0].fotoId = 'foto-a'
    const t = templateDaLamina(l, g30, 'Meu PLP')!
    expect(t.assinatura).toBe('P-L-P')
    expect(t.nFotos).toBe(3)
    expect(JSON.stringify(t)).not.toContain('foto-a')
    expect(t.quadros.every((q) => q.x >= 0 && q.x <= 1 && q.w > 0 && q.w <= 1)).toBe(true)
  })

  it('reaplica em outro formato mantendo as proporções relativas', () => {
    const t = templateDaLamina(laminaPLP(), g30, 'x')!
    const qs = aplicarTemplate(t, g2030, [P('a'), L('b'), P('c')], true)
    expect(qs).toHaveLength(3)
    // 1º quadro começa a 20/600 da largura da lâmina, nos dois formatos.
    expect(qs[0].x / g2030.laminaW).toBeCloseTo(20 / 600)
    expect(qs.every((q) => q.x + q.w <= g2030.laminaW + 0.01)).toBe(true)
  })

  it('respeitar a ordem: 1ª foto no 1º quadro', () => {
    const t = templateDaLamina(laminaPLP(), g30, 'x')!
    const qs = aplicarTemplate(t, g30, [P('a'), L('b'), P('c')], true)
    expect(qs.map((q) => q.fotoId)).toEqual(['a', 'b', 'c'])
  })

  it('sem respeitar a ordem: a paisagem vai no quadro paisagem', () => {
    const t = templateDaLamina(laminaPLP(), g30, 'x')!
    const qs = aplicarTemplate(t, g30, [L('b'), P('a'), P('c')], false)
    const paisagem = qs.find((q) => q.w > q.h)!
    expect(paisagem.fotoId).toBe('b')
  })

  it('menos fotos que quadros: sobram quadros vazios; recorte usa o ponto focal', () => {
    const t = templateDaLamina(laminaPLP(), g30, 'x')!
    const qs = aplicarTemplate(t, g30, [{ ...L('b'), fx: 0.2, fy: 0.7 }], false)
    expect(qs.filter((q) => q.fotoId)).toHaveLength(1)
    expect(qs.find((q) => q.fotoId)!.recorte).toMatchObject({ cx: 0.2, cy: 0.7 })
  })

  it('lâmina sem quadros não vira template', () => expect(templateDaLamina(novaLamina(), g30, 'x')).toBeNull())
})

describe('Compatibilidade e biblioteca', () => {
  const t = templateDaLamina(laminaPLP(), g30, 'PLP')!
  it('exata, mesmas orientações, só quantidade, incompatível', () => {
    expect(compatibilidade(t, [P('a'), L('b'), P('c')], g30).nivel).toBe('exata')
    expect(compatibilidade(t, [L('b'), P('a'), P('c')], g30).nivel).toBe('proporcao')
    expect(compatibilidade(t, [L('a'), L('b'), L('c')], g30).nivel).toBe('quantidade')
    expect(compatibilidade(t, [L('a')], g30).nivel).toBe('incompativel')
  })

  it('biblioteca padrão: 1 a 12 fotos, várias por quantidade', () => {
    const b = bibliotecaPadrao(g30)
    for (let n = 1; n <= 12; n++) expect(b.filter((x) => x.nFotos === n).length).toBeGreaterThanOrEqual(2)
  })

  it('filtros: quantidade, orientação, favoritos, personalizados, recentes', () => {
    const b = [...bibliotecaPadrao(g30), { ...t, favorito: true, ultimoUso: '2026-10-02T10:00:00Z' }]
    expect(filtrarTemplates(b, { aba: 'todos', nFotos: 3, orientacao: null }).every((x) => x.nFotos === 3)).toBe(true)
    expect(filtrarTemplates(b, { aba: 'favoritos', nFotos: null, orientacao: null })).toHaveLength(1)
    expect(filtrarTemplates(b, { aba: 'personalizados', nFotos: null, orientacao: null })).toHaveLength(1)
    expect(filtrarTemplates(b, { aba: 'recentes', nFotos: null, orientacao: null })).toHaveLength(1)
    expect(filtrarTemplates(b, { aba: 'todos', nFotos: null, orientacao: 'misto' }).every((x) => new Set(x.assinatura.split('-')).size > 1)).toBe(true)
  })

  it('Reorganizar: propõe outras ordens e conta os encaixes exatos', () => {
    const r = reorganizacoes([L('b'), P('a'), P('c')], [t])
    expect(r[0].assinatura).toBe('L-P-P') // a ordem atual vem primeiro
    const plp = r.find((x) => x.assinatura === 'P-L-P')!
    expect(plp.exatos).toBe(1)
    expect(new Set(plp.ordem)).toEqual(new Set(['a', 'b', 'c']))
  })

  it('Reorganizar com 8 fotos não explode (rotações e trocas)', () => {
    const fotos = Array.from({ length: 8 }, (_, i) => (i % 2 ? P(`p${i}`) : S(`s${i}`)))
    expect(reorganizacoes(fotos, bibliotecaPadrao(g30)).length).toBeGreaterThan(0)
  })
})
