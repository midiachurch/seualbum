import type {
  PapelOrganizacao, StudioCanal, StudioEtapa, StudioFinalidadeModelo, StudioMotivoPerda, StudioOrigem,
  StudioOutboxStatus, StudioPrioridade, StudioFiltroTarefa,
} from '@/types/database'

/** Etapas comerciais do funil, na ordem das colunas (0080). Não são status de produção. */
export const ETAPAS: readonly StudioEtapa[] = ['lead', 'contato', 'proposta', 'fechado', 'perdido']
export const ETAPA_ROTULO: Record<StudioEtapa, string> = {
  lead: 'Lead', contato: 'Em contato', proposta: 'Proposta enviada', fechado: 'Fechado', perdido: 'Perdido',
}
export const ORIGENS: readonly StudioOrigem[] = ['indicacao', 'instagram', 'site', 'google', 'facebook', 'whatsapp', 'evento', 'parceiro', 'outro']
export const ORIGEM_ROTULO: Record<StudioOrigem, string> = {
  indicacao: 'Indicação', instagram: 'Instagram', site: 'Site', google: 'Google', facebook: 'Facebook',
  whatsapp: 'WhatsApp', evento: 'Evento', parceiro: 'Parceiro', outro: 'Outro',
}
export const MOTIVOS_PERDA: readonly StudioMotivoPerda[] = ['preco', 'sem_resposta', 'concorrente', 'data_indisponivel', 'desistiu', 'outro']
export const MOTIVO_PERDA_ROTULO: Record<StudioMotivoPerda, string> = {
  preco: 'Preço', sem_resposta: 'Sem resposta', concorrente: 'Fechou com concorrente',
  data_indisponivel: 'Data indisponível', desistiu: 'Desistiu do evento', outro: 'Outro',
}
export const PRIORIDADES: readonly StudioPrioridade[] = ['baixa', 'media', 'alta']
export const PRIORIDADE_ROTULO: Record<StudioPrioridade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }
export const FILTROS_TAREFA: readonly StudioFiltroTarefa[] = ['abertas', 'minhas', 'atrasadas', 'hoje', 'responsavel', 'concluidas', 'todas']
export const FILTRO_TAREFA_ROTULO: Record<StudioFiltroTarefa, string> = {
  abertas: 'Abertas', minhas: 'Minhas', atrasadas: 'Atrasadas', hoje: 'Hoje',
  responsavel: 'Por responsável', concluidas: 'Concluídas', todas: 'Todas',
}
export const CANAIS: readonly StudioCanal[] = ['email', 'whatsapp']
export const CANAL_ROTULO: Record<StudioCanal, string> = { email: 'E-mail', whatsapp: 'WhatsApp' }
export const FINALIDADES: readonly StudioFinalidadeModelo[] = ['livre', 'followup_proposta', 'lembrete_tarefa']
export const FINALIDADE_ROTULO: Record<StudioFinalidadeModelo, string> = {
  livre: 'Uso livre', followup_proposta: 'Follow-up de proposta (automação)', lembrete_tarefa: 'Lembrete de tarefa (automação)',
}
export const OUTBOX_STATUS_ROTULO: Record<StudioOutboxStatus, string> = {
  pendente: 'Pendente', enviando: 'Em processamento', enviada: 'Simulada (nada foi enviado)', falhou: 'Falhou', cancelada: 'Cancelada',
}

/** Abas da página /dashboard/estudio. */
export const ABAS_ESTUDIO = ['funil', 'tarefas', 'modelos', 'saida'] as const
export type AbaEstudio = (typeof ABAS_ESTUDIO)[number]
export const ABA_ROTULO: Record<AbaEstudio, string> = { funil: 'Funil', tarefas: 'Tarefas', modelos: 'Modelos de mensagem', saida: 'Fila de saída' }

/**
 * Espelho de UX das permissões do banco (a decisão real é sempre da RPC):
 * escrita = dono/admin/editor; gestão = dono/admin; visualizador só lê.
 */
export const podeEscreverEstudio = (papel: PapelOrganizacao | null | undefined) => papel === 'dono' || papel === 'admin' || papel === 'editor'
export const podeGerirEstudio = (papel: PapelOrganizacao | null | undefined) => papel === 'dono' || papel === 'admin'

export const formatarData = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'sem prazo'
export const formatarDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

export const TIPO_LINHA_TEMPO_ROTULO: Record<string, string> = {
  mensagem: 'Mensagem', mensagem_sistema: 'Sistema', etapa: 'Funil', tarefa_concluida: 'Tarefa',
  orcamento: 'Orçamento', comunicacao: 'Comunicação',
}

/** Dinheiro em reais (números do banco já vêm em reais, não em centavos). */
export const formatarReais = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
