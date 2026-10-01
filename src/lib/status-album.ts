import type { BadgeProps } from '@/components/ui/badge'
import type { OrderStatus, ProjectStatusDb } from '@/types/database'

/**
 * Status que o fotógrafo vê para cada álbum (/dashboard, /dashboard/meus-albuns).
 *
 * Fonte da verdade (Fase 2 da ligação pedido → projeto, migration 0017):
 *   - existe projeto → o status de PRODUÇÃO vem de `projetos.status`,
 *     traduzido dos 14 estágios internos para 6 etapas legíveis;
 *   - ainda não existe projeto → só o status COMERCIAL de `orders.status`
 *     (aguardando pagamento, cancelado, ou liberado aguardando conversão).
 */

export type GrupoAlbum = 'andamento' | 'prova' | 'finalizado' | 'encerrado'

export interface StatusAlbum {
  rotulo: string
  variante: NonNullable<BadgeProps['variant']>
  /** Agrupa para os contadores do dashboard. */
  grupo: GrupoAlbum
  /** A prova pode ser aberta (para revisar, ou só ver depois de aprovada). */
  temProva: boolean
  /** A prova está esperando uma decisão do fotógrafo agora. */
  aguardaDecisao: boolean
}

const PRODUCAO: Record<ProjectStatusDb, StatusAlbum> = {
  projeto_criado: fila(),
  aguardando_fotos: fila(),
  fotos_recebidas: fila(),
  aguardando_briefing: fila(),
  pronto_para_diagramacao: fila(),
  em_diagramacao: { rotulo: 'Em diagramação', variante: 'default', grupo: 'andamento', temProva: false, aguardaDecisao: false },
  em_revisao_interna: { rotulo: 'Em diagramação', variante: 'default', grupo: 'andamento', temProva: false, aguardaDecisao: false },
  aguardando_aprovacao_cliente: { rotulo: 'Prova disponível', variante: 'warning', grupo: 'prova', temProva: true, aguardaDecisao: true },
  alteracoes_solicitadas: { rotulo: 'Em ajustes', variante: 'default', grupo: 'andamento', temProva: true, aguardaDecisao: false },
  em_ajustes: { rotulo: 'Em ajustes', variante: 'default', grupo: 'andamento', temProva: true, aguardaDecisao: false },
  aprovado_aguardando_pagamento: {
    rotulo: 'Lâminas extras a pagar',
    variante: 'warning',
    grupo: 'andamento',
    temProva: true,
    aguardaDecisao: false,
  },
  aprovado: { rotulo: 'Aprovado para impressão', variante: 'success', grupo: 'finalizado', temProva: true, aguardaDecisao: false },
  enviado: { rotulo: 'Enviado', variante: 'success', grupo: 'finalizado', temProva: true, aguardaDecisao: false },
  finalizado: { rotulo: 'Finalizado', variante: 'success', grupo: 'finalizado', temProva: true, aguardaDecisao: false },
  arquivado: { rotulo: 'Arquivado', variante: 'outline', grupo: 'encerrado', temProva: true, aguardaDecisao: false },
}

function fila(): StatusAlbum {
  return { rotulo: 'Na fila de design', variante: 'default', grupo: 'andamento', temProva: false, aguardaDecisao: false }
}

export function statusDoAlbum(pedido: { status: OrderStatus; projetoStatus: ProjectStatusDb | null }): StatusAlbum {
  if (pedido.projetoStatus) return PRODUCAO[pedido.projetoStatus] ?? fila()

  switch (pedido.status) {
    case 'pendente':
      return { rotulo: 'Aguardando pagamento', variante: 'muted', grupo: 'andamento', temProva: false, aguardaDecisao: false }
    case 'cancelado':
      return { rotulo: 'Cancelado', variante: 'outline', grupo: 'encerrado', temProva: false, aguardaDecisao: false }
    case 'finalizado':
      return PRODUCAO.finalizado
    default:
      // Liberado (pago/assinante) e ainda sem projeto: a conversão roda no
      // mesmo instante, então na prática é "na fila".
      return fila()
  }
}

/**
 * Para onde leva um clique no álbum (capa, miniatura ou nome) — o mesmo
 * destino do botão de ação: a prova, ou o download depois de finalizado.
 * `null` = ainda não há o que abrir (na fila, aguardando pagamento).
 */
export function destinoDoAlbum(a: {
  album: StatusAlbum
  projetoId: string | null
  linkEntregaFinal: string | null
}): { href: string; externo: boolean } | null {
  if (a.album.grupo === 'finalizado' && a.linkEntregaFinal) return { href: a.linkEntregaFinal, externo: true }
  if (a.album.temProva && a.projetoId) return { href: `/dashboard/albuns/${a.projetoId}/prova`, externo: false }
  return null
}
