import { describe, expect, it } from 'vitest'
import { arquivosNovos, comporVersaoCompleta, comporVersaoParcial, type LaminaBase } from './versao-parcial'

const base: LaminaBase[] = [1, 2, 3, 4].map((ordem) => ({
  id: `l${ordem}`,
  ordem,
  bucket: 'r2',
  storage_path: `v1/${ordem}.jpg`,
  largura: 6000,
  altura: 3000,
  eh_capa: ordem === 1,
}))
const novo = (nome: string) => ({ storagePath: `v2/${nome}.jpg`, largura: 6000, altura: 3000 })

describe('comporVersaoParcial', () => {
  it('troca só a lâmina pedida e herda as outras', () => {
    const r = comporVersaoParcial(base, { substituir: [{ ordem: 3, ...novo('tres') }], remover: [], adicionar: [] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.laminas.map((l) => [l.ordem, l.storage_path, l.alterada, l.origem_lamina_id])).toEqual([
      [1, 'v1/1.jpg', false, 'l1'],
      [2, 'v1/2.jpg', false, 'l2'],
      [3, 'v2/tres.jpg', true, 'l3'],
      [4, 'v1/4.jpg', false, 'l4'],
    ])
    expect(arquivosNovos(r.laminas)).toEqual(['v2/tres.jpg'])
  })

  it('remove, adiciona no fim e renumera', () => {
    const r = comporVersaoParcial(base, { substituir: [], remover: [2], adicionar: [novo('extra')] })
    if (!r.ok) throw new Error(r.erro)
    expect(r.laminas.map((l) => [l.ordem, l.storage_path])).toEqual([
      [1, 'v1/1.jpg'],
      [2, 'v1/3.jpg'],
      [3, 'v1/4.jpg'],
      [4, 'v2/extra.jpg'],
    ])
  })

  it('mantém a capa ao substituir a lâmina 1 e a perde se ela for removida', () => {
    const trocada = comporVersaoParcial(base, { substituir: [{ ordem: 1, ...novo('capa') }], remover: [], adicionar: [] })
    if (!trocada.ok) throw new Error(trocada.erro)
    expect(trocada.laminas[0]).toMatchObject({ eh_capa: true, alterada: true })

    const semCapa = comporVersaoParcial(base, { substituir: [], remover: [1], adicionar: [] })
    if (!semCapa.ok) throw new Error(semCapa.erro)
    expect(semCapa.laminas.some((l) => l.eh_capa)).toBe(false)
  })

  it('recusa versão sem mudança, ordem inexistente e conflito', () => {
    expect(comporVersaoParcial(base, { substituir: [], remover: [], adicionar: [] }).ok).toBe(false)
    expect(comporVersaoParcial(base, { substituir: [{ ordem: 9, ...novo('x') }], remover: [], adicionar: [] }).ok).toBe(false)
    expect(comporVersaoParcial(base, { substituir: [{ ordem: 2, ...novo('x') }], remover: [2], adicionar: [] }).ok).toBe(false)
    expect(comporVersaoParcial(base, { substituir: [], remover: [1, 2, 3, 4], adicionar: [] }).ok).toBe(false)
  })
})

describe('comporVersaoCompleta', () => {
  it('marca tudo como alterado e a capa só na ordem 1', () => {
    const r = comporVersaoCompleta([{ ordem: 2, ...novo('b') }, { ordem: 1, ...novo('a') }], true)
    if (!r.ok) throw new Error(r.erro)
    expect(r.laminas.map((l) => [l.ordem, l.eh_capa, l.alterada, l.bucket])).toEqual([
      [1, true, true, 'r2'],
      [2, false, true, 'r2'],
    ])
  })

  it('recusa buraco na ordem', () => {
    expect(comporVersaoCompleta([{ ordem: 1, ...novo('a') }, { ordem: 3, ...novo('c') }], false).ok).toBe(false)
  })
})
