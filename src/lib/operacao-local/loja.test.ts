import { describe, expect, it } from 'vitest'
import { aplicarComando, criarEstadoInicial, type EstadoLocal } from './modelo'
import { fotosDisponiveisCompra, resumirCarrinho, type ComandoLojaLocal } from './loja'
import { validarEstadoLocal } from './repositorio'

const galeriaId = 'galeria-evento'
const itens = [{ produtoId: 'produto-digital', fotoIds: ['evento-1'] }]
const enviar = (s: EstadoLocal, comando: ComandoLojaLocal) => aplicarComando(s, { tipo: 'loja', comando })
const carrinho = () => enviar(criarEstadoInicial(), { tipo: 'definir_item', galeriaId, ...itens[0] })
const checkout = (resultado: 'pago_simulado' | 'recusado_simulado' = 'pago_simulado'): ComandoLojaLocal => ({ tipo: 'checkout', galeriaId, itens, chave: resultado, resultado, totalEsperadoCentavos: 9900, cotacaoEsperada: [{ produtoId: 'produto-digital', totalCentavos: 9900, comissaoBps: 1000 }] })

describe('compra e entrega local', () => {
  it('calcula no catálogo, preserva snapshot e entrega somente os IDs comprados', () => {
    let s = enviar(carrinho(), checkout())
    const compra = s.loja!.compras[0]
    expect(compra).toMatchObject({ totalCentavos: 9900, comissaoCentavos: 990, liquidoCentavos: 8910 })
    expect(fotosDisponiveisCompra(s, compra.id).map(f => f.id)).toEqual(['evento-1'])
    s = aplicarComando(s, { tipo: 'editar_produto', produtoId: 'produto-digital', nome: 'Nome novo', precoCentavos: 50000 })
    expect(enviar(s, checkout())).toBe(s)
    expect(s.loja!.compras[0].itens[0].produtoNome).toBe('Coleção digital')
    expect(validarEstadoLocal(s)).toBe(true)
  })
  it('recusa não libera arquivos nem esvazia carrinho; tentativa aprovada é outra compra', () => {
    let s = enviar(carrinho(), checkout('recusado_simulado'))
    expect(() => fotosDisponiveisCompra(s, s.loja!.compras[0].id)).toThrow()
    expect(s.loja!.carrinhos[0].itens).toHaveLength(1)
    s = enviar(s, checkout())
    expect(s.loja!.compras).toHaveLength(2)
    expect(s.loja!.carrinhos[0].itens).toEqual([])
    expect(validarEstadoLocal(s)).toBe(true)
  })
  it('alterar preço ou comissão exige nova confirmação; sob consulta não vira zero', () => {
    let s = carrinho()
    s = aplicarComando(s, { tipo: 'editar_produto', produtoId: 'produto-digital', nome: 'Coleção', precoCentavos: 10000 })
    expect(() => enviar(s, checkout())).toThrow('mudaram')
    s = aplicarComando(s, { tipo: 'editar_produto', produtoId: 'produto-digital', nome: 'Coleção', precoCentavos: null })
    expect(resumirCarrinho(s, galeriaId).totalCentavos).toBeNull()
    expect(() => enviar(s, checkout())).toThrow('sob consulta')
  })
  it('nega referência cruzada e revogação inclusive no retry já pago', () => {
    let s = carrinho()
    expect(() => enviar(s, { tipo: 'definir_item', galeriaId, produtoId: 'produto-digital', fotoIds: ['foto-1'] })).toThrow('pertencentes')
    s = enviar(s, checkout())
    const compraId = s.loja!.compras[0].id
    s = aplicarComando(s, { tipo: 'alterar_acesso', galeriaId, ativo: false })
    expect(() => enviar(s, checkout())).toThrow('revogado')
    expect(() => fotosDisponiveisCompra(s, compraId)).toThrow('revogado')
    expect(validarEstadoLocal(s)).toBe(true)
  })
})
