import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MIMES_LOGO, MIMES_MIDIA } from './chaves'

/**
 * scripts/copiar-storage-para-r2.mjs roda sozinho (node, sem o alias `@/`),
 * então repete as listas de tipos do bucket público. Este teste garante que
 * as cópias não se afastam de chaves.ts e que nenhuma inclui SVG/HTML.
 */
const script = readFileSync(fileURLToPath(new URL('../../../scripts/copiar-storage-para-r2.mjs', import.meta.url)), 'utf8')

function listaDoScript(nome: string) {
  const m = new RegExp(`const ${nome} = new Set\\(\\[([^\\]]*)\\]\\)`).exec(script)
  if (!m) throw new Error(`${nome} não encontrada no script`)
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))
}

describe('script de cópia para o R2: tipos aceitos no bucket público', () => {
  it('mídia e logos com as mesmas listas das rotas de upload', () => {
    expect(listaDoScript('MIMES_MIDIA')).toEqual(MIMES_MIDIA)
    expect(listaDoScript('MIMES_LOGO')).toEqual(MIMES_LOGO)
  })

  it('nenhuma lista pública aceita SVG ou HTML', () => {
    for (const lista of [listaDoScript('MIMES_MIDIA'), listaDoScript('MIMES_LOGO')]) {
      expect([...lista].some((t) => /svg|html|xml|javascript/.test(t))).toBe(false)
    }
  })

  it('as cópias para o bucket público passam a lista', () => {
    expect(script).toMatch(/copiar\('midia_vitrine', [^)]*, MIMES_MIDIA\)/)
    expect(script).toMatch(/copiar\('fotografo_logos', [^)]*, MIMES_LOGO\)/)
  })
})
