import { describe, expect, it } from 'vitest'
import { caminhoInternoOu, caminhoInternoSeguro } from './redirect-seguro'

describe('caminhoInternoSeguro', () => {
  it('aceita caminhos internos, com query e hash', () => {
    expect(caminhoInternoSeguro('/dashboard')).toBe('/dashboard')
    expect(caminhoInternoSeguro('/admin/projetos/123?aba=prova#topo')).toBe('/admin/projetos/123?aba=prova#topo')
    expect(caminhoInternoSeguro('/dashboard/novo-pedido?plano=essencial')).toBe('/dashboard/novo-pedido?plano=essencial')
    // `@` no caminho é só caminho (não vira credencial de outro host).
    expect(caminhoInternoSeguro('/@evil.com')).toBe('/@evil.com')
    // Barra invertida codificada continua sendo caminho.
    expect(caminhoInternoSeguro('/%5Cevil.com')).toBe('/%5Cevil.com')
  })

  it('normaliza ../ sem sair da origem', () => {
    expect(caminhoInternoSeguro('/a/../admin')).toBe('/admin')
  })

  it.each([
    ['//evil.com'],
    ['/\\evil.com'],
    ['/\\/evil.com'],
    ['\\\\evil.com'],
    ['https://evil.com'],
    ['http:/evil.com'],
    ['javascript:alert(1)'],
    ['evil.com'],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['/\r\n/evil.com'],
    ['/\u0000x'],
    [''],
    [' /dashboard'],
  ])('recusa %j', (next) => {
    expect(caminhoInternoSeguro(next)).toBeNull()
  })

  it('recusa não-string e caminhos absurdamente longos', () => {
    expect(caminhoInternoSeguro(null)).toBeNull()
    expect(caminhoInternoSeguro(undefined)).toBeNull()
    expect(caminhoInternoSeguro(['/dashboard'])).toBeNull()
    expect(caminhoInternoSeguro(`/${'a'.repeat(3000)}`)).toBeNull()
  })

  it('caminhoInternoOu cai no padrão', () => {
    expect(caminhoInternoOu('/\\evil.com', '/dashboard')).toBe('/dashboard')
    expect(caminhoInternoOu('/cliente', '/dashboard')).toBe('/cliente')
  })
})
