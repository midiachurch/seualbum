/**
 * Regras do painel de aprovação do cliente final (/cliente e
 * /cliente/projetos/[id]): status do álbum em linguagem de cliente, linha do
 * tempo das versões, checklist de lâminas (migration 0039), apontamentos com
 * o que o estúdio já resolveu e o resumo enviado em "Pedir ajustes".
 *
 * Tudo puro (sem banco, sem React) para ser testado e reaproveitado no
 * servidor e no navegador.
 */
import type {
  ApprovalEntry,
  DesignVersion,
  Lamina,
  Project,
  ProofComment,
  RevisaoLamina,
} from '@/types/platform'

/* -------------------------------------------------------------------------- */
/* Status do álbum para o cliente                                             */
/* -------------------------------------------------------------------------- */

export type StatusPainel =
  | 'aguardando_fotos'
  | 'em_preparacao'
  | 'aguardando_aprovacao'
  | 'em_ajustes'
  | 'aprovado'
  | 'em_producao'
  | 'entregue'

export const STATUS_PAINEL_LABEL: Record<StatusPainel, string> = {
  aguardando_fotos: 'Aguardando suas fotos',
  em_preparacao: 'Em criação pelo estúdio',
  aguardando_aprovacao: 'Aguardando sua aprovação',
  em_ajustes: 'Em ajustes pelo estúdio',
  aprovado: 'Aprovado',
  em_producao: 'Em produção na gráfica',
  entregue: 'Entregue',
}

export const STATUS_PAINEL_COR: Record<StatusPainel, string> = {
  aguardando_fotos: 'bg-amber-100 text-amber-900',
  em_preparacao: 'bg-indigo-100 text-indigo-900',
  aguardando_aprovacao: 'bg-amber-400 text-[#171717]',
  em_ajustes: 'bg-orange-100 text-orange-900',
  aprovado: 'bg-emerald-100 text-emerald-900',
  em_producao: 'bg-sky-100 text-sky-900',
  entregue: 'bg-emerald-600 text-white',
}

export const STATUS_PAINEL_DESCRICAO: Record<StatusPainel, string> = {
  aguardando_fotos: 'Envie as fotos do evento para o estúdio começar o seu álbum.',
  em_preparacao: 'O estúdio está montando o seu álbum com carinho.',
  aguardando_aprovacao: 'A prova está pronta. Revise as lâminas e aprove ou peça ajustes.',
  em_ajustes: 'Recebemos seus pedidos. O estúdio está preparando uma nova versão.',
  aprovado: 'Você aprovou o álbum. O estúdio está finalizando os detalhes para a impressão.',
  em_producao: 'Seu álbum está sendo produzido na gráfica.',
  entregue: 'Seu álbum foi entregue. Aproveite as memórias!',
}

/** Ordem da jornada (para a barra de progresso dos cards). */
export const STATUS_PAINEL_ORDEM: StatusPainel[] = [
  'aguardando_fotos',
  'em_preparacao',
  'aguardando_aprovacao',
  'em_ajustes',
  'aprovado',
  'em_producao',
  'entregue',
]

type ProjetoDoPainel = Pick<Project, 'status' | 'approvals' | 'codigoRastreio' | 'enviadoEm'>

export type SituacaoDoProjeto = {
  status: StatusPainel
  label: string
  descricao: string
  /** Álbum já despachado pela gráfica (status `enviado`). */
  despachado: boolean
  rastreio: string | null
  enviadoEm: string | null
}

/**
 * Os 15 status internos viram os poucos que fazem sentido para o casal.
 * White label: "aprovado aguardando pagamento" (fechamento entre o estúdio e
 * a SeuÁlbum) aparece só como "Aprovado".
 */
export function statusDoPainel(projeto: ProjetoDoPainel): StatusPainel {
  switch (projeto.status) {
    case 'aguardando_fotos':
      return 'aguardando_fotos'
    case 'aguardando_aprovacao_cliente':
      return 'aguardando_aprovacao'
    case 'alteracoes_solicitadas':
    case 'em_ajustes':
      return 'em_ajustes'
    case 'aprovado_aguardando_pagamento':
      return 'aprovado'
    case 'aprovado':
    case 'enviado':
      return 'em_producao'
    case 'finalizado':
    case 'arquivado':
      return 'entregue'
    case 'em_diagramacao':
    case 'em_revisao_interna':
      // Depois de um pedido de ajustes, a nova versão volta a passar pela
      // diagramação e pela revisão interna: para o casal, ainda são "ajustes".
      return projeto.approvals.some((a) => a.status === 'alteracao_solicitada') ? 'em_ajustes' : 'em_preparacao'
    default:
      return 'em_preparacao'
  }
}

export function situacaoDoProjeto(projeto: ProjetoDoPainel): SituacaoDoProjeto {
  const status = statusDoPainel(projeto)
  const despachado = projeto.status === 'enviado'
  return {
    status,
    label: despachado ? 'Despachado pela gráfica' : STATUS_PAINEL_LABEL[status],
    descricao: despachado
      ? 'Seu álbum saiu da gráfica e está a caminho.'
      : STATUS_PAINEL_DESCRICAO[status],
    despachado,
    rastreio: projeto.codigoRastreio ?? null,
    enviadoEm: projeto.enviadoEm ?? null,
  }
}

export function progressoDoStatus(status: StatusPainel): number {
  const i = STATUS_PAINEL_ORDEM.indexOf(status)
  return Math.round(((i + 1) / STATUS_PAINEL_ORDEM.length) * 100)
}

/* -------------------------------------------------------------------------- */
/* Prazo para responder                                                        */
/* -------------------------------------------------------------------------- */

export type PrazoDeResposta = { dias: number; vencido: boolean; urgente: boolean; texto: string }

const DIA_MS = 86_400_000

function dataCurta(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d)
}

/** Prazo do SLA do cliente (`data_limite_aprovacao`), em texto de gente. */
export function prazoDeResposta(dataLimite: string | null | undefined, agora: Date = new Date()): PrazoDeResposta | null {
  if (!dataLimite) return null
  const limite = new Date(dataLimite)
  if (Number.isNaN(limite.getTime())) return null
  const diff = limite.getTime() - agora.getTime()
  const dias = Math.ceil(diff / DIA_MS)
  if (diff < 0) return { dias, vencido: true, urgente: true, texto: `Prazo para responder encerrado em ${dataCurta(limite)}` }
  if (dias <= 1) {
    const hoje = limite.toDateString() === agora.toDateString()
    return { dias, vencido: false, urgente: true, texto: hoje ? 'Responda até hoje' : `Responda até amanhã (${dataCurta(limite)})` }
  }
  return { dias, vencido: false, urgente: dias <= 2, texto: `Responda em até ${dias} dias (até ${dataCurta(limite)})` }
}

/* -------------------------------------------------------------------------- */
/* Versões                                                                    */
/* -------------------------------------------------------------------------- */

/** Só versões aprovadas internamente chegam ao cliente (RLS da 0018 faz o mesmo). */
export function versoesLiberadas(versoes: DesignVersion[]): DesignVersion[] {
  return versoes.filter((v) => v.status === 'aprovada').sort((a, b) => a.numero - b.numero)
}

export function laminasEmOrdem(versao: DesignVersion | undefined): Lamina[] {
  return [...(versao?.laminas ?? [])].sort((a, b) => a.ordem - b.ordem)
}

export function rotuloDaLamina(lamina: Pick<Lamina, 'ehCapa'> | undefined, indice: number) {
  return lamina?.ehCapa && indice === 0 ? 'Capa' : `Lâmina ${indice + 1}`
}

export type SituacaoVersao = 'aguardando_voce' | 'em_analise' | 'ajustes_pedidos' | 'aprovada' | 'substituida'

export const SITUACAO_VERSAO_LABEL: Record<SituacaoVersao, string> = {
  aguardando_voce: 'Aguardando você',
  em_analise: 'Em análise',
  ajustes_pedidos: 'Ajustes pedidos',
  aprovada: 'Aprovada',
  substituida: 'Substituída',
}

export type EtapaDaVersao = {
  id: string
  numero: number
  data: string
  total: number
  alteradas: number
  parcial: boolean
  situacao: SituacaoVersao
  decididaEm: string | null
  apontamentos: number
  resolvidos: number
}

/** Linha do tempo das versões publicadas, da mais nova para a mais antiga. */
export function linhaDoTempoDeVersoes(
  versoes: DesignVersion[],
  aprovacoes: ApprovalEntry[],
  comentarios: ProofComment[],
  statusDoProjeto: Project['status'],
): EtapaDaVersao[] {
  const liberadas = versoesLiberadas(versoes)
  const maisRecente = liberadas[liberadas.length - 1]?.numero
  return liberadas
    .map((v) => {
      const laminas = v.laminas ?? []
      const decisao = [...aprovacoes]
        .filter((a) => a.versao === v.numero)
        .sort((a, b) => b.data.localeCompare(a.data))[0]
      const daVersao = comentarios.filter((c) => c.versao === v.numero)
      let situacao: SituacaoVersao
      if (decisao?.status === 'aprovado') situacao = 'aprovada'
      else if (decisao?.status === 'alteracao_solicitada') situacao = 'ajustes_pedidos'
      else if (v.numero === maisRecente) situacao = statusDoProjeto === 'aguardando_aprovacao_cliente' ? 'aguardando_voce' : 'em_analise'
      else situacao = 'substituida'
      return {
        id: v.id,
        numero: v.numero,
        data: v.data,
        total: laminas.length,
        alteradas: laminas.filter((l) => l.alterada !== false).length,
        parcial: laminas.some((l) => l.alterada === false),
        situacao,
        decididaEm: decisao?.data ?? null,
        apontamentos: daVersao.length,
        resolvidos: daVersao.filter((c) => c.resolvido).length,
      }
    })
    .reverse()
}

/* -------------------------------------------------------------------------- */
/* Checklist de lâminas                                                        */
/* -------------------------------------------------------------------------- */

export type EstadoChecklist = 'aprovada' | 'com_comentarios' | 'vista' | 'nao_vista'

export const ESTADO_CHECKLIST_LABEL: Record<EstadoChecklist, string> = {
  aprovada: 'Aprovada',
  com_comentarios: 'Com comentários',
  vista: 'Vista',
  nao_vista: 'Ainda não vista',
}

export type ItemDoChecklist = {
  lamina: Lamina
  indice: number
  rotulo: string
  estado: EstadoChecklist
  comentarios: number
  abertos: number
  alterada: boolean
}

export type Checklist = {
  itens: ItemDoChecklist[]
  total: number
  /** Aprovadas + com comentários: o "12 de 30 lâminas revisadas". */
  revisadas: number
  aprovadas: number
  comComentarios: number
  vistas: number
  naoVistas: number
}

/** Mesma regra da prova: comentário novo aponta a lâmina; antigo, o índice. */
export function comentariosDaLamina(comentarios: ProofComment[], versao: number, lamina: Lamina, indice: number) {
  return comentarios.filter(
    (c) => c.versao === versao && (c.laminaId ? c.laminaId === lamina.id : c.pageIndex === indice),
  )
}

export function checklistDaVersao(
  versao: DesignVersion | undefined,
  comentarios: ProofComment[],
  revisoes: RevisaoLamina[],
): Checklist {
  const laminas = laminasEmOrdem(versao)
  const estadoPorLamina = new Map(revisoes.map((r) => [r.laminaId, r.estado]))
  const itens = laminas.map((lamina, indice): ItemDoChecklist => {
    const daLamina = versao ? comentariosDaLamina(comentarios, versao.numero, lamina, indice) : []
    const abertos = daLamina.filter((c) => !c.resolvido).length
    const marcado = estadoPorLamina.get(lamina.id)
    const estado: EstadoChecklist =
      abertos > 0 ? 'com_comentarios' : marcado === 'aprovada' ? 'aprovada' : marcado === 'vista' || daLamina.length > 0 ? 'vista' : 'nao_vista'
    return {
      lamina,
      indice,
      rotulo: rotuloDaLamina(lamina, indice),
      estado,
      comentarios: daLamina.length,
      abertos,
      alterada: lamina.alterada !== false,
    }
  })
  const conta = (e: EstadoChecklist) => itens.filter((i) => i.estado === e).length
  const aprovadas = conta('aprovada')
  const comComentarios = conta('com_comentarios')
  return {
    itens,
    total: itens.length,
    revisadas: aprovadas + comComentarios,
    aprovadas,
    comComentarios,
    vistas: conta('vista'),
    naoVistas: conta('nao_vista'),
  }
}

/* -------------------------------------------------------------------------- */
/* Apontamentos                                                                */
/* -------------------------------------------------------------------------- */

export type ApontamentoDoPainel = {
  comentario: ProofComment
  versao: number
  indice: number
  rotulo: string
  aberto: boolean
  /** Versão publicada depois do pedido em que o estúdio entregou o ajuste. */
  resolvidoNaVersao: number | null
  meu: boolean
}

/**
 * Apontamentos da prova, abertos primeiro. "Resolvido na versão N" = a
 * primeira versão liberada depois daquela em que o pedido foi feito.
 */
export function apontamentosDoPainel(
  comentarios: ProofComment[],
  versoes: DesignVersion[],
  meuId?: string | null,
): ApontamentoDoPainel[] {
  const liberadas = versoesLiberadas(versoes)
  const porNumero = new Map(liberadas.map((v) => [v.numero, laminasEmOrdem(v)]))
  return comentarios
    .map((c): ApontamentoDoPainel => {
      const laminas = porNumero.get(c.versao) ?? []
      const achada = c.laminaId ? laminas.findIndex((l) => l.id === c.laminaId) : -1
      const indice = achada >= 0 ? achada : c.pageIndex
      const proxima = c.resolvido ? liberadas.find((v) => v.numero > c.versao) : undefined
      return {
        comentario: c,
        versao: c.versao,
        indice,
        rotulo: rotuloDaLamina(laminas[indice], indice),
        aberto: !c.resolvido,
        resolvidoNaVersao: proxima?.numero ?? null,
        meu: !!meuId && c.autorId === meuId,
      }
    })
    .sort((a, b) => Number(b.aberto) - Number(a.aberto) || b.versao - a.versao || a.indice - b.indice)
}

/* -------------------------------------------------------------------------- */
/* Pedir ajustes                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Texto gravado em `aprovacoes.comentario` ao pedir ajustes — o mesmo formato
 * da prova ("Lâmina 3 (área 1): …", separados por " | ").
 */
export function resumoDosAjustes(comentarios: ProofComment[], versao: number): string {
  const daVersao = comentarios.filter((c) => c.versao === versao)
  const numero = new Map<string, number>()
  daVersao.filter((c) => c.posicaoX != null).forEach((c, i) => numero.set(c.id, i + 1))
  return daVersao
    .map((c) => {
      const n = numero.get(c.id)
      return `Lâmina ${c.pageIndex + 1}${n ? ` (${c.areaLargura ? 'área' : 'pin'} ${n})` : ''}: ${c.texto}`
    })
    .join(' | ')
}
