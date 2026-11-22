import { describe, expect, it } from 'vitest'
import { dobrarLinha, escaparTexto, formatarUtc, gerarIcs } from './ics'

const base = { uid: 'a1b2c3d4-0000-4000-8000-000000000001', inicio: '2026-12-10T12:00:00Z', fim: '2026-12-10T13:00:00Z', resumo: 'Ensaio', agora: new Date('2026-11-21T10:00:00Z') }

describe('iCalendar da reserva', () => {
  it('converte para UTC independente do fuso do offset de entrada', () => {
    expect(formatarUtc('2026-12-10T09:00:00-03:00')).toBe('20261210T120000Z')
    expect(formatarUtc('2026-12-10T12:00:00Z')).toBe('20261210T120000Z')
    expect(() => formatarUtc('amanhã')).toThrow()
  })
  it('gera um VEVENT completo com CRLF e fim de linha final', () => {
    const ics = gerarIcs(base)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('DTSTART:20261210T120000Z\r\n')
    expect(ics).toContain('DTEND:20261210T130000Z\r\n')
    expect(ics).toContain('DTSTAMP:20261121T100000Z\r\n')
    expect(ics).toContain('UID:a1b2c3d4-0000-4000-8000-000000000001@seualbum\r\n')
    expect(ics.split('\r\n').every(l => !l.includes('\n'))).toBe(true)
  })
  it('escapa vírgula, ponto e vírgula, barra e quebra de linha', () => {
    expect(escaparTexto('a,b;c\\d\ne')).toBe('a\\,b\;c\\\\d\\ne')
  })
  it('não deixa o texto do usuário injetar campos novos no arquivo', () => {
    const ics = gerarIcs({ ...base, resumo: 'Ensaio\r\nATTENDEE:mailto:x@x', descricao: 'ok\nEND:VEVENT' })
    expect(ics.split('\r\n').filter(l => l.startsWith('ATTENDEE')).length).toBe(0)
    expect(ics.split('\r\n').filter(l => l === 'END:VEVENT').length).toBe(1)
  })
  it('o uid é saneado', () => {
    expect(gerarIcs({ ...base, uid: 'x\r\nBEGIN:EVIL' })).not.toContain('BEGIN:EVIL')
  })
  it('dobra linhas longas em 75 octetos sem partir caractere multibyte', () => {
    const longa = 'DESCRIPTION:' + 'ção '.repeat(60)
    const dobrada = dobrarLinha(longa)
    for (const parte of dobrada.split('\r\n')) expect(new TextEncoder().encode(parte).length).toBeLessThanOrEqual(75)
    expect(dobrada.split('\r\n ').join('')).toBe(longa)
    expect(dobrarLinha('curta')).toBe('curta')
  })
})
