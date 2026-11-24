import { describe, expect, it } from 'vitest'
import { hashTokenEntrega, tokenEntrega } from './token'

describe('token de entrega', () => {
  const chave = 'a1000000-0000-4000-8000-000000000001'
  it('é estável para a mesma chave (retry) e distinto entre chaves', () => {
    expect(tokenEntrega(chave, 'p')).toBe(tokenEntrega(chave, 'p'))
    expect(tokenEntrega(chave, 'p')).not.toBe(tokenEntrega('a2000000-0000-4000-8000-000000000001', 'p'))
    expect(tokenEntrega(chave.toUpperCase(), 'p')).toBe(tokenEntrega(chave, 'p'))
  })
  it('o pepper muda o token: só a chave não basta para derivá-lo', () => {
    expect(tokenEntrega(chave, 'a')).not.toBe(tokenEntrega(chave, 'b'))
    expect(tokenEntrega(chave, '')).toMatch(/^[a-f0-9]{64}$/)
  })
  it('o hash guardado no banco não é o token', () => {
    const t = tokenEntrega(chave, 'p')
    expect(hashTokenEntrega(t)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashTokenEntrega(t)).not.toBe(t)
  })
})
