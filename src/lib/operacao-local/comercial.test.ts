import { describe, expect, it } from 'vitest'
import { calcularFinanceiroLocal, configPadrao, lerConfigComercial, validarConfigComercial } from './comercial'
import { aplicarComando, criarEstadoInicial } from './modelo'
import { carregarEstado, salvarEstado, validarEstadoLocal } from './repositorio'

describe('hipóteses comerciais locais', () => {
  it('disponibiliza planos simulados e leitura defensiva sem mudar estados antigos', () => {
    const estado = criarEstadoInicial()
    delete estado.comercial
    estado.catalogo[0].precoCentavos = null
    const antes = structuredClone(estado)
    expect(lerConfigComercial(estado).planos.map(plano => [plano.precoMensalCentavos, plano.armazenamentoBytes])).toEqual([[4900, 10_000_000_000], [9900, 100_000_000_000], [19900, 500_000_000_000]])
    let bruto = JSON.stringify(estado)
    const storage = { getItem: () => bruto, setItem: (_chave: string, valor: string) => { bruto = valor } }
    expect(carregarEstado(storage)).toEqual(antes)
    expect(carregarEstado(storage).catalogo[0].precoCentavos).toBeNull()
    expect(estado).toEqual(antes)
    const config = lerConfigComercial(estado)
    config.planos[0].precoMensalCentavos = 1
    expect(lerConfigComercial(estado).planos[0].precoMensalCentavos).toBe(4900)
    salvarEstado(estado, storage)
    expect(JSON.parse(bruto).comercial).toBeUndefined()
  })

  it('nega configurações malformadas e dono diferente sem modificar original', () => {
    const config = configPadrao()
    for (const invalida of [
      { ...config, comissaoEventoBps: -1 }, { ...config, comissaoEventoBps: 10001 }, { ...config, comissaoSelecaoBps: 0.5 },
      { ...config, planos: [] }, { ...config, planos: [config.planos[0], config.planos[0]] },
      { ...config, planos: [{ ...config.planos[0], precoMensalCentavos: Number.MAX_SAFE_INTEGER + 1 }] },
      { ...config, planos: [{ ...config.planos[0], armazenamentoBytes: 0 }] },
    ]) {
      expect(validarConfigComercial(invalida)).toBe(false)
      expect(() => aplicarComando(criarEstadoInicial(), { tipo: 'configurar_comercial', config: invalida })).toThrow('Revise planos')
    }
    expect(() => aplicarComando(criarEstadoInicial(), { tipo: 'configurar_comercial', config }, 'outro')).toThrow('Estúdio inválido')
  })

  it('fotografia de preço/nome/quota do plano permanece após configuração mudar', () => {
    let estado = aplicarComando(criarEstadoInicial(), { tipo: 'escolher_plano', planoId: 'essencial' })
    const snapshot = structuredClone(estado.assinatura)
    expect(snapshot).toMatchObject({ plano: 'Essencial', planoId: 'essencial', precoMensalCentavos: 4900, armazenamentoBytes: 10_000_000_000, simulacao: true })
    const config = configPadrao()
    config.planos[0] = { ...config.planos[0], nome: 'Novo nome', precoMensalCentavos: 1, armazenamentoBytes: 1 }
    estado = aplicarComando(estado, { tipo: 'configurar_comercial', config })
    expect(estado.assinatura).toEqual(snapshot)
    expect(validarEstadoLocal(estado)).toBe(true)
    expect(() => aplicarComando(estado, { tipo: 'escolher_plano', planoId: 'inexistente' })).toThrow('indisponível')
    expect(aplicarComando(estado, { tipo: 'simular_assinatura', plano: 'Legado' }).assinatura).toEqual({ plano: 'Legado', status: 'simulada', simulacao: true })
  })

  it('calcula comissão half-up sem overflow e não transforma sob consulta em zero', () => {
    const config = configPadrao()
    expect(calcularFinanceiroLocal('inteligente', 'produto', 19900, config)).toEqual({ comissaoBps: 1000, comissaoCentavos: 1990, liquidoCentavos: 17910 })
    expect(calcularFinanceiroLocal('inteligente', 'produto', 5, config)).toEqual({ comissaoBps: 1000, comissaoCentavos: 1, liquidoCentavos: 4 })
    expect(calcularFinanceiroLocal('inteligente', 'produto', Number.MAX_SAFE_INTEGER, config)).toEqual({ comissaoBps: 1000, comissaoCentavos: 900719925474099, liquidoCentavos: 8106479329266892 })
    expect(calcularFinanceiroLocal('inteligente', 'produto', null, config)).toEqual({ comissaoBps: 1000, comissaoCentavos: null, liquidoCentavos: null })
    expect(calcularFinanceiroLocal('inteligente', 'servico', 19900, config)).toEqual({ comissaoBps: 0, comissaoCentavos: 0, liquidoCentavos: 19900 })
    expect(calcularFinanceiroLocal('selecao', 'produto', 9900, config)).toEqual({ comissaoBps: 0, comissaoCentavos: 0, liquidoCentavos: 9900 })
    expect(() => calcularFinanceiroLocal('inteligente', 'produto', -1, config)).toThrow('Dados inválidos')
  })

  it('pedido deriva preço do catálogo, isola dono e conserva financeiro após edições', () => {
    let estado = aplicarComando(criarEstadoInicial(), { tipo: 'criar_pedido', galeriaId: 'galeria-evento', produtoId: 'produto-digital', fotoIds: ['evento-1'] })
    const snapshot = structuredClone(estado.pedidos[0])
    expect(snapshot).toMatchObject({ totalCentavos: 9900, financeiro: { comissaoBps: 1000, comissaoCentavos: 990, liquidoCentavos: 8910 } })
    estado = aplicarComando(estado, { tipo: 'editar_produto', produtoId: 'produto-digital', nome: 'Novo produto', precoCentavos: 5 })
    estado = aplicarComando(estado, { tipo: 'configurar_comercial', config: { ...configPadrao(), comissaoEventoBps: 5000 } })
    expect(estado.pedidos[0]).toEqual(snapshot)
    expect(validarEstadoLocal(estado)).toBe(true)
    estado = aplicarComando(estado, { tipo: 'criar_pedido', galeriaId: 'galeria-evento', produtoId: 'produto-digital', fotoIds: ['evento-1'] })
    expect(estado.pedidos[0]).toMatchObject({ produtoNome: 'Novo produto', totalCentavos: 5, financeiro: { comissaoBps: 5000, comissaoCentavos: 3, liquidoCentavos: 2 } })
    expect(() => aplicarComando(estado, { tipo: 'editar_produto', produtoId: 'produto-digital', nome: 'Outro', precoCentavos: 1 }, 'outro')).toThrow('Estúdio inválido')
    expect(() => aplicarComando(estado, { tipo: 'editar_produto', produtoId: 'nao-existe', nome: 'Outro', precoCentavos: 1 })).toThrow('indisponível')
  })

  it('preserva pedidos antigos sem financeiro e nega snapshots inconsistentes em disco', () => {
    const estado = aplicarComando(criarEstadoInicial(), { tipo: 'criar_pedido', galeriaId: 'galeria-evento', produtoId: 'produto-digital', fotoIds: [] })
    delete estado.comercial
    delete estado.pedidos[0].financeiro
    expect(validarEstadoLocal(estado)).toBe(true)
    expect(carregarEstado({ getItem: () => JSON.stringify(estado), setItem: () => {} })).toEqual(estado)
    estado.pedidos[0].financeiro = { comissaoBps: 1000, comissaoCentavos: 991, liquidoCentavos: 8909 }
    expect(validarEstadoLocal(estado)).toBe(false)
    const servico = aplicarComando(criarEstadoInicial(), { tipo: 'criar_pedido', galeriaId: 'galeria-ensaio', produtoId: 'servico-diagramacao', fotoIds: [] })
    servico.pedidos[0].financeiro = { comissaoBps: 1000, comissaoCentavos: 1990, liquidoCentavos: 17910 }
    expect(validarEstadoLocal(servico)).toBe(false)
    const assinatura = aplicarComando(criarEstadoInicial(), { tipo: 'escolher_plano', planoId: 'essencial' })
    delete assinatura.assinatura.armazenamentoBytes
    expect(validarEstadoLocal(assinatura)).toBe(false)
  })
})
