import { describe, expect, it } from 'vitest'
import { normalizarNomeOriginal } from './nome-original'

describe('nome original de apresentação', () => {
  it('remove diretórios e controles sem criar caminho ou interpretar HTML', () => {
    expect(normalizarNomeOriginal('../../pasta/foto\u0000.jpg')).toBe('foto.jpg')
    expect(normalizarNomeOriginal('C:\\pasta\\foto.jpg')).toBe('foto.jpg')
    expect(normalizarNomeOriginal(' <foto>.jpg ')).toBe('<foto>.jpg')
  })
  it('limita nome e rejeita ausente/especial, sem inventar legado', () => {
    for (const value of [null, {}, '', '.', '..']) expect(normalizarNomeOriginal(value)).toBeNull()
    expect(normalizarNomeOriginal('a'.repeat(300))?.length).toBe(240)
  })
})
