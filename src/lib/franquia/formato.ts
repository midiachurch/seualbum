import type { ConsumoFranquiaGaleriaRow } from '@/types/database'

/** Bytes decimais (1 GB = 10^9), a mesma base da capacidade dos planos (0050). */
export function formatarBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB']
  let valor = bytes
  let i = 0
  while (valor >= 1000 && i < unidades.length - 1) { valor /= 1000; i += 1 }
  const casas = i === 0 || valor >= 100 ? 0 : 1
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: casas })} ${unidades[i]}`
}

export function formatarPrecoMensal(centavos: number): string {
  return `${(centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês`
}

const ROTULOS: Record<ConsumoFranquiaGaleriaRow['situacao'], string> = {
  sem_plano: 'Nenhum plano escolhido',
  dentro: 'Dentro da franquia',
  alerta: 'Perto do limite da franquia',
  excedida: 'Franquia excedida',
}

export function rotuloSituacao(situacao: ConsumoFranquiaGaleriaRow['situacao']): string {
  return ROTULOS[situacao] ?? ROTULOS.sem_plano
}
