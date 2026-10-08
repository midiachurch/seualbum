import { describe, expect, it } from 'vitest'
import { colunasDoApontamento } from './apontamento'

const LAMINA = '44444444-4444-4444-8444-444444444444'

describe('colunasDoApontamento', () => {
  it('sem apontamento: tudo nulo', () => {
    expect(colunasDoApontamento(null)).toEqual({ lamina_id: null, posicao_x: null, posicao_y: null, area_largura: null, area_altura: null })
  })

  it('área pequena demais vira ponto', () => {
    expect(colunasDoApontamento({ laminaId: LAMINA, x: 10, y: 10, largura: 0.5, altura: 30 })).toMatchObject({ area_largura: null, area_altura: null })
  })

  it('arredonda em duas casas e corta na borda', () => {
    expect(colunasDoApontamento({ laminaId: LAMINA, x: 90.123, y: 5, largura: 30, altura: 10.006 })).toEqual({
      lamina_id: LAMINA,
      posicao_x: 90.12,
      posicao_y: 5,
      area_largura: 9.88,
      area_altura: 10.01,
    })
  })

  it('recusa posição fora da lâmina e lâmina inválida', () => {
    expect(() => colunasDoApontamento({ laminaId: LAMINA, x: 120, y: 5 })).toThrow()
    expect(() => colunasDoApontamento({ laminaId: 'x', x: 1, y: 1 })).toThrow('Lâmina inválida.')
  })
})
