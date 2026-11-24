import { describe, expect, it } from 'vitest'
import { criarEstadoInicial } from './modelo'
import { validarEstadoLocal } from './repositorio'
import { aplicarAssinatura, calcularConsumoAssinatura, proximaCompetencia, validarCicloAssinatura, type ComandoAssinaturaLocal } from './assinatura'

const iniciar = () => aplicarAssinatura(criarEstadoInicial(), { acao: 'iniciar', planoId: 'profissional', chave: 'inicio' })
const pagar = (estado: ReturnType<typeof iniciar>) => aplicarAssinatura(estado, { acao: 'simular_pagamento', faturaId: estado.cicloAssinatura!.faturas.at(-1)!.id })

describe('assinatura local sem cobrança externa', () => {
  it('contrata novamente após cancelamento preservando o contrato e faturas anteriores', () => {
    let estado = iniciar()
    estado = aplicarAssinatura(estado, { acao: 'cancelar' })
    const cancelado = structuredClone(estado.cicloAssinatura)
    estado = aplicarAssinatura(estado, { acao: 'iniciar', planoId: 'essencial', chave: 'novo-ciclo' })
    expect(estado.ciclosAssinaturaAnteriores).toEqual([cancelado])
    expect(estado.cicloAssinatura!.plano.id).toBe('essencial')
    expect(estado.cicloAssinatura!.id).not.toBe(cancelado!.id)
    expect(estado.galerias).toEqual(criarEstadoInicial().galerias.map((g, i) => ({ ...g, criadaEm: estado.galerias[i].criadaEm })))
    expect(validarEstadoLocal(estado)).toBe(true)
    estado.ciclosAssinaturaAnteriores![0].status = 'ativa_simulada'
    expect(validarEstadoLocal(estado)).toBe(false)
  })
  it('contrata plano pelo catálogo e registra fatura e atividade com datas reais', () => {
    const estado = iniciar(); const ciclo = estado.cicloAssinatura!
    expect(ciclo.status).toBe('ativa_simulada')
    expect(ciclo.plano).toMatchObject({ precoMensalCentavos: 9900, armazenamentoBytes: 100_000_000_000 })
    expect(ciclo.faturas[0]).toMatchObject({ totalCentavos: 9900, status: 'aberta_simulada', adicionaisCentavos: 0 })
    expect(estado.assinatura).toMatchObject({ planoId: 'profissional', precoMensalCentavos: 9900, simulacao: true })
    expect(Math.abs(Date.now() - Date.parse(ciclo.faturas[0].criadaEm))).toBeLessThan(5000)
    expect(estado.atividades[0].texto).toContain('sem cobrança real')
    expect(validarCicloAssinatura(ciclo, estado)).toBe(true)
  })

  it('início é idempotente e rejeita plano diferente ou chave reutilizada', () => {
    const estado = iniciar()
    expect(aplicarAssinatura(estado, { acao: 'iniciar', planoId: 'profissional', chave: 'inicio' })).toBe(estado)
    expect(() => aplicarAssinatura(estado, { acao: 'iniciar', planoId: 'essencial', chave: 'inicio' })).toThrow('outra operação')
    expect(() => aplicarAssinatura(estado, { acao: 'iniciar', planoId: 'profissional', chave: 'outro' })).toThrow('histórico')
    expect(() => aplicarAssinatura(criarEstadoInicial(), { acao: 'iniciar', planoId: 'inexistente', chave: 'x' })).toThrow('indisponível')
  })

  it('renova somente a próxima competência e repete sem duplicar a fatura', () => {
    const estado = pagar(iniciar()); const competencia = proximaCompetencia(estado.cicloAssinatura!.competenciaAtual)
    const comando: ComandoAssinaturaLocal = { acao: 'renovar', competencia, chave: 'renovacao' }
    const renovado = aplicarAssinatura(estado, comando)
    expect(renovado.cicloAssinatura!.faturas).toHaveLength(2)
    expect(renovado.cicloAssinatura!.faturas[1].competencia).toBe(competencia)
    expect(aplicarAssinatura(renovado, comando)).toBe(renovado)
    expect(() => aplicarAssinatura(estado, { acao: 'renovar', competencia: proximaCompetencia(competencia), chave: 'salto' })).toThrow('próxima competência')
    expect(proximaCompetencia('2026-12')).toBe('2027-01')
  })

  it('não renova com faturas pendentes nem altera datas para simular atraso', () => {
    const estado = iniciar(); const fatura = estado.cicloAssinatura!.faturas[0]
    expect(() => aplicarAssinatura(estado, { acao: 'renovar', competencia: proximaCompetencia(fatura.competencia), chave: 'x' })).toThrow('pendentes')
    const atrasado = aplicarAssinatura(estado, { acao: 'simular_atraso', faturaId: fatura.id })
    expect(atrasado.cicloAssinatura!.status).toBe('inadimplente_simulada')
    expect(atrasado.cicloAssinatura!.faturas[0].criadaEm).toBe(fatura.criadaEm)
    expect(pagar(atrasado).cicloAssinatura!.status).toBe('ativa_simulada')
    expect(() => aplicarAssinatura(pagar(atrasado), { acao: 'simular_atraso', faturaId: fatura.id })).toThrow('paga')
  })

  it('mantém preços snapshot do plano mesmo com mudanças posteriores do catálogo', () => {
    let estado = pagar(iniciar())
    estado.comercial!.planos.find(item => item.id === 'profissional')!.precoMensalCentavos = 17900
    estado = aplicarAssinatura(estado, { acao: 'renovar', competencia: proximaCompetencia(estado.cicloAssinatura!.competenciaAtual), chave: 'renova' })
    expect(estado.cicloAssinatura!.faturas.map(item => item.totalCentavos)).toEqual([9900, 9900])
  })

  it('adicional lê preço da oferta, preserva snapshot e entra na próxima fatura', () => {
    const estado = iniciar()
    let adicional = aplicarAssinatura(estado, { acao: 'contratar_adicional', quantidade: 2, chave: 'adicional-1' })
    expect(adicional.cicloAssinatura!.faturas[0].totalCentavos).toBe(9900)
    expect(calcularConsumoAssinatura(adicional).capacidadeBytes).toBe(300_000_000_000)
    adicional = aplicarAssinatura(adicional, { acao: 'configurar_adicional', precoMensalCentavos: 2900, armazenamentoBytes: 50_000_000_000 })
    expect(aplicarAssinatura(adicional, { acao: 'contratar_adicional', quantidade: 2, chave: 'adicional-1' })).toBe(adicional)
    adicional = aplicarAssinatura(adicional, { acao: 'contratar_adicional', quantidade: 1, chave: 'adicional-2' })
    const pronto = pagar(adicional)
    const renovado = aplicarAssinatura(pronto, { acao: 'renovar', competencia: proximaCompetencia(pronto.cicloAssinatura!.competenciaAtual), chave: 'r' })
    expect(renovado.cicloAssinatura!.faturas[1]).toMatchObject({ planoCentavos: 9900, adicionaisCentavos: 6700, totalCentavos: 16600 })
    expect(renovado.cicloAssinatura!.faturas[1].adicionais[0].precoMensalCentavos).toBe(1900)
    expect(calcularConsumoAssinatura(renovado).capacidadeBytes).toBe(350_000_000_000)
  })

  it('cancelamento preserva todas as fotos/faturas e pagamento posterior não reativa', () => {
    const estado = iniciar(); const cancelado = aplicarAssinatura(estado, { acao: 'cancelar' })
    expect(cancelado.galerias).toEqual(estado.galerias)
    expect(cancelado.cicloAssinatura!.faturas).toEqual(estado.cicloAssinatura!.faturas)
    expect(pagar(cancelado).cicloAssinatura!.status).toBe('cancelada')
    expect(aplicarAssinatura(cancelado, { acao: 'cancelar' })).toBe(cancelado)
    expect(() => aplicarAssinatura(cancelado, { acao: 'contratar_adicional', quantidade: 1, chave: 'x' })).toThrow('ativo')
    expect(() => aplicarAssinatura(cancelado, { acao: 'renovar', competencia: proximaCompetencia(cancelado.cicloAssinatura!.competenciaAtual), chave: 'x' })).toThrow('ativo')
  })

  it('mede bytes reais, excesso e tráfego desconhecido, sem apagar dados', () => {
    const estado = iniciar()
    estado.galerias[0].fotos.push({ id: 'importada', nome: 'a.jpg', url: 'arquivo-local:importada', bytes: 110_000_000_000, tipo: 'image/jpeg', participantes: [] })
    expect(calcularConsumoAssinatura(estado)).toMatchObject({ bytes: 110_000_000_000, excessoBytes: 10_000_000_000, trafegoBytes: null, contratoAtivo: true })
    const cancelado = aplicarAssinatura(estado, { acao: 'cancelar' })
    expect(calcularConsumoAssinatura(cancelado)).toMatchObject({ bytes: 110_000_000_000, contratoAtivo: false })
    expect(cancelado.galerias[0].fotos).toHaveLength(5)
  })

  it('rejeita valores inseguros, quantidade inválida e dados de outro estúdio', () => {
    const estado = iniciar()
    expect(() => aplicarAssinatura(estado, { acao: 'configurar_adicional', precoMensalCentavos: -1, armazenamentoBytes: 1 })).toThrow('válidos')
    expect(() => aplicarAssinatura(estado, { acao: 'configurar_adicional', precoMensalCentavos: 19, armazenamentoBytes: 0 })).toThrow('válidos')
    expect(() => aplicarAssinatura(estado, { acao: 'contratar_adicional', quantidade: 0, chave: 'x' })).toThrow('1 e 100')
    const excesso = structuredClone(estado); excesso.galerias[0].fotos[0].bytes = Number.MAX_SAFE_INTEGER; excesso.galerias[0].fotos[1].bytes = 1
    expect(() => calcularConsumoAssinatura(excesso)).toThrow('seguros')
    const cruzado = structuredClone(estado); cruzado.cicloAssinatura!.proprietarioId = 'outro'
    expect(validarCicloAssinatura(cruzado.cicloAssinatura, cruzado)).toBe(false)
    expect(() => aplicarAssinatura(cruzado, { acao: 'cancelar' })).toThrow('outro estúdio')
  })

  it('inclui lâminas importadas sem cobrar duas vezes referências de versões', () => {
    const estado = iniciar(); const agora = new Date().toISOString()
    const lamina = { id: 'lamina-importada', nome: 'lamina.jpg', url: 'arquivo-local:lamina-importada', bytes: 12345, tipo: 'image/jpeg', largura: 100, altura: 100 }
    const versao = { id: 'versao-1', numero: 1, selecaoId: 'selecao-1', fotoIds: [], status: 'rascunho' as const, criadaEm: agora, publicadaEm: null, chavePublicacao: null, decididaEm: null, chaveDecisao: null, mensagemDecisao: null, laminas: [lamina], comentarios: [] }
    estado.producao = { projetos: [{ galeriaId: 'galeria-ensaio', proprietarioId: estado.proprietarioId, selecaoId: 'selecao-1', opcao: 'propria', revisao: 1, pedidoId: null, servico: null, versoes: [versao, { ...structuredClone(versao), id: 'versao-2', numero: 2 }] }] }
    expect(calcularConsumoAssinatura(estado)).toMatchObject({ bytes: 12345, laminas: 1 })
    estado.producao.projetos[0].versoes[1].laminas[0].bytes = 987
    expect(() => calcularConsumoAssinatura(estado)).toThrow('inconsistentes')
  })

  it('validação rejeita soma adulterada e estados financeiros impossíveis', () => {
    for (const alterar of [
      (estado: ReturnType<typeof iniciar>) => { estado.cicloAssinatura!.faturas[0].totalCentavos = 1 },
      (estado: ReturnType<typeof iniciar>) => { estado.cicloAssinatura!.status = 'inadimplente_simulada' },
      (estado: ReturnType<typeof iniciar>) => { estado.cicloAssinatura!.faturas[0].status = 'paga_simulada' },
      (estado: ReturnType<typeof iniciar>) => { estado.cicloAssinatura!.competenciaAtual = '2026-99' },
    ]) { const estado = iniciar(); alterar(estado); expect(validarCicloAssinatura(estado.cicloAssinatura, estado)).toBe(false) }
  })
})
