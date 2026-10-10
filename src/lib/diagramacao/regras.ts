/**
 * Regras puras do centro de controle da diagramação (migration 0038): rótulos,
 * links (editor, prova, aprovação), filtros e validação das ações. Os dados
 * vêm da view `diagramacao_itens` e da RPC `diagramacao_resumo`, que já
 * calculam etapa, atraso e contagens no banco.
 */

export type TipoItemDiagramacao = 'projeto' | 'avulso'

export type EtapaDiagramacao =
  | 'a_diagramar'
  | 'em_diagramacao'
  | 'revisao_interna'
  | 'aguardando_cliente'
  | 'alteracoes'
  | 'aprovado'

export type PrioridadeDiagramacao = 'baixa' | 'normal' | 'alta' | 'urgente'

export const ETAPAS_DIAGRAMACAO: EtapaDiagramacao[] = [
  'a_diagramar',
  'em_diagramacao',
  'revisao_interna',
  'aguardando_cliente',
  'alteracoes',
  'aprovado',
]

export const ETAPA_LABEL: Record<EtapaDiagramacao, string> = {
  a_diagramar: 'A diagramar',
  em_diagramacao: 'Em diagramação',
  revisao_interna: 'Revisão interna',
  aguardando_cliente: 'Com o cliente',
  alteracoes: 'Ajustes pedidos',
  aprovado: 'Aprovado',
}

export const ETAPA_COR: Record<EtapaDiagramacao, string> = {
  a_diagramar: 'bg-sky-100 text-sky-800',
  em_diagramacao: 'bg-indigo-100 text-indigo-800',
  revisao_interna: 'bg-violet-100 text-violet-800',
  aguardando_cliente: 'bg-amber-100 text-amber-800',
  alteracoes: 'bg-red-100 text-red-800',
  aprovado: 'bg-emerald-100 text-emerald-800',
}

export const PRIORIDADES: PrioridadeDiagramacao[] = ['urgente', 'alta', 'normal', 'baixa']

export const PRIORIDADE_LABEL: Record<PrioridadeDiagramacao, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  normal: 'Normal',
  baixa: 'Baixa',
}

export const PRIORIDADE_COR: Record<PrioridadeDiagramacao, string> = {
  urgente: 'bg-red-600 text-white',
  alta: 'bg-orange-100 text-orange-800',
  normal: 'bg-[#F5F5F5] text-[#595959]',
  baixa: 'bg-[#F5F5F5] text-[#AAAAAA]',
}

const PESO_PRIORIDADE: Record<PrioridadeDiagramacao, number> = { urgente: 3, alta: 2, normal: 1, baixa: 0 }

/** Linha da view `diagramacao_itens`, como o PostgREST devolve. */
export type DiagramacaoItemRow = {
  tipo: TipoItemDiagramacao
  id: string
  projeto_id: string | null
  layout_id: string | null
  numero: number | null
  nome: string
  status: string
  etapa: EtapaDiagramacao
  responsavel_id: string | null
  responsavel_nome: string | null
  fotografo_id: string | null
  estudio: string | null
  cliente_nome: string | null
  prazo: string | null
  prazo_cliente: string | null
  prioridade: PrioridadeDiagramacao
  em_espera: boolean
  em_espera_motivo: string | null
  em_espera_desde: string | null
  versao_atual: number | null
  versao_status: string | null
  apontamentos_abertos: number
  aprovacao_token: string | null
  aprovacao_status: string | null
  aprovado_em: string | null
  ultima_atividade: string | null
  created_at: string
  atrasado: boolean
  cliente_atrasado: boolean
}

/** Carga de um diagramador, como `diagramacao_resumo` devolve. */
export type CargaDesignerRow = {
  id: string
  nome_completo: string
  papel: string
  atribuidos: number
  em_andamento: number
  a_diagramar: number
  com_cliente: number
  atrasados: number
  em_espera: number
  horas_medias: number | null
  entregas_90d: number
}

export type KpisDiagramacao = {
  em_diagramacao: number
  a_diagramar: number
  aguardando_cliente: number
  alteracoes: number
  aprovados_30d: number
  atrasados: number
  cliente_atrasado: number
  sem_responsavel: number
  em_espera: number
}

export type ResumoDiagramacao = {
  kpis: KpisDiagramacao
  designers: CargaDesignerRow[]
  urgentes: DiagramacaoItemRow[]
}

export type ItemRef = { tipo: TipoItemDiagramacao; id: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function ehUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

/** Itens válidos e sem repetição; null se algum vier inválido (pedido adulterado). */
export function validarItens(itens: unknown, maximo = 200): ItemRef[] | null {
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > maximo) return null
  const vistos = new Set<string>()
  const ok: ItemRef[] = []
  for (const i of itens) {
    const tipo = (i as ItemRef | null)?.tipo
    const id = (i as ItemRef | null)?.id
    if ((tipo !== 'projeto' && tipo !== 'avulso') || !ehUuid(id)) return null
    const chave = `${tipo}:${id}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    ok.push({ tipo, id })
  }
  return ok
}

export function ehPrioridade(v: unknown): v is PrioridadeDiagramacao {
  return typeof v === 'string' && (PRIORIDADES as string[]).includes(v)
}

/**
 * Prazo vindo de um `<input type="date">` ("2026-10-20"): vale até o fim do
 * dia no horário de Brasília. Devolve ISO, ou null se a data for inválida.
 */
export function prazoDoDia(data: unknown): string | null {
  if (typeof data !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.trim())
  if (!m) return null
  const [, ano, mes, dia] = m
  const d = new Date(`${ano}-${mes}-${dia}T23:59:00-03:00`)
  if (Number.isNaN(d.getTime())) return null
  // "2026-02-31" vira março no Date: recusa em vez de mudar a data em silêncio.
  const conferida = new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
  if (conferida !== `${ano}-${mes}-${dia}`) return null
  const anoN = Number(ano)
  if (anoN < 2020 || anoN > 2100) return null
  return d.toISOString()
}

/** ISO → "AAAA-MM-DD" no horário de Brasília (valor inicial do input de data). */
export function diaDoPrazo(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  return new Date(t - 3 * 3_600_000).toISOString().slice(0, 10)
}

export function linkEditor(item: Pick<DiagramacaoItemRow, 'tipo' | 'id' | 'layout_id'>): string {
  return item.tipo === 'projeto' ? `/admin/projetos/${item.id}/editor` : `/admin/albuns/${item.layout_id ?? item.id}`
}

/**
 * Onde ver a prova. Projeto: a prova da esteira, se já houver versão. Avulso:
 * o link de aprovação sem login, se já foi publicado. Null = ainda não há prova.
 */
export function linkProva(item: Pick<DiagramacaoItemRow, 'tipo' | 'id' | 'versao_atual' | 'aprovacao_token'>): string | null {
  if (item.tipo === 'projeto') return item.versao_atual ? `/admin/projetos/${item.id}/prova` : null
  return item.aprovacao_token ? `/album/${item.aprovacao_token}` : null
}

/** Avulso sem link: abre o editor já no painel "Compartilhar" (publicar o link de aprovação). */
export function linkPublicarAprovacao(item: Pick<DiagramacaoItemRow, 'tipo' | 'id' | 'layout_id'>): string | null {
  if (item.tipo !== 'avulso') return null
  return `/admin/albuns/${item.layout_id ?? item.id}?abrir=compartilhar`
}

/** Para onde a pessoa da linha "trabalha": estúdio do projeto ou cliente do avulso. */
export function origemDoItem(item: Pick<DiagramacaoItemRow, 'tipo' | 'estudio' | 'cliente_nome'>): string {
  if (item.tipo === 'projeto') return item.estudio ?? '—'
  return item.cliente_nome ? `Avulso · ${item.cliente_nome}` : 'Avulso'
}

export type FiltrosDiagramacao = {
  busca?: string
  etapa?: EtapaDiagramacao | ''
  /** id do responsável, 'sem' (sem responsável) ou '' (todos). */
  responsavel?: string
  estudio?: string
  prioridade?: PrioridadeDiagramacao | ''
  tipo?: TipoItemDiagramacao | ''
  soAtrasados?: boolean
  /** Por padrão os em espera aparecem; `false` esconde. */
  mostrarEmEspera?: boolean
}

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function filtrarItens<T extends DiagramacaoItemRow>(itens: T[], f: FiltrosDiagramacao): T[] {
  const busca = semAcento(f.busca?.trim() ?? '')
  return itens.filter((i) => {
    if (f.etapa && i.etapa !== f.etapa) return false
    if (f.tipo && i.tipo !== f.tipo) return false
    if (f.prioridade && i.prioridade !== f.prioridade) return false
    if (f.responsavel === 'sem' ? i.responsavel_id !== null : f.responsavel && i.responsavel_id !== f.responsavel) return false
    if (f.estudio && (i.estudio ?? '') !== f.estudio) return false
    if (f.soAtrasados && !i.atrasado && !i.cliente_atrasado) return false
    if (f.mostrarEmEspera === false && i.em_espera) return false
    if (busca) {
      const alvo = semAcento([i.nome, i.numero ? `#${i.numero}` : '', i.estudio ?? '', i.cliente_nome ?? '', i.responsavel_nome ?? ''].join(' '))
      if (!alvo.includes(busca)) return false
    }
    return true
  })
}

/** Ordem padrão da tabela: atrasados, prioridade, prazo mais próximo. Em espera e aprovados no fim. */
export function ordenarPorUrgencia<T extends DiagramacaoItemRow>(itens: T[]): T[] {
  const peso = (i: DiagramacaoItemRow) => (i.etapa === 'aprovado' ? 2 : i.em_espera ? 1 : 0)
  const prazo = (i: DiagramacaoItemRow) => (i.prazo ? new Date(i.prazo).getTime() : Number.POSITIVE_INFINITY)
  return [...itens].sort(
    (a, b) =>
      peso(a) - peso(b) ||
      Number(b.atrasado) - Number(a.atrasado) ||
      Number(b.cliente_atrasado) - Number(a.cliente_atrasado) ||
      PESO_PRIORIDADE[b.prioridade] - PESO_PRIORIDADE[a.prioridade] ||
      prazo(a) - prazo(b) ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

/** "18 h", "2,5 dias" — tempo médio de entrega. */
export function formatarHoras(horas: number | null | undefined): string {
  if (horas === null || horas === undefined || !Number.isFinite(horas)) return '—'
  if (horas < 48) return `${Math.round(horas)} h`
  const dias = horas / 24
  return `${dias.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
}

/** "vence em 2 dias", "venceu há 3 dias", "vence hoje". */
export function descreverPrazo(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return 'Sem prazo'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'Sem prazo'
  const dias = Math.round((t - agora) / 86_400_000)
  if (t < agora) return dias === 0 ? 'Venceu hoje' : `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? 's' : ''}`
  if (dias === 0) return 'Vence hoje'
  return `Vence em ${dias} dia${dias > 1 ? 's' : ''}`
}

/** Erro do banco que indica a migration 0038 ainda não aplicada. */
export function semMigracaoDiagramacao(mensagem: string | null | undefined): boolean {
  const m = mensagem ?? ''
  return /does not exist|could not find|schema cache/i.test(m) && /diagramacao_|prioridade|em_espera|responsavel_id|prazo|ativo/i.test(m)
}

export const ERRO_SEM_MIGRACAO_DIAGRAMACAO =
  'O controle de diagramação ainda não está no banco: aplique a migration 0038 (controle_diagramacao).'
