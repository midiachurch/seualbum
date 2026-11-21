import type { EstadoLocal } from './modelo'
import { lerConfigComercial } from './comercial'

export type StatusCicloAssinaturaLocal = 'ativa_simulada' | 'inadimplente_simulada' | 'cancelada'
export interface OfertaAdicionalLocal { precoMensalCentavos: number; armazenamentoBytes: number }
export interface AdicionalAssinaturaLocal extends OfertaAdicionalLocal { id: string; quantidade: number; contratadoEm: string }
export interface FaturaAssinaturaLocal {
  id: string; competencia: string; criadaEm: string; status: 'aberta_simulada' | 'vencida_simulada' | 'paga_simulada'
  planoCentavos: number; adicionaisCentavos: number; totalCentavos: number
  planoNome: string; adicionais: AdicionalAssinaturaLocal[]; pagaEm?: string
}
export interface CicloAssinaturaLocal {
  id: string; proprietarioId: string; plano: { id: string; nome: string; precoMensalCentavos: number; armazenamentoBytes: number }
  status: StatusCicloAssinaturaLocal; competenciaAtual: string; iniciadoEm: string; canceladoEm?: string
  ofertaAdicional: OfertaAdicionalLocal; adicionais: AdicionalAssinaturaLocal[]; faturas: FaturaAssinaturaLocal[]
  operacoes: { chave: string; acao: 'iniciar' | 'renovar' | 'contratar_adicional'; referencia: string }[]
}
export type ComandoAssinaturaLocal =
  | { acao: 'iniciar'; planoId: string; chave: string }
  | { acao: 'renovar'; competencia: string; chave: string }
  | { acao: 'simular_atraso' | 'simular_pagamento'; faturaId: string }
  | { acao: 'cancelar' }
  | { acao: 'configurar_adicional'; precoMensalCentavos: number; armazenamentoBytes: number }
  | { acao: 'contratar_adicional'; quantidade: number; chave: string }

export const ADICIONAL_PADRAO: Readonly<OfertaAdicionalLocal> = Object.freeze({ precoMensalCentavos: 1900, armazenamentoBytes: 100_000_000_000 })
const inteiro = (valor: unknown, minimo = 0): valor is number => typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= minimo
const registro = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null && !Array.isArray(valor)
const texto = (valor: unknown): valor is string => typeof valor === 'string' && valor.length > 0 && valor.length <= 200
const data = (valor: unknown): valor is string => typeof valor === 'string' && !Number.isNaN(Date.parse(valor))
const competenciaValida = (valor: unknown): valor is string => typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) && Number(valor.slice(0, 4)) >= 2000 && Number(valor.slice(0, 4)) < 9999
function soma(valores: number[]): number { const total = valores.reduce((n, valor) => n + valor, 0); if (valores.some(valor => !inteiro(valor)) || !inteiro(total)) throw new Error('O cálculo local ultrapassa valores seguros.'); return total }
function multiplicar(a: number, b: number): number { const resultado = a * b; if (!inteiro(a) || !inteiro(b) || !inteiro(resultado)) throw new Error('O cálculo local ultrapassa valores seguros.'); return resultado }
function ofertaValida(valor: unknown): valor is OfertaAdicionalLocal { return registro(valor) && inteiro(valor.precoMensalCentavos) && inteiro(valor.armazenamentoBytes, 1) }
function adicionalValido(valor: unknown): valor is AdicionalAssinaturaLocal { return ofertaValida(valor) && registro(valor) && texto(valor.id) && inteiro(valor.quantidade, 1) && valor.quantidade <= 100 && data(valor.contratadoEm) }

export function proximaCompetencia(competencia: string): string {
  if (!competenciaValida(competencia)) throw new Error('Competência mensal inválida.')
  const [ano, mes] = competencia.split('-').map(Number)
  const proxima = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`
  if (!competenciaValida(proxima)) throw new Error('O ciclo atingiu o limite de competências locais.')
  return proxima
}
function competenciaHoje(): string {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  return `${partes.find(item => item.type === 'year')!.value}-${partes.find(item => item.type === 'month')!.value}`
}

export function calcularConsumoAssinatura(estado: EstadoLocal): { bytes: number; fotos: number; laminas: number; capacidadeBytes: number; excessoBytes: number; contratoAtivo: boolean; trafegoBytes: null } {
  const fotos = estado.galerias.filter(galeria => galeria.proprietarioId === estado.proprietarioId).flatMap(galeria => galeria.fotos)
  const laminas = estado.producao?.projetos.filter(projeto => projeto.proprietarioId === estado.proprietarioId).flatMap(projeto => projeto.versoes.flatMap(versao => versao.laminas)) ?? []
  const arquivos = new Map<string, number>()
  for (const arquivo of [...fotos, ...laminas]) {
    if (!inteiro(arquivo.bytes) || arquivos.has(arquivo.id) && arquivos.get(arquivo.id) !== arquivo.bytes) throw new Error('Os metadados dos arquivos locais são inconsistentes.')
    arquivos.set(arquivo.id, arquivo.bytes)
  }
  const bytes = soma([...arquivos.values()])
  const ciclo = estado.cicloAssinatura
  const capacidadeBytes = ciclo ? soma([ciclo.plano.armazenamentoBytes, ...ciclo.adicionais.map(adicional => multiplicar(adicional.armazenamentoBytes, adicional.quantidade))]) : 0
  return { bytes, fotos: fotos.length, laminas: new Set(laminas.map(lamina => lamina.id)).size, capacidadeBytes, excessoBytes: Math.max(0, bytes - capacidadeBytes), contratoAtivo: !!ciclo && ciclo.status !== 'cancelada', trafegoBytes: null }
}

function criarFatura(ciclo: CicloAssinaturaLocal, competencia: string, agora: string): FaturaAssinaturaLocal {
  const adicionaisCentavos = soma(ciclo.adicionais.map(adicional => multiplicar(adicional.precoMensalCentavos, adicional.quantidade)))
  return { id: crypto.randomUUID(), competencia, criadaEm: agora, status: 'aberta_simulada', planoCentavos: ciclo.plano.precoMensalCentavos, adicionaisCentavos, totalCentavos: soma([ciclo.plano.precoMensalCentavos, adicionaisCentavos]), planoNome: ciclo.plano.nome, adicionais: structuredClone(ciclo.adicionais) }
}

export function aplicarAssinatura(estado: EstadoLocal, comando: ComandoAssinaturaLocal): EstadoLocal {
  if (!texto(estado.proprietarioId) || estado.cicloAssinatura && !validarCicloAssinatura(estado.cicloAssinatura, estado)) throw new Error('Contrato local inválido ou de outro estúdio.')
  const referencia = comando.acao === 'iniciar' ? comando.planoId : comando.acao === 'renovar' ? comando.competencia : comando.acao === 'contratar_adicional' ? String(comando.quantidade) : null
  if ('chave' in comando) {
    if (!texto(comando.chave)) throw new Error('Informe uma chave válida para esta operação.')
    const existente = estado.cicloAssinatura?.operacoes.find(item => item.chave === comando.chave)
    if (existente) { if (existente.acao !== comando.acao || existente.referencia !== referencia) throw new Error('Esta chave já foi usada para outra operação.'); return estado }
  }
  const novo = structuredClone(estado)
  const agora = new Date().toISOString()
  const registrar = (mensagem: string) => novo.atividades.unshift({ id: crypto.randomUUID(), galeriaId: null, texto: mensagem, criadaEm: agora })
  if (comando.acao === 'iniciar') {
    if (novo.cicloAssinatura) throw new Error('Este estúdio já possui um ciclo registrado. O histórico será preservado.')
    const plano = lerConfigComercial(novo).planos.find(item => item.id === comando.planoId)
    if (!plano) throw new Error('Plano indisponível nesta simulação.')
    const competencia = competenciaHoje()
    const ciclo: CicloAssinaturaLocal = { id: crypto.randomUUID(), proprietarioId: novo.proprietarioId, plano: structuredClone(plano), status: 'ativa_simulada', competenciaAtual: competencia, iniciadoEm: agora, ofertaAdicional: { ...ADICIONAL_PADRAO }, adicionais: [], faturas: [], operacoes: [] }
    ciclo.faturas.push(criarFatura(ciclo, competencia, agora))
    novo.cicloAssinatura = ciclo
    novo.assinatura = { plano: plano.nome, status: 'simulada', simulacao: true, planoId: plano.id, precoMensalCentavos: plano.precoMensalCentavos, armazenamentoBytes: plano.armazenamentoBytes }
    registrar(`Ciclo de assinatura ${plano.nome} iniciado para ${competencia}, com fatura simulada e sem cobrança real.`)
  } else {
    const ciclo = novo.cicloAssinatura
    if (!ciclo) throw new Error('Inicie um ciclo de assinatura antes desta operação.')
    switch (comando.acao) {
      case 'cancelar':
        if (ciclo.status === 'cancelada') return estado
        ciclo.status = 'cancelada'; ciclo.canceladoEm = agora
        registrar('Assinatura local cancelada; fotos, contratos e faturas foram preservados. Nenhuma exclusão foi executada.')
        break
      case 'simular_atraso': {
        if (ciclo.status === 'cancelada') throw new Error('O contrato cancelado não pode receber novas simulações de atraso.')
        const fatura = ciclo.faturas.find(item => item.id === comando.faturaId)
        if (!fatura) throw new Error('Fatura indisponível neste contrato.')
        if (fatura.status === 'paga_simulada') throw new Error('Uma fatura paga não pode ser marcada em atraso.')
        if (fatura.status === 'vencida_simulada') return estado
        fatura.status = 'vencida_simulada'; ciclo.status = 'inadimplente_simulada'
        registrar(`Atraso simulado na competência ${fatura.competencia}, sem alterar sua data real de emissão.`)
        break
      }
      case 'simular_pagamento': {
        const fatura = ciclo.faturas.find(item => item.id === comando.faturaId)
        if (!fatura) throw new Error('Fatura indisponível neste contrato.')
        if (fatura.status === 'paga_simulada') return estado
        fatura.status = 'paga_simulada'; fatura.pagaEm = agora
        if (ciclo.status !== 'cancelada') ciclo.status = ciclo.faturas.some(item => item.status === 'vencida_simulada') ? 'inadimplente_simulada' : 'ativa_simulada'
        registrar(`Pagamento da competência ${fatura.competencia} simulado; nenhum valor foi movimentado.`)
        break
      }
      case 'renovar':
        if (ciclo.status !== 'ativa_simulada') throw new Error('A renovação exige um contrato ativo na simulação.')
        if (ciclo.faturas.some(item => item.status !== 'paga_simulada')) throw new Error('Simule o pagamento das faturas pendentes antes de renovar.')
        if (comando.competencia !== proximaCompetencia(ciclo.competenciaAtual)) throw new Error('A renovação deve usar exatamente a próxima competência mensal.')
        ciclo.faturas.push(criarFatura(ciclo, comando.competencia, agora)); ciclo.competenciaAtual = comando.competencia
        registrar(`Renovação simulada da competência ${comando.competencia}; a emissão ocorreu na data real registrada.`)
        break
      case 'configurar_adicional':
        if (ciclo.status === 'cancelada') throw new Error('O contrato cancelado não aceita configuração de novos adicionais.')
        if (!ofertaValida(comando)) throw new Error('Informe preço em centavos e capacidade positiva válidos para o adicional.')
        ciclo.ofertaAdicional = { precoMensalCentavos: comando.precoMensalCentavos, armazenamentoBytes: comando.armazenamentoBytes }
        registrar('Oferta de armazenamento adicional atualizada apenas para novas contratações simuladas.')
        break
      case 'contratar_adicional':
        if (ciclo.status !== 'ativa_simulada') throw new Error('Um novo adicional exige contrato ativo na simulação.')
        if (!inteiro(comando.quantidade, 1) || comando.quantidade > 100) throw new Error('Contrate entre 1 e 100 unidades de adicional por operação.')
        multiplicar(ciclo.ofertaAdicional.precoMensalCentavos, comando.quantidade); multiplicar(ciclo.ofertaAdicional.armazenamentoBytes, comando.quantidade)
        ciclo.adicionais.push({ id: crypto.randomUUID(), ...structuredClone(ciclo.ofertaAdicional), quantidade: comando.quantidade, contratadoEm: agora })
        registrar(`${comando.quantidade} unidade(s) de armazenamento adicional contratada(s) na simulação. O valor entra na próxima competência, sem cobrança real.`)
        break
      default: throw new Error('Operação de assinatura inválida.')
    }
  }
  if ('chave' in comando) novo.cicloAssinatura!.operacoes.push({ chave: comando.chave, acao: comando.acao as 'iniciar' | 'renovar' | 'contratar_adicional', referencia: referencia! })
  calcularConsumoAssinatura(novo)
  if (!validarCicloAssinatura(novo.cicloAssinatura, novo)) throw new Error('A operação gerou dados inválidos e não foi confirmada.')
  return novo
}

export function validarCicloAssinatura(valor: unknown, estado: EstadoLocal): valor is CicloAssinaturaLocal {
  try {
    if (!registro(valor) || !texto(valor.id) || valor.proprietarioId !== estado.proprietarioId || !['ativa_simulada', 'inadimplente_simulada', 'cancelada'].includes(valor.status as string) || !data(valor.iniciadoEm) || !competenciaValida(valor.competenciaAtual)) return false
    if (valor.status === 'cancelada' ? !data(valor.canceladoEm) : valor.canceladoEm !== undefined) return false
    if (!registro(valor.plano) || !texto(valor.plano.id) || !texto(valor.plano.nome) || !inteiro(valor.plano.precoMensalCentavos) || !inteiro(valor.plano.armazenamentoBytes, 1) || !ofertaValida(valor.ofertaAdicional)) return false
    if (!Array.isArray(valor.adicionais) || !valor.adicionais.every(adicionalValido) || new Set(valor.adicionais.map(item => item.id)).size !== valor.adicionais.length) return false
    if (!Array.isArray(valor.faturas) || valor.faturas.length === 0 || !valor.faturas.every(fatura => {
      if (!registro(fatura) || !texto(fatura.id) || !competenciaValida(fatura.competencia) || !data(fatura.criadaEm) || !['aberta_simulada', 'vencida_simulada', 'paga_simulada'].includes(fatura.status as string) || !texto(fatura.planoNome) || !inteiro(fatura.planoCentavos) || !inteiro(fatura.adicionaisCentavos) || !inteiro(fatura.totalCentavos) || !Array.isArray(fatura.adicionais) || !fatura.adicionais.every(adicionalValido)) return false
      if (fatura.status === 'paga_simulada' ? !data(fatura.pagaEm) : fatura.pagaEm !== undefined) return false
      return fatura.planoNome === (valor.plano as CicloAssinaturaLocal['plano']).nome && fatura.planoCentavos === (valor.plano as CicloAssinaturaLocal['plano']).precoMensalCentavos && fatura.adicionaisCentavos === soma(fatura.adicionais.map(item => multiplicar(item.precoMensalCentavos, item.quantidade))) && fatura.totalCentavos === soma([fatura.planoCentavos, fatura.adicionaisCentavos]) && new Set(fatura.adicionais.map(item => item.id)).size === fatura.adicionais.length && fatura.adicionais.every(item => (valor.adicionais as AdicionalAssinaturaLocal[]).some(adicional => JSON.stringify(adicional) === JSON.stringify(item)))
    })) return false
    const faturas = valor.faturas as FaturaAssinaturaLocal[]
    if (new Set(faturas.map(item => item.id)).size !== faturas.length || new Set(faturas.map(item => item.competencia)).size !== faturas.length || faturas.at(-1)!.competencia !== valor.competenciaAtual || faturas.some((item, i) => i > 0 && item.competencia !== proximaCompetencia(faturas[i - 1].competencia))) return false
    if (valor.status !== 'cancelada' && (valor.status === 'inadimplente_simulada') !== faturas.some(item => item.status === 'vencida_simulada')) return false
    if (!Array.isArray(valor.operacoes) || !valor.operacoes.every(item => registro(item) && texto(item.chave) && ['iniciar', 'renovar', 'contratar_adicional'].includes(item.acao as string) && texto(item.referencia)) || new Set(valor.operacoes.map(item => item.chave)).size !== valor.operacoes.length) return false
    soma([(valor.plano as CicloAssinaturaLocal['plano']).armazenamentoBytes, ...valor.adicionais.map(item => multiplicar(item.armazenamentoBytes, item.quantidade))])
    soma([(valor.plano as CicloAssinaturaLocal['plano']).precoMensalCentavos, ...valor.adicionais.map(item => multiplicar(item.precoMensalCentavos, item.quantidade))])
    return true
  } catch { return false }
}
