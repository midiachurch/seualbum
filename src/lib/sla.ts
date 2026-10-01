import type { Project, ProjectStatus } from '@/types/platform'

const STATUS_TRAVADO: ProjectStatus[] = ['aprovado_aguardando_pagamento', 'aprovado', 'finalizado', 'arquivado']

export type SlaInfo = {
  /** Qual prazo está valendo agora: o interno de produção, ou o do cliente aprovar. */
  kind: 'producao' | 'aprovacao'
  deadline: string
  /** Horas até o vencimento — negativo quando já passou. */
  horasRestantes: number
  tone: 'atrasado' | 'atencao' | 'normal'
  label: string
}

/**
 * Prazo que vale para este projeto agora — enquanto ele não chegou em
 * "aguardando aprovação do cliente", o que importa é o SLA interno de
 * produção; a partir dali, o relógio passa a ser o do cliente responder.
 * Projetos já concluídos não têm mais um SLA correndo.
 */
export function getSlaInfo(project: Pick<Project, 'status' | 'dataLimiteProducao' | 'dataLimiteAprovacao'>): SlaInfo | null {
  if (STATUS_TRAVADO.includes(project.status)) return null

  const usaAprovacao = project.status === 'aguardando_aprovacao_cliente' && project.dataLimiteAprovacao
  const deadline = usaAprovacao ? project.dataLimiteAprovacao! : project.dataLimiteProducao
  const kind = usaAprovacao ? 'aprovacao' : 'producao'

  const horasRestantes = (new Date(deadline).getTime() - Date.now()) / 3_600_000
  const tone: SlaInfo['tone'] = horasRestantes < 0 ? 'atrasado' : horasRestantes <= 48 ? 'atencao' : 'normal'

  const horasAbs = Math.abs(horasRestantes)
  const unidade = horasAbs >= 24 ? `${Math.round(horasAbs / 24)} dia(s)` : `${Math.max(1, Math.round(horasAbs))}h`
  const label = horasRestantes < 0 ? `Atrasado há ${unidade}` : `Faltam ${unidade}`

  return { kind, deadline, horasRestantes, tone, label }
}
