import { describe, expect, it } from 'vitest'
import { albunsDaRevisao, criacaoValida, destinoSugerido, enderecoDoEditor, entradaCriarAlbumValida, resumoValido } from './contrato'

const id = 'a1000000-0000-4000-8000-000000000001'
const ok = { selecaoId: id, destino: 'projeto' as const, chave: id }
const criacao = { layout_id: id, vinculo_id: id, revisao: 1, total: 3, destino: 'avulso' as const, criado: true }

describe('contrato seleção → álbum (lado do app)', () => {
  it('valida a entrada e rejeita o resto', () => {
    expect(entradaCriarAlbumValida(ok)).toBe(true)
    expect(entradaCriarAlbumValida({ ...ok, destino: 'avulso', nome: 'Versão pais', formato: '30x30', orientacao: 'quadrado' })).toBe(true)
    for (const ruim of [
      { ...ok, selecaoId: 'x' },
      { ...ok, chave: '' },
      { ...ok, destino: 'qualquer' },
      { ...ok, nome: 42 },
      { ...ok, formato: 'x'.repeat(21) },
      { ...ok, orientacao: 'diagonal' },
    ]) {
      expect(entradaCriarAlbumValida(ruim as never)).toBe(false)
    }
    expect(entradaCriarAlbumValida(null as never)).toBe(false)
  })

  it('só aceita resposta de criação completa e coerente', () => {
    expect(criacaoValida(criacao)).toBe(true)
    expect(criacaoValida({ ...criacao, total: 0 })).toBe(false)
    expect(criacaoValida({ ...criacao, revisao: 1.5 })).toBe(false)
    expect(criacaoValida({ ...criacao, destino: 'x' })).toBe(false)
    expect(criacaoValida({ ...criacao, layout_id: 'x' })).toBe(false)
    expect(criacaoValida(null)).toBe(false)
    expect(criacaoValida({ ...criacao, criado: 'sim' })).toBe(false)
  })

  it('resumo: forma, destino sugerido e agrupamento por revisão', () => {
    const resumo = {
      papel: 'dono' as const,
      pode_criar: true,
      pode_abrir_editor: false,
      tem_album_projeto: true,
      albuns: [
        { layout_id: id, selecao_id: id, revisao: 1, destino: 'projeto' as const, total: 3, criado_em: '2026-11-22T00:00:00Z' },
        { layout_id: id, selecao_id: id, revisao: 2, destino: 'avulso' as const, total: 5, criado_em: '2026-11-22T00:00:00Z' },
      ],
    }
    expect(resumoValido(resumo)).toBe(true)
    expect(resumoValido({ pode_criar: true })).toBe(false)
    expect(destinoSugerido(resumo)).toBe('avulso')
    expect(destinoSugerido({ tem_album_projeto: false })).toBe('projeto')
    expect(albunsDaRevisao(resumo, 2)).toHaveLength(1)
    expect(albunsDaRevisao(resumo, 9)).toEqual([])
  })

  it('endereço do editor: o do projeto para o álbum do projeto, o do álbum para o avulso', () => {
    expect(enderecoDoEditor('p1', { layout_id: 'l1', destino: 'projeto' })).toBe('/admin/projetos/p1/editor')
    expect(enderecoDoEditor('p1', { layout_id: 'l1', destino: 'avulso' })).toBe('/admin/albuns/l1')
  })
})
