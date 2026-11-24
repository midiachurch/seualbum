import { describe, expect, it } from 'vitest'
import { formatarBytes, formatarPrecoMensal, rotuloSituacao } from './formato'

describe('formatação da franquia', () => {
  it('usa base decimal, igual à capacidade dos planos', () => {
    expect(formatarBytes(0)).toBe('0 B')
    expect(formatarBytes(999)).toBe('999 B')
    expect(formatarBytes(10_000_000_000)).toBe('10 GB')
    expect(formatarBytes(1_500_000_000)).toBe('1,5 GB')
    expect(formatarBytes(500_000_000_000)).toBe('500 GB')
    expect(formatarBytes(2_000_000_000_000)).toBe('2 TB')
  })
  it('não inventa valor para entrada inválida', () => {
    expect(formatarBytes(-1)).toBe('—')
    expect(formatarBytes(Number.NaN)).toBe('—')
    expect(formatarBytes(Number.POSITIVE_INFINITY)).toBe('—')
  })
  it('formata preço mensal em reais', () => {
    expect(formatarPrecoMensal(4900)).toMatch(/49,00\/mês$/)
    expect(formatarPrecoMensal(19900)).toMatch(/199,00\/mês$/)
  })
  it('rotula todas as situações do servidor', () => {
    expect(rotuloSituacao('dentro')).toBe('Dentro da franquia')
    expect(rotuloSituacao('alerta')).toBe('Perto do limite da franquia')
    expect(rotuloSituacao('excedida')).toBe('Franquia excedida')
    expect(rotuloSituacao('sem_plano')).toBe('Nenhum plano escolhido')
  })
})
