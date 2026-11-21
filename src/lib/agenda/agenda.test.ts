import { describe, expect, it } from 'vitest'
import {
  agruparSlotsPorDia, chaveDia, formatarReais, hojeNoFuso, instanteLocal, lerPeriodo, rotuloHora, somarDias,
} from './formatacao'
import { dataIsoValida, emailValido, erroAgenda, instanteValido, janelasValidas, slugValido, statusEfetivo, telefoneValido } from './regras'

describe('regras do Booking', () => {
  it('valida slug, e-mail, telefone, data e instante', () => {
    expect(slugValido('ensaio-gestante')).toBe(true)
    expect.soft(['Ab', 'a', '-abc', 'abc-', 'com espaço', 'x'.repeat(61)].some(slugValido)).toBe(false)
    expect(emailValido('ana@exemplo.com.br')).toBe(true)
    expect(emailValido('sem-arroba')).toBe(false)
    expect(telefoneValido('')).toBe(true)
    expect(telefoneValido('(11) 99999-0000')).toBe(true)
    expect(telefoneValido('abc')).toBe(false)
    expect(dataIsoValida('2027-02-28')).toBe(true)
    expect(dataIsoValida('2027-02-30')).toBe(false)
    expect(instanteValido('2026-11-26T13:00:00+00:00')).toBe(true)
    expect(instanteValido('amanhã')).toBe(false)
  })
  it('valida a grade semanal: dia, horas, fim 24:00 e sobreposição', () => {
    expect(janelasValidas([{ dia: 1, inicio: '09:00', fim: '12:00' }, { dia: 1, inicio: '13:00', fim: '24:00' }])).toBe(true)
    expect(janelasValidas([{ dia: 1, inicio: '09:00', fim: '12:00' }, { dia: 1, inicio: '11:00', fim: '13:00' }])).toBe(false)
    expect(janelasValidas([{ dia: 7, inicio: '09:00', fim: '12:00' }])).toBe(false)
    expect(janelasValidas([{ dia: 1, inicio: '12:00', fim: '09:00' }])).toBe(false)
    expect(janelasValidas('nada')).toBe(false)
  })
  it('traduz códigos do banco sem repassar mensagem interna', () => {
    expect(erroAgenda({ code: '23P01' }, 'x')).toMatch(/ocupado/)
    expect(erroAgenda({ code: '54000' }, 'x')).toMatch(/tentativas/)
    expect(erroAgenda({ code: '42501' }, 'x')).toMatch(/permissão/)
    expect(erroAgenda({ code: '55000' }, 'x', { '55000': 'prazo' })).toBe('prazo')
    expect(erroAgenda({ code: 'XX000', message: 'detalhe interno' } as { code: string }, 'padrão')).toBe('padrão')
    expect(erroAgenda(null, 'padrão')).toBe('padrão')
  })
  it('mostra hold vencido como expirado', () => {
    const agora = Date.parse('2026-11-26T12:00:00Z')
    expect(statusEfetivo({ status: 'hold', expira_em: '2026-11-26T11:59:00Z' }, agora)).toBe('expirada')
    expect(statusEfetivo({ status: 'hold', expira_em: '2026-11-26T12:05:00Z' }, agora)).toBe('hold')
    expect(statusEfetivo({ status: 'confirmada', expira_em: null }, agora)).toBe('confirmada')
  })
})

describe('formatação por fuso', () => {
  it('usa o fuso do recurso, não o do servidor', () => {
    const iso = '2026-11-26T01:30:00Z'
    expect(chaveDia(iso, 'America/Sao_Paulo')).toBe('2026-11-25')
    expect(chaveDia(iso, 'Asia/Tokyo')).toBe('2026-11-26')
    expect(rotuloHora(iso, 'America/Sao_Paulo')).toBe('22:30')
    expect(hojeNoFuso('Asia/Tokyo', Date.parse(iso))).toBe('2026-11-26')
  })
  it('soma dias sem depender do fuso e agrupa slots pelo dia local', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2027-03-01', -1)).toBe('2027-02-28')
    const grupos = agruparSlotsPorDia([
      { slot_inicio: '2026-11-26T12:00:00Z', slot_fim: '2026-11-26T13:00:00Z' },
      { slot_inicio: '2026-11-26T01:30:00Z', slot_fim: '2026-11-26T02:30:00Z' },
    ], 'America/Sao_Paulo')
    expect(grupos.map(g => g.dia)).toEqual(['2026-11-25', '2026-11-26'])
    expect(grupos[1].slots[0].hora).toBe('09:00')
  })
  it('converte relógio local em UTC, inclusive na virada do horário de verão', () => {
    expect(instanteLocal('2026-11-26T14:30', 'America/Sao_Paulo')).toBe('2026-11-26T17:30:00.000Z')
    expect(instanteLocal('2027-01-10T09:00', 'Asia/Tokyo')).toBe('2027-01-10T00:00:00.000Z')
    // Nova York: 13/03/2027 é EST (UTC-5); 15/03/2027 já é EDT (UTC-4).
    expect(instanteLocal('2027-03-13T12:00', 'America/New_York')).toBe('2027-03-13T17:00:00.000Z')
    expect(instanteLocal('2027-03-15T12:00', 'America/New_York')).toBe('2027-03-15T16:00:00.000Z')
    // Horário inexistente no salto (02:30 do dia 14/03) avança para o primeiro horário válido.
    expect(instanteLocal('2027-03-14T02:30', 'America/New_York')).toBe('2027-03-14T07:30:00.000Z')
    expect(instanteLocal('lixo', 'UTC')).toBeNull()
  })
  it('lê o intervalo textual de bloqueios e formata reais', () => {
    expect(lerPeriodo('["2026-11-26 03:00:00+00","2026-11-27 03:00:00+00")')).toEqual({ inicio: '2026-11-26T03:00:00.000Z', fim: '2026-11-27T03:00:00.000Z' })
    expect(lerPeriodo('vazio')).toBeNull()
    expect(formatarReais(5000).replace(/\s/g, ' ')).toBe('R$ 50,00')
  })
})
