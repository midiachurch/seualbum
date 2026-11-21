import { describe, expect, it } from 'vitest'
import { formatarMoeda, percentualParaBps, reaisParaCentavos } from './formato'

describe('formato da Store', () => {
  it('converte reais em centavos sem erro de ponto flutuante', () => {
    expect(reaisParaCentavos('99,90')).toBe(9990)
    expect(reaisParaCentavos('99.9')).toBe(9990)
    expect(reaisParaCentavos('R$ 1.234,50')).toBe(123450)
    expect(reaisParaCentavos('0,07')).toBe(7)
    expect(reaisParaCentavos('19')).toBe(1900)
    expect(reaisParaCentavos('1.005,1')).toBe(100510)
    expect(reaisParaCentavos('0')).toBe(0)
  })
  it('recusa entrada ambígua ou inválida em vez de arredondar', () => {
    for (const x of ['', 'abc', '-5', '1,234', '12,345', '1.23,4', '99,9,9', '10000000']) expect(reaisParaCentavos(x)).toBeNull()
  })
  it('converte percentual em pontos-base dentro de 0–50%', () => {
    expect(percentualParaBps('10')).toBe(1000)
    expect(percentualParaBps('7,5%')).toBe(750)
    expect(percentualParaBps('0')).toBe(0)
    expect(percentualParaBps('50')).toBe(5000)
    for (const x of ['51', '-1', 'abc', '', '1,234']) expect(percentualParaBps(x)).toBeNull()
  })
  it('formata moeda e não inventa valor', () => {
    expect(formatarMoeda(9900)).toMatch(/99,00$/)
    expect(formatarMoeda(Number.NaN)).toBe('—')
  })
})
