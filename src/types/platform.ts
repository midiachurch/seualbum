/**
 * Camada conceitual da plataforma completa (especificação funcional de
 * gestão/diagramação — cliente final, fotógrafo, equipe interna, admin).
 * Vive separada de `database.ts` de propósito: `database.ts` espelha o schema
 * real do Supabase (hoje só `user_role: 'client' | 'admin'`); aqui modelamos
 * os 5 perfis e as entidades novas (Cliente, Fotógrafo, Equipe) enquanto tudo
 * roda em mock — quando o schema real for desenhado, esses tipos migram para lá.
 */

export type PlatformRole = 'admin' | 'gestor' | 'operador' | 'designer' | 'fotografo' | 'cliente'

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  operador: 'Operador',
  designer: 'Designer',
  fotografo: 'Fotógrafo',
  cliente: 'Cliente final',
}

/** Perfis que acessam o ambiente administrativo/operacional (menu lateral). */
export const EQUIPE_ROLES: PlatformRole[] = ['admin', 'gestor', 'operador', 'designer']

/** Quem pode ser responsável (executor) por um projeto na produção. */
export const EXECUTORES_ROLES: PlatformRole[] = ['operador', 'designer']

export type PermissionAction = 'visualizar' | 'criar' | 'editar' | 'excluir' | 'atribuir' | 'aprovar'
export type ModuleKey =
  | 'dashboard'
  | 'clientes'
  | 'fotografos'
  | 'projetos'
  /** Workspace do designer (/admin/design): fila de diagramação, lâminas e pins. */
  | 'design'
  | 'equipe'
  | 'midia'
  | 'vitrine'
  | 'configuracoes'
  /** Caixa de mensagens com os estúdios (/admin/mensagens, migration 0037). */
  | 'mensagens'

export type ModulePermissions = Partial<Record<ModuleKey, PermissionAction[]>>

const ALL: PermissionAction[] = ['visualizar', 'criar', 'editar', 'excluir', 'atribuir', 'aprovar']

/**
 * Matriz de permissões por papel (seção 18 da especificação). Só o admin tem
 * acesso a Equipe e Configurações — o gestor opera o dia a dia sem mexer na
 * estrutura do sistema, e o operador só enxerga o que foi atribuído a ele.
 */
export const ROLE_PERMISSIONS: Record<PlatformRole, ModulePermissions> = {
  admin: {
    dashboard: ALL,
    clientes: ALL,
    fotografos: ALL,
    projetos: ALL,
    design: ALL,
    equipe: ALL,
    midia: ALL,
    vitrine: ALL,
    configuracoes: ALL,
    mensagens: ALL,
  },
  gestor: {
    dashboard: ['visualizar'],
    clientes: ['visualizar', 'criar', 'editar'],
    fotografos: ['visualizar', 'criar', 'editar'],
    // 'aprovar' = aprovação interna da diagramação (seção "Revisão Interna",
    // Fase 3) antes de liberar para o cliente final.
    projetos: ['visualizar', 'criar', 'editar', 'atribuir', 'aprovar'],
    design: ['visualizar', 'editar'],
    equipe: ['visualizar'],
    // Gestor de marketing (seção "Fase 5") — cuida da vitrine e da biblioteca
    // de mídia sem precisar do papel de admin.
    midia: ['visualizar', 'criar', 'editar', 'excluir'],
    vitrine: ['visualizar', 'criar', 'editar', 'excluir'],
    mensagens: ['visualizar', 'criar'],
  },
  operador: {
    dashboard: ['visualizar'],
    projetos: ['visualizar', 'editar'],
    design: ['visualizar', 'editar'],
    mensagens: ['visualizar', 'criar'],
  },
  // Foco total na produção: só a própria fila. Sem dashboard (financeiro),
  // sem clientes/fotógrafos/pedidos — e a RLS confirma (migration 0021).
  // Sobe versões e resolve pins; a aprovação interna continua com o gestor.
  designer: {
    design: ['visualizar', 'editar'],
    // Só os fios dos projetos atribuídos a ele (RLS da 0037).
    mensagens: ['visualizar'],
  },
  fotografo: {},
  cliente: {},
}

/**
 * A "casa" de cada papel — e o único lugar protegido onde ele pode estar:
 * equipe só em /admin, estúdio só em /dashboard, cliente final só em /cliente.
 * Middleware, layouts e login usam esta função, então quem cai na área errada
 * vai direto para a própria, num redirect só (sem ping-pong entre áreas).
 */
export function areaDoPapel(role: PlatformRole | null | undefined): '/admin' | '/dashboard' | '/cliente' | '/' {
  if (!role) return '/'
  if (EQUIPE_ROLES.includes(role)) return '/admin'
  if (role === 'fotografo') return '/dashboard'
  return '/cliente'
}

/**
 * Página inicial do papel, dentro da sua área. Igual à área para todos, menos
 * o designer: a casa dele é a própria fila (ele não vê o dashboard do admin).
 */
export function rotaDoPapel(role: PlatformRole | null | undefined): string {
  if (role === 'designer') return '/admin/design'
  return areaDoPapel(role)
}

export function canAccess(role: PlatformRole, module: ModuleKey) {
  return Boolean(ROLE_PERMISSIONS[role]?.[module]?.length)
}

export function hasPermission(role: PlatformRole, module: ModuleKey, action: PermissionAction) {
  return Boolean(ROLE_PERMISSIONS[role]?.[module]?.includes(action))
}

export type Client = {
  id: string
  nome: string
  email: string
  telefone: string
  cidade: string
  estado: string
  origem: string
  fotografoResponsavelId: string | null
  projetosCount: number
  ultimoProjetoEm: string | null
  status: 'ativo' | 'inativo'
  createdAt: string
  observacoesInternas: string | null
}

export type Photographer = {
  id: string
  nome: string
  estudio: string
  email: string
  telefone: string
  cidade: string
  projetosCount: number
  projetosAtivos: number
  clientesCount: number
  ultimoAcessoEm: string | null
  status: 'ativo' | 'inativo'
  plano: string | null
  createdAt: string
  /** Logo do estúdio, opcional — usado na tela pública de orçamento (seção B2B). */
  logoUrl?: string | null
}

export type TeamMember = {
  id: string
  nome: string
  email: string
  role: PlatformRole
  status: 'ativo' | 'inativo'
  createdAt: string
}

export type ActivityLogEntry = {
  id: string
  mensagem: string
  categoria: 'cliente' | 'fotografo' | 'projeto' | 'aprovacao' | 'equipe'
  createdAt: string
}

export type AlertEntry = {
  id: string
  mensagem: string
  severidade: 'atencao' | 'urgente'
}

/* ------------------------------------------------------------------------ */
/* Fase 2 — Projetos (seções 7-9, 13-15, 22-23 da especificação)             */
/* ------------------------------------------------------------------------ */

/** Fluxo de produção em 13 estágios (seção 8). */
export type ProjectStatus =
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
  /** Aprovado e travado, com lâminas extras a pagar pelo fotógrafo (Fase 5). */
  | 'aprovado_aguardando_pagamento'
  | 'aprovado'
  | 'enviado'
  | 'finalizado'
  | 'arquivado'

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  'projeto_criado',
  'aguardando_fotos',
  'fotos_recebidas',
  'aguardando_briefing',
  'pronto_para_diagramacao',
  'em_diagramacao',
  'em_revisao_interna',
  'aguardando_aprovacao_cliente',
  'alteracoes_solicitadas',
  'em_ajustes',
  'aprovado_aguardando_pagamento',
  'aprovado',
  'enviado',
  'finalizado',
  'arquivado',
]

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  projeto_criado: 'Projeto criado',
  aguardando_fotos: 'Aguardando fotos',
  fotos_recebidas: 'Fotos recebidas',
  aguardando_briefing: 'Aguardando briefing',
  pronto_para_diagramacao: 'Pronto para diagramação',
  em_diagramacao: 'Em diagramação',
  em_revisao_interna: 'Em revisão interna',
  aguardando_aprovacao_cliente: 'Aguardando aprovação do cliente',
  alteracoes_solicitadas: 'Alterações solicitadas',
  em_ajustes: 'Em ajustes',
  aprovado_aguardando_pagamento: 'Aprovado · fechamento pendente',
  aprovado: 'Aprovado para impressão',
  enviado: 'Enviado',
  finalizado: 'Finalizado',
  arquivado: 'Arquivado',
}

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  projeto_criado: 'bg-secondary text-secondary-foreground',
  aguardando_fotos: 'bg-amber-100 text-amber-800',
  fotos_recebidas: 'bg-sky-100 text-sky-800',
  aguardando_briefing: 'bg-amber-100 text-amber-800',
  pronto_para_diagramacao: 'bg-sky-100 text-sky-800',
  em_diagramacao: 'bg-indigo-100 text-indigo-800',
  em_revisao_interna: 'bg-indigo-100 text-indigo-800',
  aguardando_aprovacao_cliente: 'bg-amber-100 text-amber-800',
  alteracoes_solicitadas: 'bg-red-100 text-red-800',
  em_ajustes: 'bg-orange-100 text-orange-800',
  aprovado_aguardando_pagamento: 'bg-amber-100 text-amber-800',
  aprovado: 'bg-emerald-100 text-emerald-800',
  enviado: 'bg-sky-100 text-sky-800',
  finalizado: 'bg-emerald-100 text-emerald-800',
  arquivado: 'bg-secondary text-muted-foreground',
}

export type AlbumTypeValue =
  | 'fotolivro'
  | 'tradicional'
  | 'premium'
  | 'casamento'
  | 'aniversario'
  | 'formatura'
  | 'corporativo'

export type AlbumOrientationValue = 'quadrado' | 'horizontal' | 'vertical'
export type AlbumCoverValue = 'fotografica' | 'tecido' | 'couro' | 'acrilico' | 'personalizada'

export type VisualOption<TValue extends string> = {
  value: TValue
  label: string
  description: string
  image: string
}

export type AlbumConfig = {
  tipo: AlbumTypeValue
  formato: string
  orientacao: AlbumOrientationValue
  capa: AlbumCoverValue
  quantidadePaginas: number
  observacoes: string | null
}

export type Briefing = {
  nomeEvento: string
  tipoEvento: string
  data: string | null
  local: string | null
  quantidadePessoas: string | null
  estiloDesejado: string | null
  preferenciasDiagramacao: string | null
  fotosPrioritarias: string | null
  pessoasQueDevemAparecer: string | null
  momentosImportantes: string | null
  referencias: string | null
  observacoesGerais: string | null
  orientacaoDiagramacao: string | null
}

export type Photo = {
  id: string
  url: string
  grupo: string
  favorita: boolean
  obrigatoria: boolean
  destaque: boolean
  capa: boolean
  observacao: string | null
  /** EXIF lido no upload (migration 0025): relógio da câmera, sem fuso. */
  capturadaEm?: string | null
  camera?: string | null
}

/** Uma página do esboço gerado pelo Smart Layout — a IA do futuro vira só outra fonte disto. */
export type SmartLayoutPagina = { numero: number; fotoIds: string[] }

export type DesignVersion = {
  id: string
  numero: number
  data: string
  responsavelId: string
  arquivo: string
  comentarios: string | null
  status: 'em_producao' | 'enviada' | 'aprovada' | 'rejeitada'
  /** Quantas páginas esta versão tem — usado pro upsell automático de páginas extras. */
  quantidadePaginas?: number | null
  /** Esboço estruturado (seção "Smart Layout") — preenchido só em versões geradas automaticamente. */
  layoutJson?: SmartLayoutPagina[] | null
  automatico?: boolean
  /** Lâminas reais em ordem, com link assinado na hora da leitura (migration 0018). */
  laminas?: Lamina[]
}

export type ApprovalEntry = {
  id: string
  versao: number
  data: string
  usuario: string
  status: 'aprovado' | 'alteracao_solicitada'
  comentario: string | null
}

export type ProjectActivity = {
  id: string
  mensagem: string
  data: string
}

export type Project = {
  id: string
  numero: number
  nome: string
  clientId: string
  fotografoId: string
  responsavelId: string | null
  tipoEvento: string
  dataEvento: string | null
  status: ProjectStatus
  prazo: string
  createdAt: string
  /** SLA interno: prazo para a equipe terminar a diagramação (seção "Gestão de SLA"). */
  dataLimiteProducao: string
  /** SLA do cliente: prazo para aprovar a prova, aberto quando ela é liberada. */
  dataLimiteAprovacao: string | null
  /** Quantas fotos o fotógrafo pediu para esse álbum — usado no alerta "faltam N fotos". */
  metaFotos: number | null
  /** Lâminas cobertas pelo plano (congeladas no pedido). `null` = sem franquia definida. */
  laminasInclusas?: number | null
  precoLaminaExtra?: number | null
  /** Produto do catálogo vinculado (preço base, páginas inclusas, preço da página extra). */
  produtoId?: string | null
  /** Preenchidos só depois que a Gráfica despacha o álbum (seção "Fila de Expedição"). */
  codigoRastreio?: string | null
  enviadoEm?: string | null
  album: AlbumConfig
  briefing: Briefing
  photos: Photo[]
  designVersions: DesignVersion[]
  approvals: ApprovalEntry[]
  activity: ProjectActivity[]
}

/* ------------------------------------------------------------------------ */
/* Fase 4 — Portal do cliente final (seções 10-15, 22-23)                    */
/* ------------------------------------------------------------------------ */

/**
 * O cliente final não vê os 13 estágios internos (isso é jargão de produção)
 * — vê uma jornada de 5 passos. `PROJECT_STATUS_TO_CLIENT_STAGE` traduz um
 * pro outro.
 */
export type ClientStage =
  | 'pedido_criado'
  | 'aguardando_fotos'
  | 'em_diagramacao'
  | 'prova_liberada'
  | 'em_producao_grafica'
  | 'enviado'

export const CLIENT_STAGE_ORDER: ClientStage[] = [
  'pedido_criado',
  'aguardando_fotos',
  'em_diagramacao',
  'prova_liberada',
  'em_producao_grafica',
  'enviado',
]

export const CLIENT_STAGE_LABEL: Record<ClientStage, string> = {
  pedido_criado: 'Pedido criado',
  aguardando_fotos: 'Aguardando fotos',
  em_diagramacao: 'Em diagramação',
  prova_liberada: 'Prova liberada',
  em_producao_grafica: 'Em produção gráfica',
  enviado: 'Enviado',
}

export const CLIENT_STAGE_COLOR: Record<ClientStage, string> = {
  pedido_criado: 'bg-secondary text-secondary-foreground',
  aguardando_fotos: 'bg-amber-100 text-amber-800',
  em_diagramacao: 'bg-indigo-100 text-indigo-800',
  prova_liberada: 'bg-emerald-100 text-emerald-800',
  em_producao_grafica: 'bg-emerald-100 text-emerald-800',
  enviado: 'bg-sky-100 text-sky-800',
}

export const CLIENT_STAGE_DESCRIPTION: Record<ClientStage, string> = {
  pedido_criado: 'Recebemos seu pedido e já estamos organizando tudo.',
  aguardando_fotos: 'Estamos esperando as fotos do seu evento para começar.',
  em_diagramacao: 'Nossa equipe está montando o seu álbum com carinho.',
  prova_liberada: 'Sua prova está pronta — dê uma olhada e aprove quando quiser.',
  em_producao_grafica: 'Aprovado! Seu álbum já está a caminho da gráfica.',
  enviado: 'Seu álbum foi despachado e está a caminho do seu endereço.',
}

export const PROJECT_STATUS_TO_CLIENT_STAGE: Record<ProjectStatus, ClientStage> = {
  projeto_criado: 'pedido_criado',
  aguardando_fotos: 'aguardando_fotos',
  fotos_recebidas: 'em_diagramacao',
  aguardando_briefing: 'em_diagramacao',
  pronto_para_diagramacao: 'em_diagramacao',
  em_diagramacao: 'em_diagramacao',
  em_revisao_interna: 'em_diagramacao',
  aguardando_aprovacao_cliente: 'prova_liberada',
  alteracoes_solicitadas: 'em_diagramacao',
  em_ajustes: 'em_diagramacao',
  // White label: para o cliente final o álbum já está aprovado — a cobrança
  // de lâminas extras é assunto entre o estúdio e a SeuÁlbum.
  aprovado_aguardando_pagamento: 'em_producao_grafica',
  aprovado: 'em_producao_grafica',
  enviado: 'enviado',
  finalizado: 'enviado',
  arquivado: 'enviado',
}

export function clientStageOf(status: ProjectStatus): ClientStage {
  return PROJECT_STATUS_TO_CLIENT_STAGE[status]
}

export function clientProgressPercent(status: ProjectStatus): number {
  const idx = CLIENT_STAGE_ORDER.indexOf(clientStageOf(status))
  return Math.round(((idx + 1) / CLIENT_STAGE_ORDER.length) * 100)
}

/** Comentário do cliente numa lâmina específica da prova digital. */
export type Lamina = {
  id: string
  ordem: number
  url: string
  largura: number | null
  altura: number | null
  /** Capa: aparece na prova, mas não conta na franquia (migration 0023). */
  ehCapa?: boolean
  /** Versão parcial (0032): false = igual à da versão anterior. */
  alterada?: boolean
}

export type ProofComment = {
  id: string
  pageIndex: number
  /** Lâmina real comentada (migration 0018); ausente em comentários antigos. */
  laminaId?: string | null
  /** Pin: posição em % (0–100) da largura/altura da lâmina. */
  posicaoX?: number | null
  posicaoY?: number | null
  /** Área marcada (0032): largura/altura em %, a partir de posicaoX/Y. */
  areaLargura?: number | null
  areaAltura?: number | null
  /** A equipe já tratou este apontamento (migration 0019). */
  resolvido?: boolean
  resolvidoEm?: string | null
  /** A qual versão da diagramação este comentário pertence (seção "Versionamento Visual"). */
  versao: number
  texto: string
  autor: string
  data: string
  /** Quem escreveu (perfil); o painel do cliente destaca os dele. */
  autorId?: string | null
}

/**
 * Checklist do cliente na prova (migration 0039): 'vista' = abriu a lâmina;
 * 'aprovada' = marcou "Esta lâmina está ok". Sem linha = ainda não vista.
 */
export type EstadoRevisaoLamina = 'vista' | 'aprovada'

export type RevisaoLamina = {
  laminaId: string
  versao: number
  estado: EstadoRevisaoLamina
}

/** Nome e logo do estúdio (white label) no portal do cliente (0039). */
export type MarcaEstudio = {
  fotografoId: string
  estudio: string
  logoUrl: string | null
}

/* ------------------------------------------------------------------------ */
/* Motor de comunicação — outbox (seção "Motor de Comunicação e Auditoria")   */
/* ------------------------------------------------------------------------ */

export type ComunicacaoLogEntry = {
  id: string
  tipoEvento: string
  assunto: string
  corpoHtml: string
  status: 'simulado' | 'enviado' | 'falhou'
  dataCriacao: string
}

/* ------------------------------------------------------------------------ */
/* CMS no-code — páginas dinâmicas do site (seção "CMS No-Code Avançado")    */
/* ------------------------------------------------------------------------ */

export type PaginaConteudo = {
  id: string
  slug: string
  titulo: string
  conteudoHtml: string
  seoDescription: string | null
  status: 'publicado' | 'rascunho'
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------------ */
/* Fase 5 — Vitrine e Biblioteca de Mídia (seções 19-20)                     */
/* ------------------------------------------------------------------------ */

export type MediaTag = 'Referências' | 'Banners' | 'Capas' | 'Portfólio' | 'Geral'

export const MEDIA_TAGS: MediaTag[] = ['Referências', 'Banners', 'Capas', 'Portfólio', 'Geral']

export type MediaAsset = {
  id: string
  url: string
  nome: string
  tags: MediaTag[]
  larguraPx: number
  alturaPx: number
  tamanhoKb: number
  criadoEm: string
}

export type Banner = {
  id: string
  imagemId: string
  titulo: string
  subtitulo: string
  linkCta: string
  ativo: boolean
  ordem: number
}

export type PortfolioItem = {
  id: string
  imagemId: string
  legenda: string | null
}

export type PortfolioCollection = {
  id: string
  nome: string
  descricao: string
  capaImagemId: string | null
  status: 'publicado' | 'rascunho'
  ordem: number
  itens: PortfolioItem[]
}

/* ------------------------------------------------------------------------ */
/* Motor de precificação/upsell + expedição física                          */
/* ------------------------------------------------------------------------ */

export type Produto = {
  id: string
  nome: string
  formato: string
  descricao: string | null
  imagemUrl: string | null
  precoBase: number
  paginasInclusas: number
  precoPaginaExtra: number
  ativo: boolean
  ordem: number
}

export type ItemFatura = { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }

export type Fatura = {
  id: string
  projetoId: string
  valorTotal: number
  itens: ItemFatura[]
  statusPagamento: 'pendente' | 'pago' | 'cancelado' | 'dispensada'
  formaPagamento: 'cartao' | 'pix' | null
  criadaEm: string
  pagaEm: string | null
  laminasVersao: number | null
  laminasInclusas: number | null
  dispensadaMotivo: string | null
  dispensadaEm: string | null
  /** Itens detalhados (0026) — lâminas extras e adicionais, com origem e situação. */
  detalhes?: FaturaItem[]
}

/** Adicional oferecido na aprovação (0026). `preco` = revenda (casal) ou custo (estúdio). */
export type OfertaAdicional = {
  id: string
  nome: string
  descricao: string | null
  imagemUrl: string | null
  preco: number
  precoRevenda: number
}

export type ItemEscolhido = { adicionalId: string; quantidade: number }

export type FaturaItem = {
  id: string
  tipo: 'laminas_extras' | 'paginas_extras' | 'adicional'
  descricao: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  precoRevendaUnitario: number | null
  origem: 'sistema' | 'cliente' | 'fotografo'
  situacao: 'confirmado' | 'aguardando_estudio' | 'removido'
}

/**
 * Lâminas da versão aprovada contra a franquia do plano (função de banco
 * `calcular_excedente`, migration 0023). Só o fotógrafo dono e a operação
 * enxergam — o cliente final nunca vê valores.
 */
export type ResumoExcedente = {
  versao: number
  laminas: number
  temCapa: boolean
  inclusas: number | null
  excedente: number
  preco: number
  valor: number
}

/* ------------------------------------------------------------------------ */
/* Upgrade B2B — CRM de orçamentos do fotógrafo                             */
/* ------------------------------------------------------------------------ */

export type ItemOrcamento = { produtoId: string | null; descricao: string; quantidade: number; valorUnitario: number }

export type Orcamento = {
  id: string
  fotografoId: string
  clienteFinalNome: string
  clienteFinalContato: string | null
  itens: ItemOrcamento[]
  valorTotal: number
  hashPublico: string
  status: 'rascunho' | 'enviado'
  createdAt: string
}

/** Recorte público de um orçamento (via link de WhatsApp) — nunca a linha inteira. */
export type OrcamentoPublico = {
  clienteFinalNome: string
  itens: ItemOrcamento[]
  valorTotal: number
  estudio: string
  logoUrl: string | null
  criadoEm: string
}
