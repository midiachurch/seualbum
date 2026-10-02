import { describe, expect, it } from 'vitest'
import { laminasIniciais, nomeDoLayout, prepararLayoutDoProjeto } from '@/lib/album/preparar-projeto'

const base = { nome: 'Casamento Ana & João', numero: 1041, albumConfig: { formato: '30x30', orientacao: 'quadrado' }, laminasInclusas: 25 }

describe('prepararLayoutDoProjeto — de onde vem o formato', () => {
  it('usa o formato do projeto', () => {
    const r = prepararLayoutDoProjeto(base)
    expect(r.ok && r.dados).toMatchObject({ formato: '30x30', orientacao: 'quadrado', laminas: 25, origemFormato: 'projeto' })
  })

  it('projeto vindo de pedido (sem formato): usa o produto', () => {
    const r = prepararLayoutDoProjeto({ ...base, albumConfig: {}, produtoFormato: '25x25' })
    expect(r.ok && r.dados).toMatchObject({ formato: '25x25', orientacao: 'quadrado', origemFormato: 'produto' })
  })

  it('sem projeto nem produto: pede o formato, sugerindo 30x30', () => {
    const r = prepararLayoutDoProjeto({ ...base, albumConfig: {} })
    expect(r).toMatchObject({ ok: false, precisaFormato: true, sugestao: '30x30' })
  })

  it('sem formato no projeto mas com produto inválido: pede, sem sugerir lixo', () => {
    const r = prepararLayoutDoProjeto({ ...base, albumConfig: {}, produtoFormato: 'Álbum grande' })
    expect(r).toMatchObject({ ok: false, sugestao: '30x30' })
  })

  it('a escolha da tela resolve', () => {
    const r = prepararLayoutDoProjeto({ ...base, albumConfig: {} }, { formato: '20 x 30 cm', orientacao: 'Retrato' })
    expect(r.ok && r.dados).toMatchObject({ formato: '20x30', orientacao: 'vertical', origemFormato: 'escolha' })
  })

  it('escolha inválida: continua pedindo, com mensagem clara', () => {
    const r = prepararLayoutDoProjeto({ ...base, albumConfig: {} }, { formato: '300x300', orientacao: 'quadrado' })
    expect(r).toMatchObject({ ok: false, precisaFormato: true })
    expect(!r.ok && r.erro).toMatch(/5 a 100/)
  })

  it.each([
    ['30 x 30 cm', '30x30'],
    ['30X40', '30x40'],
    ['20,5x30', '20.5x30'],
  ])('formato escrito "%s" no projeto vira %s', (formato, esperado) => {
    const r = prepararLayoutDoProjeto({ ...base, albumConfig: { formato } })
    expect(r.ok && r.dados.formato).toBe(esperado)
  })

  it('orientação ausente num formato retangular: deduz', () => {
    const r = prepararLayoutDoProjeto({ ...base, albumConfig: { formato: '30x40' } })
    expect(r.ok && r.dados.orientacao).toBe('vertical')
  })

  it('orientação com outro nome', () => {
    const r = prepararLayoutDoProjeto({ ...base, albumConfig: { formato: '30x40', orientacao: 'paisagem' } })
    expect(r.ok && r.dados.orientacao).toBe('horizontal')
  })

  it.each([['texto'], [['30x30']], [null], [undefined], [42]])('album_config que não é objeto (%j) não quebra', (albumConfig) => {
    const r = prepararLayoutDoProjeto({ ...base, albumConfig, produtoFormato: '30x30' })
    expect(r.ok).toBe(true)
  })

  it('tipo longo é cortado em 40; tipo vazio vira null', () => {
    const longo = prepararLayoutDoProjeto({ ...base, albumConfig: { formato: '30x30', tipo: 'x'.repeat(90) } })
    expect(longo.ok && longo.dados.tipo?.length).toBe(40)
    const vazio = prepararLayoutDoProjeto({ ...base, albumConfig: { formato: '30x30', tipo: '   ' } })
    expect(vazio.ok && vazio.dados.tipo).toBeNull()
  })
})

describe('nomeDoLayout — limites do banco (2–120)', () => {
  it('nome normal', () => expect(nomeDoLayout('  Ana   &  João ', 1)).toBe('Ana & João'))
  it('nome longo é cortado em 120', () => expect(nomeDoLayout('a'.repeat(300), 1)).toHaveLength(120))
  it('nome de 1 letra → Projeto #N', () => expect(nomeDoLayout('A', 1041)).toBe('Projeto #1041'))
  it('nome vazio → Projeto #N', () => expect(nomeDoLayout('', 1041)).toBe('Projeto #1041'))
  it('sem nome e sem número', () => expect(nomeDoLayout(null, null)).toBe('Álbum sem nome'))
})

describe('laminasIniciais — 1 a 200', () => {
  it.each([
    [25, 25],
    ['25', 25],
    [null, 1],
    [undefined, 1],
    [0, 1],
    [-3, 1],
    [2.7, 2],
    [500, 200],
    ['abc', 1],
  ])('%j → %d', (v, esperado) => expect(laminasIniciais(v)).toBe(esperado))
})
