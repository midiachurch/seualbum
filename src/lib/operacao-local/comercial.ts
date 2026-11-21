import type { EstadoLocal, ProdutoLocal, TipoGaleriaLocal } from './modelo'

export interface PlanoComercialLocal { id: string; nome: string; precoMensalCentavos: number; armazenamentoBytes: number }
export interface ConfigComercialLocal { planos: PlanoComercialLocal[]; comissaoEventoBps: number; comissaoSelecaoBps: number }
export interface FinanceiroPedidoLocal { comissaoBps: number; comissaoCentavos: number | null; liquidoCentavos: number | null }

/** Hipóteses próprias para simulação; não são equivalências de preços brasileiros de concorrentes. GB decimal. */
export function configPadrao(): ConfigComercialLocal {
  return {
    planos: [
      { id: 'essencial', nome: 'Essencial', precoMensalCentavos: 4900, armazenamentoBytes: 10_000_000_000 },
      { id: 'profissional', nome: 'Profissional', precoMensalCentavos: 9900, armazenamentoBytes: 100_000_000_000 },
      { id: 'estudio', nome: 'Estúdio', precoMensalCentavos: 19900, armazenamentoBytes: 500_000_000_000 },
    ],
    comissaoEventoBps: 1000, comissaoSelecaoBps: 0,
  }
}

const registro = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null && !Array.isArray(valor)
const inteiro = (valor: unknown, min = 0): valor is number => typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= min
const bps = (valor: unknown): valor is number => inteiro(valor) && valor <= 10000

export function validarConfigComercial(valor: unknown): valor is ConfigComercialLocal {
  if (!registro(valor) || !bps(valor.comissaoEventoBps) || !bps(valor.comissaoSelecaoBps) || !Array.isArray(valor.planos) || valor.planos.length === 0 || valor.planos.length > 20) return false
  return valor.planos.every(plano => registro(plano) && typeof plano.id === 'string' && /^[a-z0-9-]{1,50}$/.test(plano.id) && typeof plano.nome === 'string' && plano.nome.trim().length > 0 && plano.nome.length <= 160 && inteiro(plano.precoMensalCentavos) && inteiro(plano.armazenamentoBytes, 1)) && new Set(valor.planos.map(plano => plano.id)).size === valor.planos.length
}

/** Fallback somente de leitura: não migra nem regrava configurações de estados antigos. */
export function lerConfigComercial(estado: Pick<EstadoLocal, 'comercial'>): ConfigComercialLocal {
  if (estado.comercial === undefined) return configPadrao()
  if (!validarConfigComercial(estado.comercial)) throw new Error('A configuração comercial local é inválida.')
  return structuredClone(estado.comercial)
}

/** Arredondamento half-up em centavos com inteiro largo, inclusive perto de MAX_SAFE_INTEGER. */
function calcularComissao(totalCentavos: number, comissaoBps: number): number {
  return Number((BigInt(totalCentavos) * BigInt(comissaoBps) + 5000n) / 10000n)
}

export function calcularFinanceiroLocal(galeriaTipo: TipoGaleriaLocal, produtoTipo: ProdutoLocal['tipo'], totalCentavos: number | null, config: ConfigComercialLocal): FinanceiroPedidoLocal {
  if (!validarConfigComercial(config) || totalCentavos !== null && !inteiro(totalCentavos) || !['selecao', 'inteligente'].includes(galeriaTipo) || !['produto', 'servico'].includes(produtoTipo)) throw new Error('Dados inválidos para a simulação financeira.')
  const comissaoBps = produtoTipo === 'servico' ? 0 : galeriaTipo === 'inteligente' ? config.comissaoEventoBps : config.comissaoSelecaoBps
  const comissaoCentavos = totalCentavos === null ? null : calcularComissao(totalCentavos, comissaoBps)
  return { comissaoBps, comissaoCentavos, liquidoCentavos: totalCentavos === null ? null : totalCentavos - comissaoCentavos! }
}

/** Valida o snapshot, sem compará-lo aos preços e percentuais atuais que podem ter mudado. */
export function validarFinanceiroPedido(valor: unknown, totalCentavos: number | null): valor is FinanceiroPedidoLocal {
  if (!registro(valor) || !bps(valor.comissaoBps)) return false
  if (totalCentavos === null) return valor.comissaoCentavos === null && valor.liquidoCentavos === null
  if (!inteiro(totalCentavos) || !inteiro(valor.comissaoCentavos) || !inteiro(valor.liquidoCentavos)) return false
  const esperado = calcularComissao(totalCentavos, valor.comissaoBps)
  return valor.comissaoCentavos === esperado && valor.liquidoCentavos === totalCentavos - esperado
}
