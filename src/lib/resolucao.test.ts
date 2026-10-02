import { describe, expect, it } from 'vitest'
import { dpiEfetivo, laminaEmCm, normalizarFormato, normalizarOrientacao, pixelsMinimos } from '@/lib/resolucao'

describe('normalizarFormato — como as pessoas escrevem', () => {
  it.each([
    ['30x30', '30x30'],
    ['30 x 30', '30x30'],
    ['30X40', '30x40'],
    ['30×40', '30x40'],
    ['30*40', '30x40'],
    ['30x40cm', '30x40'],
    ['30 x 40 cm', '30x40'],
    ['  25 X 25  ', '25x25'],
    ['20,5x30', '20.5x30'],
    ['20.5 x 30', '20.5x30'],
    ['5x5', '5x5'],
    ['100x100', '100x100'],
  ])('%s → %s', (entrada, saida) => expect(normalizarFormato(entrada)).toBe(saida))

  it.each([[''], [null], [undefined], ['abc'], ['30x'], ['x30'], ['30'], ['0x30'], ['4x30'], ['30x101'], ['300x300'], ['-30x30'], ['30x30x30'], [30], [{}]])(
    'recusa %s',
    (entrada) => expect(normalizarFormato(entrada)).toBe(''),
  )
})

describe('normalizarOrientacao', () => {
  it.each([
    ['quadrado', 'quadrado'],
    ['Quadrada', 'quadrado'],
    ['retrato', 'vertical'],
    ['Retrato', 'vertical'],
    ['portrait', 'vertical'],
    ['vertical', 'vertical'],
    ['paisagem', 'horizontal'],
    ['Paisagem', 'horizontal'],
    ['landscape', 'horizontal'],
    ['horizontal', 'horizontal'],
  ])('%s → %s', (entrada, saida) => expect(normalizarOrientacao(entrada)).toBe(saida))

  it('sem valor: deduz do formato', () => {
    expect(normalizarOrientacao(null, '30x30')).toBe('quadrado')
    expect(normalizarOrientacao(undefined, '20x30')).toBe('vertical')
    expect(normalizarOrientacao('', '40x30')).toBe('horizontal')
    expect(normalizarOrientacao('qualquer coisa', '30 x 40 cm')).toBe('vertical')
    expect(normalizarOrientacao(null, 'lixo')).toBe('quadrado')
  })
})

describe('laminaEmCm — lâmina aberta', () => {
  it('quadrado: 30x30 → 60 × 30', () => expect(laminaEmCm({ formato: '30x30', orientacao: 'quadrado' })).toEqual({ largura: 60, altura: 30 }))
  it('horizontal usa o maior lado como largura da página', () => expect(laminaEmCm({ formato: '30x40', orientacao: 'horizontal' })).toEqual({ largura: 80, altura: 30 }))
  it('vertical usa o menor lado', () => expect(laminaEmCm({ formato: '30x40', orientacao: 'vertical' })).toEqual({ largura: 60, altura: 40 }))
  it('aceita formato e orientação escritos de outro jeito', () => expect(laminaEmCm({ formato: '30 x 40 cm', orientacao: 'Paisagem' })).toEqual({ largura: 80, altura: 30 }))
  it('formato inválido → null', () => expect(laminaEmCm({ formato: '0x30', orientacao: 'quadrado' })).toBeNull())
})

describe('DPI', () => {
  it('30x30 pede 7087 × 3544 px a 300 DPI', () => expect(pixelsMinimos({ formato: '30x30', orientacao: 'quadrado' })).toEqual({ largura: 7087, altura: 3544 }))
  it('6000 × 3000 px numa lâmina 30x30 dá 254 DPI', () => expect(dpiEfetivo(6000, 3000, { formato: '30x30', orientacao: 'quadrado' })).toBe(254))
  it('sem formato não calcula', () => expect(dpiEfetivo(6000, 3000, { formato: null, orientacao: null })).toBeNull())
})
