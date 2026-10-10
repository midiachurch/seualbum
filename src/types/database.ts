/**
 * Tipos do banco. Em produção, regenere com:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 * Este arquivo espelha manualmente supabase/migrations/0002_plataforma_completa.sql
 * e 0003_compat_pedidos_legado.sql.
 */

import type {
  AlbumConfig,
  Briefing,
  PlatformRole,
} from '@/types/platform'
import type { DiagramacaoItemRow, PrioridadeDiagramacao, ResumoDiagramacao } from '@/lib/diagramacao/regras'

export type BillingType = 'avulso' | 'assinatura'
export type OrderStatus =
  | 'pendente'
  | 'na_fila_design'
  | 'em_producao'
  | 'aguardando_aprovacao'
  | 'em_revisao'
  | 'finalizado'
  | 'cancelado'
export type ProjectStatusDb =
  | 'projeto_criado'
  | 'aguardando_fotos'
  | 'fotos_recebidas'
  | 'aguardando_briefing'
  | 'pronto_para_diagramacao'
  | 'em_diagramacao'
  | 'em_revisao_interna'
  | 'aguardando_aprovacao_cliente'
  | 'alteracoes_solicitadas'
  | 'em_ajustes'
  /** Aprovado com lâminas extras a pagar pelo fotógrafo (migration 0022/0023). */
  | 'aprovado_aguardando_pagamento'
  | 'aprovado'
  | 'enviado'
  | 'finalizado'
  | 'arquivado'
export type DesignVersionStatusDb = 'em_producao' | 'enviada' | 'aprovada' | 'rejeitada'
export type ApprovalStatusDb = 'aprovado' | 'alteracao_solicitada'
export type PortfolioStatusDb = 'publicado' | 'rascunho'
export type FaturaStatusDb = 'pendente' | 'pago' | 'cancelado' | 'dispensada'
export type FormaPagamentoDb = 'cartao' | 'pix'
export type OrcamentoStatusDb = 'rascunho' | 'enviado'

export type PlanFeature = {
  chave: string
  label: string
  incluso: boolean | string
}

/**
 * As linhas são `type`, não `interface`, de propósito: o supabase-js exige
 * `Row extends Record<string, unknown>` e uma `interface` não tem index
 * signature implícita, o que faz o schema inteiro colapsar para `never`.
 */
export type Profile = {
  id: string
  email: string
  nome_completo: string
  telefone: string | null
  avatar_url: string | null
  role: PlatformRole
  status: 'ativo' | 'inativo'
  created_at: string
  updated_at: string
}

export type Plano = {
  id: string
  slug: string
  nome_plano: string
  descricao: string | null
  tipo_cobranca: BillingType
  preco: number
  moeda: string
  albuns_inclusos: number | null
  prazo_dias: number
  revisoes_inclusas: number
  features_json: PlanFeature[]
  destaque: boolean
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

/** Alias mantido para não quebrar o restante do app (`Plan` era o nome antigo de `Plano`). */
export type Plan = Plano

export type Order = {
  id: string
  numero: number
  client_id: string
  plan_id: string | null
  nome_projeto: string
  /** Link externo (Drive/Dropbox). Opcional quando há fotos no Storage. */
  link_fotos_brutas: string | null
  /** Fotos em `pedidos_fotos/{client_id}/{chave_idempotencia}/`, contadas no envio. */
  fotos_enviadas: number
  estilo_design: string
  briefing: string | null
  numero_paginas: number | null
  data_evento: string | null
  cliente_final_nome: string | null
  cliente_final_telefone: string | null
  cliente_final_email: string | null
  /** UUID do rascunho do wizard — UNIQUE, barra reenvio duplicado. Null em pedidos antigos. */
  chave_idempotencia: string | null
  /** Preenchidos pelo webhook do Stripe (service role) — o fotógrafo não altera. */
  pago_em: string | null
  valor_pago: number | null
  stripe_checkout_session_id: string | null
  /** Projeto de produção criado quando o pedido é liberado (migration 0017). */
  projeto_id: string | null
  status: OrderStatus
  link_aprovacao: string | null
  link_entrega_final: string | null
  observacoes_admin: string | null
  revisoes_usadas: number
  prazo_entrega: string | null
  finalizado_em: string | null
  created_at: string
  updated_at: string
}

/** Payload aceito pelo formulário de novo pedido (colunas que o cliente controla). */
export type NewOrderInput = Pick<
  Order,
  'plan_id' | 'nome_projeto' | 'link_fotos_brutas' | 'estilo_design'
> &
  Partial<Pick<Order, 'briefing' | 'numero_paginas' | 'data_evento'>>

export type FotografoRow = {
  id: string
  estudio: string
  cidade: string | null
  plano_id: string | null
  status: 'ativo' | 'inativo'
  /** Endereço público do logo (bucket `fotografo_logos` ou R2 público). É o que a tela do orçamento lê. */
  logo_url: string | null
  /** Migration 0034: chave do logo e onde ela está ('r2' = bucket público do R2). Null = logo antigo, só `logo_url`. */
  logo_path: string | null
  logo_bucket: 'fotografo_logos' | 'r2' | null
  created_at: string
  updated_at: string
}

export type ClienteRow = {
  id: string
  user_id: string | null
  fotografo_id: string
  nome: string
  /** Opcional desde a migration 0017: o pedido não exige os dados do casal. */
  email: string | null
  telefone: string | null
  cidade: string | null
  estado: string | null
  origem: string | null
  status: 'ativo' | 'inativo'
  observacoes_internas: string | null
  created_at: string
  updated_at: string
}

export type ProjetoRow = {
  id: string
  numero: number
  nome: string
  cliente_id: string
  fotografo_id: string
  responsavel_id: string | null
  plano_id: string | null
  tipo_evento: string | null
  data_evento: string | null
  status: ProjectStatusDb
  prazo: string | null
  meta_fotos: number | null
  data_limite_producao: string
  data_limite_aprovacao: string | null
  produto_id: string | null
  codigo_rastreio: string | null
  enviado_em: string | null
  album_config: Partial<AlbumConfig>
  briefing: Partial<Briefing>
  /** Franquia congelada no pedido (migration 0023): lâminas do plano e preço da extra. */
  laminas_inclusas: number | null
  preco_lamina_extra: number | null
  /** Controle da diagramação (0038) — ausentes enquanto a migration não for aplicada. */
  prioridade?: PrioridadeDiagramacao
  em_espera?: boolean
  em_espera_motivo?: string | null
  em_espera_desde?: string | null
  created_at: string
  updated_at: string
}

/** Foto do wizard de novo pedido guardada no Cloudflare R2 (migration 0030). */
export type PedidoFotoR2Row = {
  id: string
  client_id: string
  chave_idempotencia: string
  r2_key: string
  nome_original: string
  tamanho: number
  content_type: string
  /** EXIF lido no navegador (migration 0031). */
  capturada_em: string | null
  camera: string | null
  created_at: string
}

/** Envio ao R2 assinado e ainda não confirmado (migration 0040). */
export type R2UploadPendenteRow = {
  r2_key: string
  user_id: string
  expira_em: string
  created_at: string
}

export type FotoRow = {
  id: string
  projeto_id: string
  storage_path: string
  url: string | null
  grupo: string | null
  favorita: boolean
  obrigatoria: boolean
  destaque: boolean
  capa: boolean
  observacao: string | null
  enviado_por: string | null
  /** Bucket do arquivo: fotos vindas do wizard ficam em `pedidos_fotos` (migration 0017). */
  /** 'r2' = `storage_path` é a chave no Cloudflare R2 (migration 0031). */
  bucket: 'projetos_fotos' | 'pedidos_fotos' | 'r2'
  /** EXIF (migration 0025): relógio da câmera, sem fuso ("2026-09-20T14:32:05.12"). */
  capturada_em: string | null
  camera: string | null
  created_at: string
}

export type DesignVersionRow = {
  id: string
  projeto_id: string
  numero: number
  responsavel_id: string | null
  storage_path: string | null
  arquivo_url: string | null
  comentarios: string | null
  status: DesignVersionStatusDb
  quantidade_paginas: number | null
  layout_json: { numero: number; fotoIds: string[] }[] | null
  gerado_automaticamente: boolean
  /** Versão parcial (0032): a versão de onde as lâminas não trocadas foram herdadas. */
  base_versao_id: string | null
  created_at: string
}

export type AprovacaoRow = {
  id: string
  projeto_id: string
  versao: number
  usuario_id: string | null
  status: ApprovalStatusDb
  comentario: string | null
  created_at: string
}

export type ProjetoAtividadeRow = {
  id: string
  projeto_id: string
  autor_id: string | null
  mensagem: string
  created_at: string
}

export type ProvaComentarioRow = {
  id: string
  projeto_id: string
  page_index: number
  versao: number
  texto: string
  autor_id: string | null
  /** Apontamento visual (migration 0018): lâmina e posição em % (0–100). */
  lamina_id: string | null
  posicao_x: number | null
  posicao_y: number | null
  /** Apontamento por área (0032): retângulo em %, canto superior esquerdo em posicao_x/y. */
  area_largura: number | null
  area_altura: number | null
  /** A equipe marcou como resolvido (migration 0019); horário carimbado pelo banco. */
  resolvido: boolean
  resolvido_em: string | null
  created_at: string
}

export type StatusAlbum =
  | 'rascunho'
  | 'em_edicao'
  | 'enviado_aprovacao'
  | 'alteracoes_solicitadas'
  | 'em_revisao'
  | 'aprovado'
  | 'finalizado'
  | 'em_producao'

/** Organização da biblioteca de um álbum (0027). */
export type BibliotecaAlbum = {
  pastas?: { id: string; nome: string }[]
  fotos?: Record<
    string,
    {
      pasta?: string | null
      favorita?: boolean
      prioridade?: 'principal' | 'secundaria' | 'complementar' | null
      /** Ponto focal definido à mão (sobrepõe o medido). */
      foco?: { fx: number; fy: number } | null
    }
  >
}

/** Versões leves de uma foto (chaves `albuns/…` no R2, ou paths antigos em `albuns_fotos`) + medidas feitas no navegador. */
export type DerivadoFoto = {
  mini: string
  preview: string
  largura: number
  altura: number
  estouro: number | null
  fx: number
  fy: number
  /** Preto e branco (modo de cor medido). */
  pb?: boolean | null
}

export type AlbumLayoutVersaoRow = {
  id: string
  layout_id: string
  documento: unknown
  tipo: 'auto' | 'manual' | 'restauracao' | 'aprovacao' | 'publicacao'
  rotulo: string | null
  criado_por: string | null
  created_at: string
}

export type AlbumAprovacaoRow = {
  id: string
  layout_id: string
  numero: number
  token: string
  laminas: { path: string; largura: number; altura: number; rotulo: string }[]
  status: 'aguardando' | 'aprovado' | 'alteracoes' | 'cancelado'
  mensagem_cliente: string | null
  decidido_por_nome: string | null
  decidido_em: string | null
  criado_por: string | null
  created_at: string
}

/** Template de lâmina salvo pela equipe (0027): geometria em frações da lâmina, sem fotos. */
export type AlbumTemplateRow = {
  id: string
  nome: string
  /** [{ x, y, w, h, raio? }] em frações (0–1) da lâmina aberta — vale para qualquer formato. */
  quadros: { x: number; y: number; w: number; h: number; raio?: number }[]
  assinatura: string
  n_fotos: number
  favorito: boolean
  usos: number
  ultimo_uso: string | null
  criado_por: string | null
  /** 0038: desativado pela gestão some do editor (ausente antes da migration = ativo). */
  ativo?: boolean
  created_at: string
}

export type AlbumAprovacaoComentarioRow = {
  id: string
  aprovacao_id: string
  lamina_indice: number
  x: number | null
  y: number | null
  texto: string
  autor_nome: string
  origem: 'cliente' | 'equipe'
  resolvido: boolean
  created_at: string
}

/** Documento do editor de álbum (migration 0027). `projeto_id` null = álbum avulso. */
export type AlbumLayoutRow = {
  id: string
  projeto_id: string | null
  nome: string
  cliente_nome: string | null
  tipo: string | null
  modelo: string | null
  fotos_estimadas: number | null
  status: StatusAlbum
  arquivado: boolean
  biblioteca: BibliotecaAlbum
  derivados: Record<string, DerivadoFoto>
  formato: string
  orientacao: 'quadrado' | 'horizontal' | 'vertical'
  sangria_mm: number
  margem_segura_mm: number
  documento: unknown
  /**
   * Só álbuns independentes. `path` com prefixo `albuns/` está no Cloudflare R2;
   * sem ele, é um arquivo antigo do bucket `albuns_fotos` (ver `bucketDoArquivoAlbum`).
   */
  fotos: { id: string; path: string; nome: string; largura: number | null; altura: number | null }[]
  /** Calculada no banco: quantidade de lâminas do documento. */
  laminas_qtd: number
  miniatura: string | null
  revisao: number
  criado_por: string | null
  /** Controle da diagramação do avulso (0038) — ausentes antes da migration. */
  responsavel_id?: string | null
  prazo?: string | null
  prioridade?: PrioridadeDiagramacao
  em_espera?: boolean
  em_espera_motivo?: string | null
  em_espera_desde?: string | null
  created_at: string
  updated_at: string
}

/** Lâmina (página/imagem) de uma versão da prova — migration 0018. */
export type VersaoLaminaRow = {
  id: string
  versao_id: string
  ordem: number
  /** 'r2' = `storage_path` é a chave no Cloudflare R2 (migration 0032). */
  bucket: 'projetos_fotos' | 'r2'
  storage_path: string
  largura: number | null
  altura: number | null
  /** A capa não conta na franquia de lâminas (migration 0023). */
  eh_capa: boolean
  /** Versão parcial (0032): false = herdada sem mudança da versão-base. */
  alterada: boolean
  origem_lamina_id: string | null
  created_at: string
}

export type MediaAssetRow = {
  id: string
  storage_path: string
  /** Migration 0034: 'r2' = `storage_path` é a chave no bucket público do R2. */
  bucket: 'midia_vitrine' | 'r2'
  url: string | null
  nome: string
  tags: string[]
  largura_px: number | null
  altura_px: number | null
  tamanho_kb: number | null
  criado_por: string | null
  created_at: string
}

export type BannerRow = {
  id: string
  imagem_id: string | null
  titulo: string
  subtitulo: string | null
  link_cta: string | null
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export type PortfolioCollectionRow = {
  id: string
  nome: string
  descricao: string | null
  capa_imagem_id: string | null
  status: PortfolioStatusDb
  ordem: number
  created_at: string
  updated_at: string
}

export type PortfolioItemRow = {
  id: string
  collection_id: string
  imagem_id: string
  legenda: string | null
  ordem: number
  created_at: string
}

export type ComunicacaoStatus = 'simulado' | 'enviado' | 'falhou'

export type ComunicacaoLogRow = {
  id: string
  projeto_id: string
  cliente_id: string | null
  tipo_evento: string
  assunto: string
  corpo_html: string
  status: ComunicacaoStatus
  data_criacao: string
}

export type PaginaStatus = 'publicado' | 'rascunho'

export type PaginaConteudoRow = {
  id: string
  slug: string
  titulo: string
  conteudo_html: string
  seo_description: string | null
  status: PaginaStatus
  criado_por: string | null
  created_at: string
  updated_at: string
}

export type ProdutoRow = {
  id: string
  nome: string
  formato: string
  descricao: string | null
  imagem_url: string | null
  preco_base: number
  paginas_inclusas: number
  preco_pagina_extra: number
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export type FaturaRow = {
  id: string
  projeto_id: string
  design_version_id: string | null
  valor_total: number
  itens_json: { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }[]
  status_pagamento: FaturaStatusDb
  forma_pagamento: FormaPagamentoDb | null
  created_at: string
  pago_em: string | null
  /** Migration 0023: cobrança de lâminas extras (paga pelo fotógrafo) e cortesia. */
  tipo: 'paginas_extras' | 'laminas_extras' | 'fechamento'
  laminas_versao: number | null
  laminas_inclusas: number | null
  dispensada_motivo: string | null
  dispensada_por: string | null
  dispensada_em: string | null
  /** Migration 0035: Checkout Session do Stripe aberta para esta fatura. */
  stripe_checkout_session_id?: string | null
}

/** Upsell B2B2C (migration 0026): catálogo de adicionais e itens da fatura. */
export type AdicionalRow = {
  id: string
  slug: string
  nome: string
  descricao: string | null
  imagem_url: string | null
  /** O que o ESTÚDIO paga. Nunca chega ao cliente final. */
  preco_custo: number
  /** Preço de revenda padrão ao casal. */
  preco_sugerido: number
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export type AdicionalEstudioRow = {
  fotografo_id: string
  adicional_id: string
  preco_revenda: number | null
  oferecer_ao_cliente: boolean
  updated_at: string
}

export type FaturaItemRow = {
  id: string
  fatura_id: string
  tipo: 'laminas_extras' | 'paginas_extras' | 'adicional'
  adicional_id: string | null
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  preco_revenda_unitario: number | null
  origem: 'sistema' | 'cliente' | 'fotografo'
  situacao: 'confirmado' | 'aguardando_estudio' | 'removido'
  decidido_em: string | null
  decidido_por: string | null
  created_at: string
}

/** CRM de retenção (migration 0024): alertas de fotógrafos parados. */
export type NotificacaoCrmTipo = 'sem_pedido_7d' | 'assinante_sem_projeto_mes'
export type NotificacaoCrmStatus = 'aberta' | 'contatado' | 'resolvida' | 'dispensada'
export type NotificacaoCrmRow = {
  id: string
  tipo: NotificacaoCrmTipo
  fotografo_id: string
  /** 'cadastro' (regra a) ou 'AAAA-MM' (regra b, mês de Brasília). */
  referencia: string
  status: NotificacaoCrmStatus
  dados: {
    dias_cadastrado?: number
    cadastrado_em?: string
    plano?: string | null
    tipo_cobranca?: string | null
    albuns_inclusos?: number | null
    albuns_usados?: number
    dias_para_fim_do_mes?: number
    ultimo_pedido_em?: string | null
    resolvida_automaticamente?: boolean
  }
  criada_em: string
  atualizada_em: string
  resolvida_em: string | null
  resolvida_por: string | null
}

/** Mensagens interligadas (migration 0037). */
export type ConversaRow = {
  id: string
  canal: 'estudio_equipe' | 'cliente_estudio'
  fotografo_id: string
  projeto_id: string | null
  ultima_mensagem_em: string | null
  ultima_mensagem_previa: string | null
  created_at: string
}

export type MensagemRow = {
  id: string
  conversa_id: string
  /** null = mensagem do sistema (ou autor removido). */
  autor_id: string | null
  autor_nome: string
  autor_papel: 'equipe' | 'fotografo' | 'cliente' | 'sistema'
  tipo: 'texto' | 'sistema'
  corpo: string
  lamina_id: string | null
  versao_id: string | null
  created_at: string
  apagada_em: string | null
  apagada_por: string | null
}

export type ConversaLeituraRow = {
  conversa_id: string
  usuario_id: string
  lida_ate: string
}

export type OrcamentoRow = {
  id: string
  fotografo_id: string
  cliente_final_nome: string
  cliente_final_contato: string | null
  itens_json: { produtoId: string | null; descricao: string; quantidade: number; valorUnitario: number }[]
  valor_total: number
  hash_publico: string
  status: OrcamentoStatusDb
  created_at: string
  updated_at: string
}

/**
 * O shape precisa bater com `GenericSchema` do supabase-js: omitir Views,
 * Functions ou CompositeTypes faz o genérico colapsar para `never` e todo
 * `.select()` volta sem tipo.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Pick<Profile, 'id' | 'email' | 'nome_completo'> & Partial<Profile>
        Update: Partial<Profile>
        Relationships: []
      }
      planos: {
        Row: Plano
        Insert: Omit<Plano, 'id' | 'created_at' | 'updated_at'> & Partial<Plano>
        Update: Partial<Plano>
        Relationships: []
      }
      orders: {
        Row: Order
        Insert: Pick<Order, 'client_id' | 'nome_projeto' | 'estilo_design'> &
          Partial<Omit<Order, 'id' | 'numero' | 'created_at' | 'updated_at'>>
        Update: Partial<Order>
        Relationships: []
      }
      fotografos: {
        Row: FotografoRow
        Insert: Pick<FotografoRow, 'id' | 'estudio'> & Partial<Omit<FotografoRow, 'id' | 'estudio'>>
        Update: Partial<FotografoRow>
        Relationships: []
      }
      clientes: {
        Row: ClienteRow
        Insert: Pick<ClienteRow, 'fotografo_id' | 'nome'> &
          Partial<Omit<ClienteRow, 'id' | 'created_at' | 'updated_at' | 'fotografo_id' | 'nome'>>
        Update: Partial<ClienteRow>
        Relationships: []
      }
      projetos: {
        Row: ProjetoRow
        Insert: Pick<ProjetoRow, 'nome' | 'cliente_id' | 'fotografo_id'> &
          Partial<Omit<ProjetoRow, 'id' | 'numero' | 'created_at' | 'updated_at' | 'nome' | 'cliente_id' | 'fotografo_id'>>
        Update: Partial<ProjetoRow>
        Relationships: []
      }
      fotos: {
        Row: FotoRow
        Insert: Pick<FotoRow, 'projeto_id' | 'storage_path'> &
          Partial<Omit<FotoRow, 'id' | 'created_at' | 'projeto_id' | 'storage_path'>>
        Update: Partial<FotoRow>
        Relationships: []
      }
      pedidos_fotos_r2: {
        Row: PedidoFotoR2Row
        Insert: Omit<PedidoFotoR2Row, 'id' | 'created_at' | 'capturada_em' | 'camera'> &
          Partial<Pick<PedidoFotoR2Row, 'id' | 'created_at' | 'capturada_em' | 'camera'>>
        Update: never
        Relationships: []
      }
      r2_uploads_pendentes: {
        Row: R2UploadPendenteRow
        Insert: Pick<R2UploadPendenteRow, 'r2_key' | 'user_id' | 'expira_em'> & Partial<Pick<R2UploadPendenteRow, 'created_at'>>
        Update: Partial<R2UploadPendenteRow>
        Relationships: []
      }
      design_versions: {
        Row: DesignVersionRow
        Insert: Pick<DesignVersionRow, 'projeto_id' | 'numero'> &
          Partial<Omit<DesignVersionRow, 'id' | 'created_at' | 'projeto_id' | 'numero'>>
        Update: Partial<DesignVersionRow>
        Relationships: []
      }
      aprovacoes: {
        Row: AprovacaoRow
        Insert: Pick<AprovacaoRow, 'projeto_id' | 'versao' | 'status'> &
          Partial<Omit<AprovacaoRow, 'id' | 'created_at' | 'projeto_id' | 'versao' | 'status'>>
        Update: Partial<AprovacaoRow>
        Relationships: []
      }
      projeto_atividades: {
        Row: ProjetoAtividadeRow
        Insert: Pick<ProjetoAtividadeRow, 'projeto_id' | 'mensagem'> &
          Partial<Omit<ProjetoAtividadeRow, 'id' | 'created_at' | 'projeto_id' | 'mensagem'>>
        Update: Partial<ProjetoAtividadeRow>
        Relationships: []
      }
      album_layouts: {
        Row: AlbumLayoutRow
        Insert: Pick<AlbumLayoutRow, 'nome' | 'formato' | 'orientacao'> &
          Partial<Omit<AlbumLayoutRow, 'id' | 'created_at' | 'updated_at' | 'revisao' | 'laminas_qtd'>>
        Update: Partial<Omit<AlbumLayoutRow, 'id' | 'created_at' | 'revisao' | 'laminas_qtd'>>
        Relationships: []
      }
      album_layout_versoes: {
        Row: AlbumLayoutVersaoRow
        Insert: Pick<AlbumLayoutVersaoRow, 'layout_id' | 'documento'> & Partial<Omit<AlbumLayoutVersaoRow, 'id' | 'created_at'>>
        Update: Partial<Pick<AlbumLayoutVersaoRow, 'rotulo'>>
        Relationships: []
      }
      album_aprovacoes: {
        Row: AlbumAprovacaoRow
        Insert: Pick<AlbumAprovacaoRow, 'layout_id' | 'numero' | 'laminas'> & Partial<Pick<AlbumAprovacaoRow, 'id' | 'status' | 'criado_por'>>
        Update: Partial<Pick<AlbumAprovacaoRow, 'status'>>
        Relationships: []
      }
      album_templates: {
        Row: AlbumTemplateRow
        Insert: Pick<AlbumTemplateRow, 'nome' | 'quadros' | 'assinatura' | 'n_fotos'> & Partial<Pick<AlbumTemplateRow, 'favorito' | 'criado_por'>>
        Update: Partial<Pick<AlbumTemplateRow, 'nome' | 'favorito' | 'usos' | 'ultimo_uso' | 'ativo'>>
        Relationships: []
      }
      album_aprovacao_comentarios: {
        Row: AlbumAprovacaoComentarioRow
        Insert: Pick<AlbumAprovacaoComentarioRow, 'aprovacao_id' | 'lamina_indice' | 'texto' | 'autor_nome'> &
          Partial<Pick<AlbumAprovacaoComentarioRow, 'x' | 'y' | 'origem'>>
        Update: Partial<Pick<AlbumAprovacaoComentarioRow, 'resolvido'>>
        Relationships: []
      }
      versoes_laminas: {
        Row: VersaoLaminaRow
        Insert: Pick<VersaoLaminaRow, 'versao_id' | 'ordem' | 'storage_path'> &
          Partial<Omit<VersaoLaminaRow, 'id' | 'created_at' | 'versao_id' | 'ordem' | 'storage_path'>>
        Update: Partial<VersaoLaminaRow>
        Relationships: []
      }
      prova_comentarios: {
        Row: ProvaComentarioRow
        Insert: Pick<ProvaComentarioRow, 'projeto_id' | 'page_index' | 'versao' | 'texto'> &
          Partial<Omit<ProvaComentarioRow, 'id' | 'created_at' | 'projeto_id' | 'page_index' | 'versao' | 'texto'>>
        Update: Partial<ProvaComentarioRow>
        Relationships: []
      }
      media_assets: {
        Row: MediaAssetRow
        Insert: Pick<MediaAssetRow, 'storage_path' | 'nome'> &
          Partial<Omit<MediaAssetRow, 'id' | 'created_at' | 'storage_path' | 'nome'>>
        Update: Partial<MediaAssetRow>
        Relationships: []
      }
      banners: {
        Row: BannerRow
        Insert: Pick<BannerRow, 'titulo'> & Partial<Omit<BannerRow, 'id' | 'created_at' | 'updated_at' | 'titulo'>>
        Update: Partial<BannerRow>
        Relationships: []
      }
      portfolio_collections: {
        Row: PortfolioCollectionRow
        Insert: Pick<PortfolioCollectionRow, 'nome'> &
          Partial<Omit<PortfolioCollectionRow, 'id' | 'created_at' | 'updated_at' | 'nome'>>
        Update: Partial<PortfolioCollectionRow>
        Relationships: []
      }
      portfolio_items: {
        Row: PortfolioItemRow
        Insert: Pick<PortfolioItemRow, 'collection_id' | 'imagem_id'> &
          Partial<Omit<PortfolioItemRow, 'id' | 'created_at' | 'collection_id' | 'imagem_id'>>
        Update: Partial<PortfolioItemRow>
        Relationships: []
      }
      comunicacoes_log: {
        Row: ComunicacaoLogRow
        Insert: Pick<ComunicacaoLogRow, 'projeto_id' | 'tipo_evento' | 'assunto' | 'corpo_html'> &
          Partial<Omit<ComunicacaoLogRow, 'id' | 'data_criacao' | 'projeto_id' | 'tipo_evento' | 'assunto' | 'corpo_html'>>
        Update: Partial<ComunicacaoLogRow>
        Relationships: []
      }
      paginas_conteudo: {
        Row: PaginaConteudoRow
        Insert: Pick<PaginaConteudoRow, 'slug' | 'titulo'> &
          Partial<Omit<PaginaConteudoRow, 'id' | 'created_at' | 'updated_at' | 'slug' | 'titulo'>>
        Update: Partial<PaginaConteudoRow>
        Relationships: []
      }
      produtos: {
        Row: ProdutoRow
        Insert: Pick<ProdutoRow, 'nome' | 'formato'> & Partial<Omit<ProdutoRow, 'id' | 'created_at' | 'updated_at' | 'nome' | 'formato'>>
        Update: Partial<ProdutoRow>
        Relationships: []
      }
      adicionais: {
        Row: AdicionalRow
        Insert: Pick<AdicionalRow, 'slug' | 'nome' | 'preco_custo' | 'preco_sugerido'> & Partial<AdicionalRow>
        Update: Partial<AdicionalRow>
        Relationships: []
      }
      adicionais_estudio: {
        Row: AdicionalEstudioRow
        Insert: Pick<AdicionalEstudioRow, 'fotografo_id' | 'adicional_id'> & Partial<AdicionalEstudioRow>
        Update: Partial<AdicionalEstudioRow>
        Relationships: []
      }
      fatura_itens: {
        Row: FaturaItemRow
        Insert: never
        Update: never
        Relationships: []
      }
      notificacoes_crm: {
        Row: NotificacaoCrmRow
        Insert: never
        Update: never
        Relationships: []
      }
      faturas: {
        Row: FaturaRow
        Insert: Pick<FaturaRow, 'projeto_id' | 'valor_total'> &
          Partial<Omit<FaturaRow, 'id' | 'created_at' | 'projeto_id' | 'valor_total'>>
        Update: Partial<FaturaRow>
        Relationships: []
      }
      conversas: {
        Row: ConversaRow
        Insert: never
        Update: never
        Relationships: []
      }
      /** Autor, papel, nome e data são definidos pelo banco (gatilho da 0037). */
      mensagens: {
        Row: MensagemRow
        Insert: Pick<MensagemRow, 'conversa_id' | 'corpo'> & Partial<Pick<MensagemRow, 'autor_id' | 'lamina_id' | 'versao_id'>>
        /** Só exclusão lógica. */
        Update: Pick<MensagemRow, 'apagada_em'>
        Relationships: []
      }
      conversa_leituras: {
        Row: ConversaLeituraRow
        Insert: never
        Update: never
        Relationships: []
      }
      orcamentos: {
        Row: OrcamentoRow
        Insert: Pick<OrcamentoRow, 'fotografo_id' | 'cliente_final_nome'> &
          Partial<Omit<OrcamentoRow, 'id' | 'created_at' | 'updated_at' | 'fotografo_id' | 'cliente_final_nome'>>
        Update: Partial<OrcamentoRow>
        Relationships: []
      }
    }
    Views: {
      /** Centro de controle da diagramação (0038), security_invoker: só a equipe vê linhas. */
      diagramacao_itens: { Row: DiagramacaoItemRow; Relationships: [] }
    }
    Functions: {
      /** Grava o documento do editor se a revisão bater; null = conflito (0027). */
      salvar_album_layout: { Args: { p_id: string; p_documento: unknown; p_revisao: number }; Returns: number | null }
      /** Link de aprovação sem login (0027): tudo exige o token. */
      album_aprovacao_publica: { Args: { p_token: string }; Returns: unknown }
      album_aprovacao_comentar: {
        Args: { p_token: string; p_lamina: number; p_x: number | null; p_y: number | null; p_texto: string; p_autor: string }
        Returns: string
      }
      album_aprovacao_decidir: { Args: { p_token: string; p_decisao: 'aprovado' | 'alteracoes'; p_autor: string; p_mensagem: string | null }; Returns: string }
      /** 0038: KPIs, carga por diagramador e itens mais urgentes — só a equipe. */
      diagramacao_resumo: { Args: { p_urgentes?: number }; Returns: ResumoDiagramacao }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_equipe: { Args: Record<string, never>; Returns: boolean }
      is_gestor_ou_admin: { Args: Record<string, never>; Returns: boolean }
      /** Plano de assinatura ativo do fotógrafo logado, ou null (migration 0013). */
      minha_assinatura: { Args: Record<string, never>; Returns: string | null }
      /** Cadastro com Google (0028): promove o usuário recém-criado a fotógrafo; devolve o papel final. */
      concluir_cadastro_google: { Args: Record<string, never>; Returns: PlatformRole }
      /** Chaves no R2 de rascunhos parados há p_horas que nunca viraram pedido (0031). Só service_role. */
      rascunhos_r2_expirados: { Args: { p_horas?: number; p_limite?: number }; Returns: { r2_key: string }[] }
      /** Reserva a chave de um envio do R2 para quem o pediu, por 24h (0040). Só service_role. */
      reservar_upload_r2: { Args: { p_key: string; p_user_id: string }; Returns: boolean }
      /** Quais destas chaves nenhuma coluna do banco cita (varredura de órfãos, 0040). Só service_role. */
      r2_chaves_sem_referencia: { Args: { p_keys: string[] }; Returns: string[] }
      /** A chave do R2 está em `fotos` (0036)? */
      chave_r2_em_uso_por_projeto: { Args: { p_key: string }; Returns: boolean }
      pode_ver_projeto: { Args: { p_projeto_id: string }; Returns: boolean }
      /** Fase 5 (0023): prévia da cobrança de lâminas extras — fotógrafo dono ou operação. */
      calcular_excedente: {
        Args: { p_projeto_id: string }
        Returns: {
          versao: number
          laminas: number
          tem_capa: boolean
          inclusas: number | null
          excedente: number
          preco: number
          valor: number
        }[]
      }
      /** Checkout simulado das lâminas extras (Stripe congelado) — só o fotógrafo dono. */
      pagar_fatura_simulada: { Args: { p_fatura_id: string; p_forma: FormaPagamentoDb }; Returns: undefined }
      /** Webhook do Stripe (0026b): confirma a fatura paga — só service_role, idempotente. */
      confirmar_pagamento_fatura: { Args: { p_fatura_id: string; p_forma: FormaPagamentoDb }; Returns: undefined }
      /** Checkout real (0035): o banco diz se a fatura pode ser paga e por quanto — só o estúdio dono. */
      preparar_checkout_fatura: {
        Args: { p_fatura_id: string }
        Returns: {
          fatura_id: string
          projeto_id: string
          projeto_nome: string
          projeto_numero: number
          valor_total: number
          stripe_checkout_session_id: string | null
        }[]
      }
      /** Checkout real (0035): guarda a Checkout Session aberta na fatura. */
      registrar_checkout_fatura: { Args: { p_fatura_id: string; p_session_id: string }; Returns: undefined }
      /** 0035: modo de pagamento simulado ligado em private.app_config. */
      pagamento_simulado_ativo: { Args: Record<string, never>; Returns: boolean }
      /** Upsell (0026): ofertas para a tela de aprovação (casal: revenda; estúdio: custo + revenda). */
      ofertas_da_prova: {
        Args: { p_projeto_id: string }
        Returns: {
          adicional_id: string
          nome: string
          descricao: string | null
          imagem_url: string | null
          preco: number
          preco_revenda: number
        }[]
      }
      /** Aprovação + adicionais numa operação só; devolve o status resultante do projeto. */
      aprovar_prova: {
        Args: { p_projeto_id: string; p_versao: number; p_adicionais: { adicional_id: string; quantidade: number }[] }
        Returns: string
      }
      /** O estúdio aceita/recusa um adicional pedido pelo casal. 'liberado' = foi para impressão. */
      decidir_adicional: { Args: { p_item_id: string; p_aceitar: boolean }; Returns: 'pendente' | 'liberado' }
      /** CRM (0024): a gestão roda a detecção na hora / muda o status de um alerta. */
      rodar_alertas_crm: {
        Args: Record<string, never>
        Returns: { novos_sem_pedido_7d: number; novos_assinante_sem_projeto_mes: number; resolvidos_automaticamente: number }
      }
      marcar_alerta_crm: { Args: { p_id: string; p_status: NotificacaoCrmStatus }; Returns: undefined }
      /** Cortesia: admin/gestor dispensa a cobrança e libera para impressão. */
      dispensar_fatura: { Args: { p_fatura_id: string; p_motivo: string }; Returns: undefined }
      /** Mensagens (0037): busca ou cria o fio, conferindo o acesso. */
      abrir_conversa: {
        Args: { p_canal: 'estudio_equipe' | 'cliente_estudio'; p_fotografo_id?: string | null; p_projeto_id?: string | null }
        Returns: string
      }
      marcar_conversa_lida: { Args: { p_conversa_id: string }; Returns: string }
      contar_mensagens_nao_lidas: { Args: Record<string, never>; Returns: { conversa_id: string; nao_lidas: number }[] }
      total_mensagens_nao_lidas: { Args: Record<string, never>; Returns: number }
      listar_conversas: {
        Args: {
          p_canal?: 'estudio_equipe' | 'cliente_estudio' | null
          p_fotografo_id?: string | null
          p_projeto_id?: string | null
          p_somente_nao_lidas?: boolean
          p_limite?: number
        }
        Returns: {
          id: string
          canal: 'estudio_equipe' | 'cliente_estudio'
          fotografo_id: string
          estudio: string
          estudio_logo_url: string | null
          projeto_id: string | null
          projeto_nome: string | null
          projeto_numero: number | null
          cliente_nome: string | null
          ultima_mensagem_em: string | null
          ultima_mensagem_previa: string | null
          nao_lidas: number
          created_at: string
        }[]
      }
      get_orcamento_publico: {
        Args: { p_hash: string }
        Returns: {
          cliente_final_nome: string
          itens_json: OrcamentoRow['itens_json']
          valor_total: number
          estudio: string
          logo_url: string | null
          criado_em: string
        }[]
      }
    }
    Enums: {
      platform_role: PlatformRole
      billing_type: BillingType
      order_status: OrderStatus
      project_status: ProjectStatusDb
      design_version_status: DesignVersionStatusDb
      approval_status: ApprovalStatusDb
      portfolio_status: PortfolioStatusDb
      comunicacao_status: ComunicacaoStatus
      pagina_status: PaginaStatus
      fatura_status: FaturaStatusDb
      forma_pagamento: FormaPagamentoDb
      orcamento_status: OrcamentoStatusDb
    }
    CompositeTypes: Record<never, never>
  }
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendente: 'Pendente',
  na_fila_design: 'Na fila de design',
  em_producao: 'Em produção',
  aguardando_aprovacao: 'Aguardando aprovação',
  em_revisao: 'Em revisão',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}
