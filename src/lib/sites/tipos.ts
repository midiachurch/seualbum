/**
 * Contrato do documento de site (v1). O banco valida o mesmo formato na
 * migration 0070 (`_site_validar_conteudo`); mudou aqui, muda lá.
 */
export const TIPOS_BLOCO = ['hero', 'texto', 'sobre', 'galeria', 'servicos', 'contato', 'depoimentos', 'rodape'] as const
export type TipoBloco = (typeof TIPOS_BLOCO)[number]

export const ROTULO_BLOCO: Record<TipoBloco, string> = {
  hero: 'Destaque (capa)',
  texto: 'Texto',
  sobre: 'Sobre',
  galeria: 'Galeria de fotos',
  servicos: 'Serviços e preços',
  contato: 'Contato e chamada',
  depoimentos: 'Depoimentos',
  rodape: 'Rodapé',
}

export type HeroDados = { titulo: string; subtitulo?: string; midia_id?: string; alt?: string; cta_texto?: string; cta_url?: string }
export type TextoDados = { titulo?: string; html: string }
export type SobreDados = { titulo: string; html: string; midia_id?: string; alt?: string }
export type GaleriaItem = { midia_id: string; alt: string; legenda?: string }
export type GaleriaDados = { titulo?: string; colunas?: 2 | 3 | 4; itens: GaleriaItem[] }
export type ServicoItem = { nome: string; descricao?: string; preco?: string }
export type ServicosDados = { titulo?: string; itens: ServicoItem[] }
export type ContatoDados = { titulo: string; texto?: string; email?: string; telefone?: string; whatsapp?: string; instagram?: string; cta_texto?: string }
export type DepoimentoItem = { texto: string; autor: string; detalhe?: string }
export type DepoimentosDados = { titulo?: string; itens: DepoimentoItem[] }
export type RodapeLink = { rotulo: string; url: string }
export type RodapeDados = { texto?: string; instagram?: string; links?: RodapeLink[] }

export type Bloco =
  | { id: string; tipo: 'hero'; dados: HeroDados }
  | { id: string; tipo: 'texto'; dados: TextoDados }
  | { id: string; tipo: 'sobre'; dados: SobreDados }
  | { id: string; tipo: 'galeria'; dados: GaleriaDados }
  | { id: string; tipo: 'servicos'; dados: ServicosDados }
  | { id: string; tipo: 'contato'; dados: ContatoDados }
  | { id: string; tipo: 'depoimentos'; dados: DepoimentosDados }
  | { id: string; tipo: 'rodape'; dados: RodapeDados }

export type PaginaSite = { slug: string; titulo: string; blocos: Bloco[] }
export type TemaSite = { cor?: string; fonte?: 'sans' | 'serif'; modo?: 'claro' | 'escuro' }
export type SeoSite = { titulo?: string; descricao?: string; midia_id?: string }
export type ConteudoSite = { v: 1; tema?: TemaSite; seo?: SeoSite; paginas: PaginaSite[] }

/** Mídia resolvida na publicação (snapshot): id → chave pública + dimensões. */
export type MidiaPublicada = { chave: string; largura: number | null; altura: number | null }
export type MapaMidias = Record<string, MidiaPublicada>

/** Resposta de `obter_site_publicado*`. */
export type SitePublicado = {
  slug: string
  nome: string
  versao: number
  publicado_em: string
  dominio: string | null
  conteudo: ConteudoSite
  midias: MapaMidias
}

export const LIMITES_SITE = { paginas: 10, blocosPorPagina: 40, bytes: 262144 } as const

export function conteudoInicial(nome: string): ConteudoSite {
  return {
    v: 1,
    tema: { cor: '#1f2937', fonte: 'sans', modo: 'claro' },
    seo: { titulo: nome.slice(0, 70) },
    paginas: [{ slug: 'inicio', titulo: 'Início', blocos: [{ id: 'hero-1', tipo: 'hero', dados: { titulo: nome.slice(0, 120) } }] }],
  }
}

export function novoIdBloco(): string {
  return 'b' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function blocoVazio(tipo: TipoBloco): Bloco {
  const id = novoIdBloco()
  switch (tipo) {
    case 'hero': return { id, tipo, dados: { titulo: 'Título principal' } }
    case 'texto': return { id, tipo, dados: { html: '<p>Escreva aqui.</p>' } }
    case 'sobre': return { id, tipo, dados: { titulo: 'Sobre', html: '<p>Conte sua história.</p>' } }
    case 'galeria': return { id, tipo, dados: { titulo: 'Portfólio', colunas: 3, itens: [] } }
    case 'servicos': return { id, tipo, dados: { titulo: 'Serviços', itens: [{ nome: 'Ensaio', preco: 'Sob consulta' }] } }
    case 'contato': return { id, tipo, dados: { titulo: 'Fale comigo', email: '' } }
    case 'depoimentos': return { id, tipo, dados: { titulo: 'Quem já fotografou', itens: [{ texto: 'Depoimento', autor: 'Nome' }] } }
    case 'rodape': return { id, tipo, dados: { texto: '' } }
  }
}
