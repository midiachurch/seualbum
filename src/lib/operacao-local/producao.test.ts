import { describe, expect, it } from 'vitest'
import { aplicarComando, criarEstadoInicial, type EstadoLocal } from './modelo'
import { obterProducao, type ComandoProducaoLocal } from './producao'
import { validarEstadoLocal } from './repositorio'

const galeriaId = 'galeria-ensaio'
const base = (s: EstadoLocal, ator: 'fotografo' | 'cliente' = 'fotografo') => ({ galeriaId, ator, revisaoEsperada: obterProducao(s, galeriaId)?.revisao ?? 0 })
const enviar = (s: EstadoLocal, comando: ComandoProducaoLocal) => aplicarComando(s, { tipo: 'producao', comando })
function iniciar(opcao: 'propria' | 'seualbum' = 'propria') {
  let s = aplicarComando(criarEstadoInicial(), { tipo: 'entregar_selecao', galeriaId, fotoIds: ['foto-1'], revisaoEsperada: 0, chave: 'selecao' })
  s = enviar(s, { ...base(s), tipo: 'escolher_diagramacao', opcao, selecaoId: s.galerias[0].selecoes[0].id })
  return enviar(s, { ...base(s), tipo: 'criar_versao' })
}
function publicar(s: EstadoLocal, nome: string) {
  const v = obterProducao(s, galeriaId)!.versoes.at(-1)!
  s = enviar(s, { ...base(s), tipo: 'adicionar_laminas', versaoId: v.id, laminas: [{ id: `lamina-${nome}`, nome: `${nome}.webp`, url: '/images/estilos/editorial.webp', bytes: 120, tipo: 'image/webp', largura: 800, altura: 600 }] })
  return enviar(s, { ...base(s), tipo: 'publicar', versaoId: v.id, chave: `publicar-${nome}` })
}

describe('produção local integrada à seleção', () => {
  it('mantém vínculo com seleção e não confunde favorito com aprovação', () => {
    let s = iniciar()
    expect(s.pedidos).toHaveLength(0)
    s = aplicarComando(s, { tipo: 'definir_favorita', galeriaId, fotoId: 'foto-2', favorita: true })
    expect(obterProducao(s, galeriaId)!.versoes[0].fotoIds).toEqual(['foto-1'])
    expect(obterProducao(s, galeriaId)!.versoes[0].status).toBe('rascunho')
    expect(validarEstadoLocal(s)).toBe(true)
  })
  it('serviço cria uma solicitação com preço preservado e sem comissão', () => {
    let s = iniciar('seualbum')
    expect(s.pedidos).toHaveLength(1)
    expect(s.pedidos[0]).toMatchObject({ totalCentavos: 19900, financeiro: { comissaoCentavos: 0 } })
    s = aplicarComando(s, { tipo: 'editar_produto', produtoId: 'servico-diagramacao', nome: 'Novo preço', precoCentavos: 29900 })
    expect(s.pedidos[0].totalCentavos).toBe(19900)
    expect(validarEstadoLocal(s)).toBe(true)
  })
  it('publicação torna arquivos imutáveis; ajustes geram nova versão e aprovação fecha revisão', () => {
    let s = publicar(iniciar(), 'primeira')
    const v1 = obterProducao(s, galeriaId)!.versoes[0]
    expect(() => enviar(s, { ...base(s), tipo: 'remover_lamina', versaoId: v1.id, laminaId: v1.laminas[0].id })).toThrow('não podem ser alteradas')
    s = enviar(s, { ...base(s, 'cliente'), tipo: 'comentar', versaoId: v1.id, laminaId: v1.laminas[0].id, texto: 'Ajustar capa', x: 25, y: 50, chave: 'comentario-1' })
    s = enviar(s, { ...base(s, 'cliente'), tipo: 'solicitar_ajustes', versaoId: v1.id, texto: 'Ajustar capa', chave: 'ajuste-1' })
    s = enviar(s, { ...base(s), tipo: 'criar_versao' })
    s = publicar(s, 'segunda')
    const v2 = obterProducao(s, galeriaId)!.versoes[1]
    const comando: ComandoProducaoLocal = { ...base(s, 'cliente'), tipo: 'aprovar', versaoId: v2.id, chave: 'aprovar-2' }
    s = enviar(s, comando)
    expect(enviar(s, comando)).toBe(s)
    expect(obterProducao(s, galeriaId)!.versoes.map(v => v.status)).toEqual(['ajustes', 'aprovada'])
    expect(obterProducao(s, galeriaId)!.versoes[0].comentarios[0]).toMatchObject({ texto: 'Ajustar capa', x: 25, y: 50 })
    expect(() => enviar(s, { ...base(s, 'cliente'), tipo: 'aprovar', versaoId: v1.id, chave: 'outra' })).toThrow('mais recente')
    expect(validarEstadoLocal(s)).toBe(true)
  })
  it('nega decisão do fotógrafo, revisão antiga e cliente revogado', () => {
    let s = publicar(iniciar(), 'teste')
    const versaoId = obterProducao(s, galeriaId)!.versoes[0].id
    expect(() => enviar(s, { ...base(s), tipo: 'aprovar', versaoId, chave: 'x' })).toThrow('modo cliente')
    expect(() => enviar(s, { ...base(s, 'cliente'), revisaoEsperada: 0, tipo: 'aprovar', versaoId, chave: 'x' })).toThrow('mudou')
    s = aplicarComando(s, { tipo: 'alterar_acesso', galeriaId, ativo: false })
    expect(() => enviar(s, { ...base(s, 'cliente'), tipo: 'aprovar', versaoId, chave: 'x' })).toThrow('revogado')
    expect(validarEstadoLocal(s)).toBe(true)
  })
})
