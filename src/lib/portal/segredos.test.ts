import { describe, expect, it } from 'vitest'
import { cookiePortal, hashPortal, hashSessaoPortal, novoCodigo, novoSegredo, segredoValido } from './segredos'
describe('credenciais do portal', () => {
  it('gera segredos opacos distintos de 256 bits', () => { const a=novoSegredo(); expect(segredoValido(a)).toBe(true); expect(novoSegredo()).not.toBe(a) })
  it('valida entrada antes de usá-la em cookie/path', () => { for(const v of [null,{},'../portal','a'.repeat(63),'g'.repeat(64)]) expect(segredoValido(v)).toBe(false) })
  it('hash determinístico não armazena segredo bruto', () => { const s=novoSegredo(); expect(hashPortal(s)).toMatch(/^[a-f0-9]{64}$/); expect(hashPortal(s)).not.toBe(s); expect(hashPortal(s)).toBe(hashPortal(s)) })
  it('código mantém oito dígitos inclusive zeros à esquerda', () => { for(let i=0;i<10;i++) expect(novoCodigo()).toMatch(/^\d{8}$/) })
  it('hash de sessão fica vinculado ao link e não serve em outro portal', () => { const token=novoSegredo(); expect(hashSessaoPortal('a'.repeat(64),token)).not.toBe(hashSessaoPortal('b'.repeat(64),token)); expect(hashSessaoPortal('a'.repeat(64),token)).toBe(hashSessaoPortal('a'.repeat(64),token)) })
  it('cookie limita escopo e bloqueia acesso JS', () => { const o=cookiePortal('a'.repeat(64)); expect(o).toMatchObject({httpOnly:true,sameSite:'lax',path:`/portal/${'a'.repeat(64)}`,maxAge:28800}) })
})
