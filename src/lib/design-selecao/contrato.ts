import type { CriarAlbumDaSelecaoResultado, DesignSelecaoResumo } from '@/types/database'

/**
 * Contrato seleção → documento de álbum (migration 0090), lado do app.
 * Funções puras: validam a forma da entrada e da resposta; quem decide
 * permissão, idempotência e imutabilidade é o banco.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const DESTINOS = ['projeto', 'avulso'] as const
export type DestinoAlbum = (typeof DESTINOS)[number]

export const ROTULO_DESTINO: Record<DestinoAlbum, string> = {
  projeto: 'Álbum do projeto',
  avulso: 'Álbum avulso',
}

export const DESCRICAO_DESTINO: Record<DestinoAlbum, string> = {
  projeto: 'Vira o documento de diagramação do projeto (um por projeto), com a prova e a aprovação de sempre.',
  avulso: 'Álbum independente para outra versão; usa as mesmas fotos, sem copiar nenhum original.',
}

export type EntradaCriarAlbum = {
  selecaoId: string
  destino: DestinoAlbum
  chave: string
  nome?: string
  formato?: string
  orientacao?: string
}

const ORIENTACOES = ['quadrado', 'horizontal', 'vertical']

export function entradaCriarAlbumValida(e: EntradaCriarAlbum) {
  return (
    !!e &&
    typeof e.selecaoId === 'string' &&
    UUID.test(e.selecaoId) &&
    typeof e.chave === 'string' &&
    UUID.test(e.chave) &&
    (DESTINOS as readonly string[]).includes(e.destino) &&
    (e.nome === undefined || (typeof e.nome === 'string' && e.nome.length <= 200)) &&
    (e.formato === undefined || (typeof e.formato === 'string' && e.formato.length <= 20)) &&
    (e.orientacao === undefined || (typeof e.orientacao === 'string' && ORIENTACOES.includes(e.orientacao)))
  )
}

export function criacaoValida(v: unknown): v is CriarAlbumDaSelecaoResultado {
  if (!v || typeof v !== 'object') return false
  const r = v as Partial<CriarAlbumDaSelecaoResultado>
  return (
    typeof r.layout_id === 'string' &&
    UUID.test(r.layout_id) &&
    typeof r.vinculo_id === 'string' &&
    UUID.test(r.vinculo_id) &&
    Number.isSafeInteger(r.revisao) &&
    r.revisao! > 0 &&
    Number.isSafeInteger(r.total) &&
    r.total! > 0 &&
    (r.destino === 'projeto' || r.destino === 'avulso') &&
    typeof r.criado === 'boolean'
  )
}

export function resumoValido(v: unknown): v is DesignSelecaoResumo {
  if (!v || typeof v !== 'object') return false
  const r = v as Partial<DesignSelecaoResumo>
  return typeof r.pode_criar === 'boolean' && typeof r.pode_abrir_editor === 'boolean' && typeof r.tem_album_projeto === 'boolean' && Array.isArray(r.albuns)
}

/** Destino inicial sugerido: o álbum do projeto, a menos que ele já exista. */
export function destinoSugerido(r: Pick<DesignSelecaoResumo, 'tem_album_projeto'>): DestinoAlbum {
  return r.tem_album_projeto ? 'avulso' : 'projeto'
}

/** Onde abrir o álbum criado (só vale para quem pode abrir o editor). */
export function enderecoDoEditor(projetoId: string, r: Pick<CriarAlbumDaSelecaoResultado, 'layout_id' | 'destino'>) {
  return r.destino === 'projeto' ? `/admin/projetos/${projetoId}/editor` : `/admin/albuns/${r.layout_id}`
}

export type AlbumDaSelecao = DesignSelecaoResumo['albuns'][number]

/** Álbuns já criados a partir de uma revisão específica da seleção. */
export function albunsDaRevisao(r: Pick<DesignSelecaoResumo, 'albuns'>, revisao: number): AlbumDaSelecao[] {
  return r.albuns.filter((a) => a.revisao === revisao)
}
