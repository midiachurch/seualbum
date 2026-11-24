import { describe, expect, it } from 'vitest'
import { aplicarComando, calcularConsumoLocal, criarEstadoInicial, listarGalerias, verificarAcessoLocal, type EstadoLocal } from './modelo'
import { carregarEstado, CHAVE_ESTADO_LOCAL, salvarEstado, validarEstadoLocal, type ArmazenamentoLocal } from './repositorio'

const inicial = () => criarEstadoInicial()
const entregar = (estado: EstadoLocal, chave = 'entrega-1', fotoIds = ['foto-1']) => aplicarComando(estado, { tipo: 'entregar_selecao', galeriaId: 'galeria-ensaio', fotoIds, revisaoEsperada: 0, chave })

describe('domínio da operação local', () => {
  it('nega comandos e leitura em outro estúdio', () => {
    expect(listarGalerias(inicial(), 'outro')).toEqual([])
    expect(() => aplicarComando(inicial(), { tipo: 'simular_assinatura', plano: 'Teste' }, 'outro')).toThrow('Estúdio inválido')
    const estado = inicial()
    estado.galerias[0].proprietarioId = 'outro'
    expect(() => aplicarComando(estado, { tipo: 'definir_favorita', galeriaId: 'galeria-ensaio', fotoId: 'foto-1', favorita: true })).toThrow('indisponível')
  })

  it('favorito é reversível e não altera snapshot entregue', () => {
    const origem = inicial()
    const favoritado = aplicarComando(origem, { tipo: 'definir_favorita', galeriaId: 'galeria-ensaio', fotoId: 'foto-1', favorita: true })
    const entregue = entregar(favoritado)
    const desmarcado = aplicarComando(entregue, { tipo: 'definir_favorita', galeriaId: 'galeria-ensaio', fotoId: 'foto-1', favorita: false })
    expect(origem.galerias[0].favoritas).toEqual([])
    expect(desmarcado.galerias[0].favoritas).toEqual([])
    expect(desmarcado.galerias[0].selecoes[0].fotoIds).toEqual(['foto-1'])
  })

  it('retry exato mantém snapshot e evento únicos mesmo após favorito mudar', () => {
    const estado = entregar(inicial())
    const alterado = aplicarComando(estado, { tipo: 'definir_favorita', galeriaId: 'galeria-ensaio', fotoId: 'foto-2', favorita: true })
    expect(entregar(alterado)).toBe(alterado)
    expect(alterado.galerias[0].selecoes).toHaveLength(1)
    expect(alterado.atividades).toHaveLength(1)
    expect(() => entregar(alterado, 'entrega-1', ['foto-2'])).toThrow('outra seleção')
    expect(() => aplicarComando(alterado, { tipo: 'entregar_selecao', galeriaId: 'galeria-ensaio', fotoIds: ['foto-1'], revisaoEsperada: 1, chave: 'entrega-1' })).toThrow('outra seleção ou revisão')
  })

  it('nega revisão antiga, foto cruzada, duplicada e entrega vazia atomicamente', () => {
    const estado = entregar(inicial())
    expect(() => entregar(estado, 'nova')).toThrow('atualizada')
    expect(() => entregar(inicial(), 'nova', ['evento-1'])).toThrow('não pertence')
    expect(() => entregar(inicial(), 'nova', ['foto-1', 'foto-1'])).toThrow('distintas')
    expect(() => entregar(inicial(), 'nova', [])).toThrow('ao menos uma')
    expect(estado.galerias[0].selecoes).toHaveLength(1)
  })

  it('revoga acesso local sem fingir autenticação', () => {
    const estado = inicial()
    expect(verificarAcessoLocal(estado.galerias[0], 'LOCAL2026')).toBe(true)
    const revogado = aplicarComando(estado, { tipo: 'alterar_acesso', galeriaId: 'galeria-ensaio', ativo: false })
    expect(verificarAcessoLocal(revogado.galerias[0], 'LOCAL2026')).toBe(false)
    expect(() => aplicarComando(estado, { tipo: 'alterar_acesso', galeriaId: 'galeria-ensaio', ativo: true, codigo: 'abc' })).toThrow('4 a 32')
  })

  it('aceita arquivo local persistível e nega URL externa ou identidade duplicada', () => {
    const foto = { id: 'nova', nome: 'nova.jpg', url: 'arquivo-local:nova', bytes: 20, tipo: 'image/jpeg', participantes: [] }
    const estado = aplicarComando(inicial(), { tipo: 'adicionar_fotos', galeriaId: 'galeria-ensaio', fotos: [foto] })
    expect(estado.galerias[0].fotos.at(-1)).toEqual(foto)
    for (const url of ['//example.com/a.jpg', 'https://example.com/a.jpg', 'arquivo-local:outra', '/images/../api/privado', '/api/privado', '/\\externo.jpg']) expect(() => aplicarComando(inicial(), { tipo: 'adicionar_fotos', galeriaId: 'galeria-ensaio', fotos: [{ ...foto, url }] })).toThrow('inválidos')
    expect(() => aplicarComando(estado, { tipo: 'adicionar_fotos', galeriaId: 'galeria-ensaio', fotos: [foto] })).toThrow('inválidos')
  })

  it('cria evento e rejeita datas impossíveis', () => {
    expect(() => aplicarComando(inicial(), { tipo: 'criar_evento', galeriaId: 'galeria-evento', nome: 'Evento', data: '2026-02-30', local: 'Estúdio' })).toThrow('data válida')
    const estado = aplicarComando(inicial(), { tipo: 'criar_evento', galeriaId: 'galeria-evento', nome: 'Evento', data: '2026-12-01', local: 'Estúdio' })
    expect(estado.eventos[0].galeriaId).toBe('galeria-evento')
  })

  it('pedidos usam preço do catálogo e conservam snapshot e transições terminais', () => {
    let estado = aplicarComando(inicial(), { tipo: 'criar_produto', nome: 'Produto teste', produtoTipo: 'produto', descricao: '', precoCentavos: 1234 })
    const produtoId = estado.catalogo[0].id
    expect(() => aplicarComando(estado, { tipo: 'criar_pedido', galeriaId: 'galeria-ensaio', produtoId, fotoIds: [] })).toThrow('não está disponível')
    estado = aplicarComando(estado, { tipo: 'vincular_produto', galeriaId: 'galeria-ensaio', produtoId, vinculado: true })
    estado = aplicarComando(estado, { tipo: 'criar_pedido', galeriaId: 'galeria-ensaio', produtoId, fotoIds: ['foto-1'] })
    expect(estado.pedidos[0]).toMatchObject({ totalCentavos: 1234, simulacao: true, status: 'solicitado' })
    estado.catalogo[0].precoCentavos = 5678
    expect(estado.pedidos[0].totalCentavos).toBe(1234)
    const pedidoId = estado.pedidos[0].id
    expect(() => aplicarComando(estado, { tipo: 'alterar_pedido', pedidoId, status: 'concluido' })).toThrow('mudança de etapa')
    estado = aplicarComando(estado, { tipo: 'alterar_pedido', pedidoId, status: 'em_preparacao' })
    estado = aplicarComando(estado, { tipo: 'alterar_pedido', pedidoId, status: 'concluido' })
    expect(() => aplicarComando(estado, { tipo: 'alterar_pedido', pedidoId, status: 'solicitado' })).toThrow('mudança de etapa')
    expect(() => aplicarComando(estado, { tipo: 'criar_produto', nome: 'X', produtoTipo: 'servico', descricao: '', precoCentavos: -1 })).toThrow('centavos')
  })

  it('assinatura é explicitamente uma simulação sem cobrança', () => {
    expect(aplicarComando(inicial(), { tipo: 'simular_assinatura', plano: 'Plano em avaliação' }).assinatura).toEqual({ plano: 'Plano em avaliação', status: 'simulada', simulacao: true })
  })

  it('consumo soma arquivos reais sem cobrar bytes dos exemplos e rejeita negativos ou overflow', () => {
    const foto = { id: 'arquivo-teste', nome: 'teste.jpg', url: 'arquivo-local:arquivo-teste', bytes: 12345, tipo: 'image/jpeg', participantes: [] }
    const estado = aplicarComando(inicial(), { tipo: 'adicionar_fotos', galeriaId: 'galeria-ensaio', fotos: [foto] })
    expect(calcularConsumoLocal(estado)).toEqual({ bytes: 12345, fotos: 7, galerias: 2 })
    estado.galerias[0].fotos[0].bytes = -1
    expect(() => calcularConsumoLocal(estado)).toThrow('consumo local')
    expect(validarEstadoLocal(estado)).toBe(false)
    estado.galerias[0].fotos[0].bytes = Number.MAX_SAFE_INTEGER
    expect(() => calcularConsumoLocal(estado)).toThrow('consumo local')
    expect(validarEstadoLocal(estado)).toBe(false)
  })
})

describe('persistência local validada', () => {
  function memoria(inicio: string | null = null): ArmazenamentoLocal & { bruto: string | null } {
    return { bruto: inicio, getItem(chave) { expect(chave).toBe(CHAVE_ESTADO_LOCAL); return this.bruto }, setItem(chave, valor) { expect(chave).toBe(CHAVE_ESTADO_LOCAL); this.bruto = valor } }
  }
  it('recupera estado entregue com referências e revisão preservadas', () => {
    const storage = memoria()
    const estado = entregar(inicial())
    salvarEstado(estado, storage)
    expect(carregarEstado(storage)).toEqual(estado)
  })
  it('preserva conteúdo corrompido em vez de substituí-lo silenciosamente', () => {
    const storage = memoria('{quebrado')
    expect(() => carregarEstado(storage)).toThrow('preservados')
    expect(storage.bruto).toBe('{quebrado')
    expect(() => carregarEstado(memoria(JSON.stringify({ versao: 2 })))).toThrow('incompatível')
  })
  it('nega referências cruzadas, versões falsificadas e estados financeiros reais', () => {
    const cruzado = inicial()
    cruzado.galerias[0].favoritas = ['evento-1']
    expect(validarEstadoLocal(cruzado)).toBe(false)
    const snapshot = entregar(inicial())
    snapshot.galerias[0].selecoes[0].revisaoEsperada = 9
    expect(validarEstadoLocal(snapshot)).toBe(false)
    const outroDono = inicial()
    outroDono.catalogo[0].proprietarioId = 'outro'
    expect(() => salvarEstado(outroDono, memoria())).toThrow('validados')
    const financeiro = inicial() as unknown as { assinatura: { simulacao: boolean } }
    financeiro.assinatura.simulacao = false
    expect(validarEstadoLocal(financeiro)).toBe(false)
    let pedidoCruzado = aplicarComando(inicial(), { tipo: 'criar_pedido', galeriaId: 'galeria-ensaio', produtoId: 'servico-diagramacao', fotoIds: ['foto-1'] })
    pedidoCruzado = structuredClone(pedidoCruzado)
    pedidoCruzado.pedidos[0].fotoIds = ['evento-1']
    expect(validarEstadoLocal(pedidoCruzado)).toBe(false)
  })
  it('reporta falha de quota para impedir falso sucesso', () => {
    expect(() => salvarEstado(inicial(), { getItem: () => null, setItem: () => { throw new Error('quota') } })).toThrow('Não foi possível salvar')
  })
})
