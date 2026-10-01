/**
 * Converte linhas do banco (snake_case, `types/database.ts`) para os tipos de
 * domínio da UI (camelCase, `types/platform.ts`) já consumidos por todos os
 * componentes das Fases 1-5. Isolar o mapeamento aqui significa que nenhuma
 * tela precisou mudar ao trocar os dados mockados pelos reais — só a origem
 * dos dados, em `lib/supabase/queries.ts`.
 */
import type {
  AprovacaoRow,
  BannerRow,
  ClienteRow,
  DesignVersionRow,
  FaturaRow,
  FotoRow,
  FotografoRow,
  MediaAssetRow,
  OrcamentoRow,
  PortfolioCollectionRow,
  PortfolioItemRow,
  ProdutoRow,
  ProjetoAtividadeRow,
  ProjetoRow,
  Profile,
  ProvaComentarioRow,
} from '@/types/database'
import type {
  AlbumConfig,
  ApprovalEntry,
  Banner,
  Briefing,
  Client,
  DesignVersion,
  Fatura,
  MediaAsset,
  MediaTag,
  Orcamento,
  Photo,
  Photographer,
  PortfolioCollection,
  PortfolioItem,
  Produto,
  Project,
  ProjectActivity,
  ProofComment,
  TeamMember,
} from '@/types/platform'

const EMPTY_ALBUM: AlbumConfig = {
  tipo: 'tradicional',
  formato: '20x20',
  orientacao: 'quadrado',
  capa: 'fotografica',
  quantidadePaginas: 20,
  observacoes: null,
}

const EMPTY_BRIEFING: Briefing = {
  nomeEvento: '',
  tipoEvento: '',
  data: null,
  local: null,
  quantidadePessoas: null,
  estiloDesejado: null,
  preferenciasDiagramacao: null,
  fotosPrioritarias: null,
  pessoasQueDevemAparecer: null,
  momentosImportantes: null,
  referencias: null,
  observacoesGerais: null,
  orientacaoDiagramacao: null,
}

export function mapCliente(row: ClienteRow): Client {
  return {
    id: row.id,
    nome: row.nome,
    // Cliente criado a partir de um pedido pode não ter e-mail (migration 0017).
    email: row.email ?? '',
    telefone: row.telefone ?? '',
    cidade: row.cidade ?? '',
    estado: row.estado ?? '',
    origem: row.origem ?? '',
    fotografoResponsavelId: row.fotografo_id,
    projetosCount: 0,
    ultimoProjetoEm: null,
    status: row.status,
    createdAt: row.created_at,
    observacoesInternas: row.observacoes_internas,
  }
}

export function mapFotografo(row: FotografoRow, profile: Pick<Profile, 'email' | 'nome_completo'> | null): Photographer {
  return {
    id: row.id,
    nome: profile?.nome_completo ?? row.estudio,
    estudio: row.estudio,
    email: profile?.email ?? '',
    telefone: '',
    cidade: row.cidade ?? '',
    projetosCount: 0,
    projetosAtivos: 0,
    clientesCount: 0,
    ultimoAcessoEm: null,
    status: row.status,
    plano: null,
    createdAt: row.created_at,
    logoUrl: row.logo_url,
  }
}

export function mapTeamMember(row: Profile): TeamMember {
  return {
    id: row.id,
    nome: row.nome_completo,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function mapPhoto(row: FotoRow): Photo {
  return {
    id: row.id,
    url: row.url ?? '',
    grupo: row.grupo ?? '',
    favorita: row.favorita,
    obrigatoria: row.obrigatoria,
    destaque: row.destaque,
    capa: row.capa,
    observacao: row.observacao,
    capturadaEm: row.capturada_em ?? null,
    camera: row.camera ?? null,
  }
}

export function mapDesignVersion(row: DesignVersionRow, autores: Map<string, string>): DesignVersion {
  return {
    id: row.id,
    numero: row.numero,
    data: row.created_at,
    responsavelId: row.responsavel_id ?? '',
    arquivo: row.arquivo_url ?? '',
    comentarios: row.comentarios,
    status: row.status,
    quantidadePaginas: row.quantidade_paginas,
    layoutJson: row.layout_json,
    automatico: row.gerado_automaticamente,
  }
}

export function mapApproval(row: AprovacaoRow, autores: Map<string, string>): ApprovalEntry {
  return {
    id: row.id,
    versao: row.versao,
    data: row.created_at,
    usuario: (row.usuario_id && autores.get(row.usuario_id)) || 'Cliente',
    status: row.status,
    comentario: row.comentario,
  }
}

export function mapActivity(row: ProjetoAtividadeRow): ProjectActivity {
  return { id: row.id, mensagem: row.mensagem, data: row.created_at }
}

export function mapProofComment(row: ProvaComentarioRow, autores: Map<string, string>): ProofComment {
  return {
    id: row.id,
    pageIndex: row.page_index,
    versao: row.versao,
    texto: row.texto,
    autor: (row.autor_id && autores.get(row.autor_id)) || 'Você',
    data: row.created_at,
  }
}

export function mapMediaAsset(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    url: row.url ?? '',
    nome: row.nome,
    tags: (row.tags as MediaTag[]) ?? [],
    larguraPx: row.largura_px ?? 0,
    alturaPx: row.altura_px ?? 0,
    tamanhoKb: row.tamanho_kb ?? 0,
    criadoEm: row.created_at,
  }
}

export function mapBanner(row: BannerRow): Banner {
  return {
    id: row.id,
    imagemId: row.imagem_id ?? '',
    titulo: row.titulo,
    subtitulo: row.subtitulo ?? '',
    linkCta: row.link_cta ?? '',
    ativo: row.ativo,
    ordem: row.ordem,
  }
}

export function mapPortfolioCollection(row: PortfolioCollectionRow, items: PortfolioItemRow[]): PortfolioCollection {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao ?? '',
    capaImagemId: row.capa_imagem_id,
    status: row.status,
    ordem: row.ordem,
    itens: items
      .filter((i) => i.collection_id === row.id)
      .sort((a, b) => a.ordem - b.ordem)
      .map(
        (i): PortfolioItem => ({
          id: i.id,
          imagemId: i.imagem_id,
          legenda: i.legenda,
        }),
      ),
  }
}

export function mapProduto(row: ProdutoRow): Produto {
  return {
    id: row.id,
    nome: row.nome,
    formato: row.formato,
    descricao: row.descricao,
    imagemUrl: row.imagem_url,
    precoBase: row.preco_base,
    paginasInclusas: row.paginas_inclusas,
    precoPaginaExtra: row.preco_pagina_extra,
    ativo: row.ativo,
    ordem: row.ordem,
  }
}

export function mapFatura(row: FaturaRow): Fatura {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    valorTotal: row.valor_total,
    itens: row.itens_json,
    statusPagamento: row.status_pagamento,
    formaPagamento: row.forma_pagamento,
    criadaEm: row.created_at,
    pagaEm: row.pago_em,
    laminasVersao: row.laminas_versao ?? null,
    laminasInclusas: row.laminas_inclusas ?? null,
    dispensadaMotivo: row.dispensada_motivo ?? null,
    dispensadaEm: row.dispensada_em ?? null,
  }
}

export function mapOrcamento(row: OrcamentoRow): Orcamento {
  return {
    id: row.id,
    fotografoId: row.fotografo_id,
    clienteFinalNome: row.cliente_final_nome,
    clienteFinalContato: row.cliente_final_contato,
    itens: row.itens_json,
    valorTotal: row.valor_total,
    hashPublico: row.hash_publico,
    status: row.status,
    createdAt: row.created_at,
  }
}

/** Junta o projeto com todas as suas tabelas filhas já carregadas separadamente. */
export function mapProjeto(
  row: ProjetoRow,
  children: {
    fotos: FotoRow[]
    designVersions: DesignVersionRow[]
    approvals: AprovacaoRow[]
    activity: ProjetoAtividadeRow[]
  },
  autores: Map<string, string>,
): Project {
  return {
    id: row.id,
    numero: row.numero,
    nome: row.nome,
    clientId: row.cliente_id,
    fotografoId: row.fotografo_id,
    responsavelId: row.responsavel_id,
    tipoEvento: row.tipo_evento ?? '',
    dataEvento: row.data_evento,
    status: row.status,
    prazo: row.prazo ?? row.data_limite_producao,
    createdAt: row.created_at,
    dataLimiteProducao: row.data_limite_producao,
    dataLimiteAprovacao: row.data_limite_aprovacao,
    produtoId: row.produto_id,
    codigoRastreio: row.codigo_rastreio,
    enviadoEm: row.enviado_em,
    metaFotos: row.meta_fotos,
    laminasInclusas: row.laminas_inclusas ?? null,
    precoLaminaExtra: row.preco_lamina_extra === null || row.preco_lamina_extra === undefined ? null : Number(row.preco_lamina_extra),
    album: { ...EMPTY_ALBUM, ...row.album_config },
    briefing: { ...EMPTY_BRIEFING, ...row.briefing },
    photos: children.fotos.map(mapPhoto),
    designVersions: children.designVersions.map((v) => mapDesignVersion(v, autores)),
    approvals: children.approvals.map((a) => mapApproval(a, autores)),
    activity: children.activity.map(mapActivity),
  }
}
