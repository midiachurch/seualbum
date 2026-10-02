import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createPublicClient } from '@/lib/supabase/server'
import { DEMO_COOKIE, decodeDemoSession, isDemoMode } from '@/lib/demo-mode'
import { DEMO_ORDERS, DEMO_PLANS } from '@/lib/demo-data'
import { MOCK_ACTIVITY_LOG, MOCK_ALERTS, MOCK_CLIENTS, MOCK_PHOTOGRAPHERS, MOCK_TEAM_MEMBERS } from '@/lib/mock-platform-data'
import { MOCK_PROJECTS } from '@/lib/mock-projects-data'
import {
  mapBanner,
  mapCliente,
  mapFatura,
  mapFotografo,
  mapMediaAsset,
  mapOrcamento,
  mapPortfolioCollection,
  mapProduto,
  mapProjeto,
  mapTeamMember,
} from '@/lib/mappers'
import { MOCK_BANNERS, MOCK_MEDIA_ASSETS, MOCK_PORTFOLIO_COLLECTIONS } from '@/lib/mock-vitrine-data'
import { getSlaInfo } from '@/lib/sla'
import {
  canAccess,
  EQUIPE_ROLES,
  hasPermission,
  rotaDoPapel,
  type Client,
  type Lamina,
  type ModuleKey,
  type PermissionAction,
  type PlatformRole,
  type Photographer,
  type Project,
  type TeamMember,
} from '@/types/platform'
import type {
  AlbumAprovacaoComentarioRow,
  AlbumAprovacaoRow,
  AlbumLayoutRow,
  AlbumLayoutVersaoRow,
  BibliotecaAlbum,
  DerivadoFoto,
  StatusAlbum,
  AprovacaoRow,
  BannerRow,
  ClienteRow,
  DesignVersionRow,
  AdicionalEstudioRow,
  AdicionalRow,
  FaturaItemRow,
  FaturaRow,
  NotificacaoCrmRow,
  FotoRow,
  ProvaComentarioRow,
  VersaoLaminaRow,
  FotografoRow,
  MediaAssetRow,
  OrcamentoRow,
  Order,
  Plan,
  PortfolioCollectionRow,
  PortfolioItemRow,
  ProdutoRow,
  ProjetoAtividadeRow,
  ProjetoRow,
  Profile,
} from '@/types/database'
import type { Banner, Fatura, FaturaItem, MediaAsset, OfertaAdicional, Orcamento, OrcamentoPublico, PortfolioCollection, Produto, ResumoExcedente } from '@/types/platform'

async function getDemoSession() {
  const raw = (await cookies()).get(DEMO_COOKIE)?.value
  return raw ? decodeDemoSession(raw) : null
}

/**
 * O perfil de 5 papéis (admin/gestor/operador/fotografo/cliente) já é o
 * schema real (`profiles.role`) — em modo de demonstração, vem só do cookie.
 */
export async function getPlatformRole(): Promise<PlatformRole | null> {
  if (isDemoMode()) {
    const session = await getDemoSession()
    return session?.role ?? null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (data?.role as PlatformRole | undefined) ?? null
}

/**
 * "Você" na sala de máquinas. Em modo real, o membro de equipe logado É o
 * usuário atual (não precisa procurar por papel como no mock).
 */
export async function getCurrentTeamMember(): Promise<TeamMember | null> {
  const role = await getPlatformRole()
  if (!role || !EQUIPE_ROLES.includes(role)) return null

  if (isDemoMode()) {
    return MOCK_TEAM_MEMBERS.find((m) => m.role === role) ?? null
  }

  const { supabase, user } = await requireUser()
  if (!supabase) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>()
  return data ? mapTeamMember(data) : null
}

/**
 * "Você" no portal do cliente final. Em modo real, busca o registro de
 * `clientes` vinculado a esta conta (`user_id`) — um cliente só tem um.
 */
export async function getCurrentClient(): Promise<Client | null> {
  const role = await getPlatformRole()
  if (role !== 'cliente') return null

  if (isDemoMode()) {
    return MOCK_CLIENTS.find((c) => c.id === 'cli-1') ?? null
  }

  const { supabase, user } = await requireUser()
  if (!supabase) return null
  const { data } = await supabase.from('clientes').select('*').eq('user_id', user.id).single<ClienteRow>()
  return data ? mapCliente(data) : null
}

/**
 * Barreira do portal B2C: precisa estar logado e ter o papel 'cliente' —
 * fotógrafo e equipe têm suas próprias áreas (`/dashboard` e `/admin`).
 */
export async function requireClientPortal() {
  const ctx = await requireUser()
  const role = await getPlatformRole()
  if (role !== 'cliente') redirect(rotaDoPapel(role))
  return ctx
}

/**
 * Sessão + profile do usuário atual. Redireciona se não houver sessão — o
 * middleware já filtra, mas Server Components não devem confiar nisso: uma
 * mudança no `matcher` não pode virar vazamento de dados.
 *
 * Sem projeto Supabase configurado, cai no modo de demonstração: sessão local
 * via cookie e um profile fictício, sem precisar configurar um backend.
 */
export async function requireUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>> | null
  user: { id: string; email?: string }
  profile: Profile | null | undefined
}> {
  if (isDemoMode()) {
    const session = await getDemoSession()
    if (!session) redirect('/auth/login')

    const profile: Profile = {
      id: 'demo-user',
      email: session.email,
      nome_completo: session.nome_estudio,
      telefone: null,
      avatar_url: null,
      role: session.role,
      status: 'ativo',
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    }

    return { supabase: null, user: { id: 'demo-user', email: session.email }, profile }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  return { supabase, user, profile }
}

export async function requireAdmin() {
  const ctx = await requireUser()
  if (!ctx.profile || !EQUIPE_ROLES.includes(ctx.profile.role)) redirect(rotaDoPapel(ctx.profile?.role))
  return ctx
}

/**
 * Segunda camada de autorização dentro do admin: além de ser equipe
 * (admin/gestor/operador), o papel específico precisa ter permissão sobre o
 * módulo (seção 18).
 */
export async function requirePlatformAccess(module: ModuleKey | ModuleKey[]) {
  const ctx = await requireAdmin()
  const role = await getPlatformRole()
  const modulos = Array.isArray(module) ? module : [module]
  // Sem acesso: volta para a casa do papel (designer → /admin/design; os
  // demais → /admin). Nunca para uma rota que ele também não abre (loop).
  if (role && !modulos.some((m) => canAccess(role, m))) redirect(rotaDoPapel(role))
  return { ...ctx, role }
}

/**
 * Igual a `requirePlatformAccess`, mas exige uma ação específica (ex.: só
 * quem tem 'criar' em 'projetos' pode abrir o wizard de novo projeto — o
 * operador tem 'editar' mas não 'criar').
 */
export async function requireModuleAction(
  module: ModuleKey,
  action: PermissionAction,
  redirectTo = '/admin',
) {
  const ctx = await requireAdmin()
  const role = await getPlatformRole()
  if (role && !hasPermission(role, module, action)) redirect(redirectTo === '/admin' ? rotaDoPapel(role) : redirectTo)
  return { ...ctx, role }
}

/**
 * Editar a PRODUÇÃO de um projeto (subir versão, Smart Layout, resolver pins):
 * vale quem edita projetos (equipe de operação) ou quem edita no workspace
 * de design (designer).
 */
export async function requireEdicaoDeProducao() {
  const ctx = await requireAdmin()
  const role = await getPlatformRole()
  if (role && !hasPermission(role, 'projetos', 'editar') && !hasPermission(role, 'design', 'editar')) {
    redirect(rotaDoPapel(role))
  }
  return { ...ctx, role }
}

/**
 * Catálogo público usado pela landing page (policy de SELECT para `anon`).
 * Nunca lança: a home comercial não pode cair porque o banco oscilou — quem
 * chama trata o array vazio caindo para o catálogo estático.
 */
export async function getActivePlans(): Promise<Plan[]> {
  if (isDemoMode()) return DEMO_PLANS

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('planos')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true })

    if (error) throw error
    return (data ?? []) as Plan[]
  } catch (error) {
    console.error('[getActivePlans]', error)
    return []
  }
}

/** Plano de assinatura ativo do estúdio logado (`fotografos.plano_id`), ou null. */
export async function getMinhaAssinaturaId(): Promise<string | null> {
  if (isDemoMode()) return null
  const { supabase } = await requireUser()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('minha_assinatura')
  if (error) {
    console.error('[getMinhaAssinaturaId]', error.message)
    return null
  }
  return data ?? null
}

export type PedidoDoFotografo = Order & {
  planos: { nome_plano: string; tipo_cobranca: string; preco: number } | null
  /** Projeto de produção ligado ao pedido (migration 0017) — fonte do status de produção. */
  projetos: { id: string; status: ProjetoRow['status']; prazo: string | null } | null
}

/**
 * Miniatura de cada álbum: a 1ª lâmina da versão mais recente liberada ao
 * cliente (`aprovada`) — a mesma imagem que abre a prova. Link assinado (1h).
 * Projetos sem prova liberada ficam de fora do mapa.
 */
export async function getCapasDosProjetos(projetoIds: string[]): Promise<Map<string, string>> {
  const capas = new Map<string, string>()
  if (isDemoMode() || projetoIds.length === 0) return capas
  const { supabase } = await requireUser()
  if (!supabase) return capas

  const { data: versoes } = await supabase
    .from('design_versions')
    .select('id, projeto_id, numero')
    .in('projeto_id', projetoIds)
    .eq('status', 'aprovada')
  const ultima = new Map<string, { id: string; numero: number }>()
  for (const v of (versoes ?? []) as { id: string; projeto_id: string; numero: number }[]) {
    const atual = ultima.get(v.projeto_id)
    if (!atual || v.numero > atual.numero) ultima.set(v.projeto_id, { id: v.id, numero: v.numero })
  }
  if (ultima.size === 0) return capas

  const { data: laminas } = await supabase
    .from('versoes_laminas')
    .select('versao_id, bucket, storage_path')
    .in('versao_id', [...ultima.values()].map((v) => v.id))
    .eq('ordem', 1)
  const primeiras = (laminas ?? []) as Pick<VersaoLaminaRow, 'versao_id' | 'bucket' | 'storage_path'>[]
  const assinadas = await assinarArquivos(supabase, primeiras.map((l) => ({ bucket: l.bucket, path: l.storage_path })))
  for (const [projetoId, v] of ultima) {
    const l = primeiras.find((x) => x.versao_id === v.id)
    const url = l && assinadas.get(`${l.bucket}:${l.storage_path}`)
    if (url) capas.set(projetoId, url)
  }
  return capas
}

/** Pedidos do fotógrafo logado, com plano e projeto de produção. RLS já restringe a linha. */
export async function getMyOrders(): Promise<PedidoDoFotografo[]> {
  if (isDemoMode()) {
    await requireUser()
    return DEMO_ORDERS.map((o) => ({ ...o, planos: null, projetos: null }))
  }

  const { supabase, user } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('orders')
    .select('*, planos(nome_plano, tipo_cobranca, preco), projetos(id, status, prazo)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getMyOrders]', error.message)
    return []
  }
  return (data ?? []) as unknown as PedidoDoFotografo[]
}

/** Esteira completa (fluxo legado) — só equipe passa pelo requireAdmin. */
export async function getAllOrders(): Promise<Order[]> {
  if (isDemoMode()) {
    await requireAdmin()
    return DEMO_ORDERS
  }

  const { supabase } = await requireAdmin()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles(nome_completo, telefone), planos(nome_plano)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllOrders]', error.message)
    return []
  }
  return (data ?? []) as Order[]
}

export type OrderDetalhe = Order & {
  profiles: { nome_completo: string; email: string; telefone: string | null } | null
  planos: { nome_plano: string } | null
}

/** Um pedido com fotógrafo e plano — detalhe da esteira (/admin/pedidos/[id]). */
export async function getOrderDetalhe(id: string): Promise<OrderDetalhe | null> {
  if (isDemoMode()) {
    await requireAdmin()
    const order = DEMO_ORDERS.find((o) => o.id === id)
    return order ? { ...order, profiles: null, planos: null } : null
  }

  const { supabase } = await requireAdmin()
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles(nome_completo, email, telefone), planos(nome_plano)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[getOrderDetalhe]', error.message)
    return null
  }
  return (data as OrderDetalhe | null) ?? null
}

export interface ArquivoPedido {
  path: string
  /** Nome sem o prefixo `{uuid}-` que o upload adiciona. */
  nome: string
  tamanho: number
}

/** Pasta das fotos do pedido no bucket `pedidos_fotos` (convenção da migration 0011). */
export function pastaFotosPedido(order: Pick<Order, 'client_id' | 'chave_idempotencia'>) {
  return order.chave_idempotencia ? `${order.client_id}/${order.chave_idempotencia}` : null
}

/**
 * Arquivos enviados pelo wizard. Só lista — as URLs assinadas saem sob demanda
 * em `gerarLinksDownloadAction`, para não expirarem com a aba aberta.
 * `null` = não deu para listar (erro de Storage).
 */
export async function getArquivosPedido(
  order: Pick<Order, 'client_id' | 'chave_idempotencia'>,
): Promise<ArquivoPedido[] | null> {
  const pasta = pastaFotosPedido(order)
  if (isDemoMode() || !pasta) return []

  const { supabase } = await requireAdmin()
  if (!supabase) return []

  const PAGINA = 1000
  const arquivos: ArquivoPedido[] = []
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await supabase.storage
      .from('pedidos_fotos')
      .list(pasta, { limit: PAGINA, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) {
      console.error('[getArquivosPedido]', error.message)
      return null
    }
    for (const item of data) {
      if (item.id === null) continue // subpasta
      arquivos.push({
        path: `${pasta}/${item.name}`,
        nome: item.name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, ''),
        tamanho: Number(item.metadata?.size ?? 0),
      })
    }
    if (data.length < PAGINA) break
  }
  return arquivos
}

/** Clientes visíveis para o usuário atual (RLS: equipe vê todos, fotógrafo só os seus). */
export async function getClients(): Promise<Client[]> {
  if (isDemoMode()) return MOCK_CLIENTS

  const { supabase } = await requireUser()
  if (!supabase) return []
  const [{ data: clientes, error }, { data: projetos }] = await Promise.all([
    supabase.from('clientes').select('*').order('created_at', { ascending: false }),
    supabase.from('projetos').select('cliente_id, created_at'),
  ])

  if (error) {
    console.error('[getClients]', error.message)
    return []
  }

  return ((clientes ?? []) as ClienteRow[]).map((row) => {
    const meus = ((projetos ?? []) as { cliente_id: string; created_at: string }[]).filter(
      (p) => p.cliente_id === row.id,
    )
    const client = mapCliente(row)
    client.projetosCount = meus.length
    client.ultimoProjetoEm = meus.length
      ? meus.reduce((max, p) => (p.created_at > max ? p.created_at : max), meus[0].created_at)
      : null
    return client
  })
}

/** Fotógrafos visíveis para o usuário atual (equipe vê todos; fotógrafo só a si mesmo). */
export async function getPhotographers(): Promise<Photographer[]> {
  if (isDemoMode()) return MOCK_PHOTOGRAPHERS

  const { supabase } = await requireUser()
  if (!supabase) return []
  const [{ data: fotografos, error }, { data: profiles }, { data: clientes }, { data: projetos }] =
    await Promise.all([
      supabase.from('fotografos').select('*'),
      supabase.from('profiles').select('id, email, nome_completo'),
      supabase.from('clientes').select('id, fotografo_id'),
      supabase.from('projetos').select('fotografo_id, status'),
    ])

  if (error) {
    console.error('[getPhotographers]', error.message)
    return []
  }

  const profileById = new Map(((profiles ?? []) as Pick<Profile, 'id' | 'email' | 'nome_completo'>[]).map((p) => [p.id, p]))
  const NAO_ATIVOS = ['finalizado', 'arquivado', 'aprovado', 'aprovado_aguardando_pagamento']

  return ((fotografos ?? []) as FotografoRow[]).map((row) => {
    const photographer = mapFotografo(row, profileById.get(row.id) ?? null)
    photographer.clientesCount = ((clientes ?? []) as { fotografo_id: string }[]).filter(
      (c) => c.fotografo_id === row.id,
    ).length
    const meusProjetos = ((projetos ?? []) as { fotografo_id: string; status: string }[]).filter(
      (p) => p.fotografo_id === row.id,
    )
    photographer.projetosCount = meusProjetos.length
    photographer.projetosAtivos = meusProjetos.filter((p) => !NAO_ATIVOS.includes(p.status)).length
    return photographer
  })
}

/** Membros de equipe (admin/gestor/operador) — só quem tem o módulo 'equipe'. */
export async function getTeamMembers(): Promise<TeamMember[]> {
  if (isDemoMode()) return MOCK_TEAM_MEMBERS

  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', EQUIPE_ROLES)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getTeamMembers]', error.message)
    return []
  }
  return ((data ?? []) as Profile[]).map(mapTeamMember)
}

/** Carrega as tabelas filhas de um lote de projetos e monta o mapa de nomes de autor. */
/**
 * Troca o `url` de cada foto por um link assinado gerado agora, no bucket
 * certo (`fotos.bucket`, migration 0017). Duas razões:
 *   - fotos convertidas de pedido (`pedidos_fotos`) nunca tiveram `url`;
 *   - o `url` gravado no upload nativo é um link assinado de 7 dias — depois
 *     disso a imagem quebrava na tela.
 * A assinatura usa a sessão de quem está vendo, então a policy de leitura de
 * cada bucket continua valendo. Se falhar, fica o `url` antigo.
 */
async function assinarArquivos(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>,
  arquivos: { bucket: string; path: string }[],
  EXPIRACAO_SEGUNDOS = 60 * 60,
): Promise<Map<string, string>> {
  const LOTE = 500
  const assinadas = new Map<string, string>() // `${bucket}:${path}` → url
  if (arquivos.length === 0) return assinadas

  const porBucket = new Map<string, string[]>()
  for (const a of arquivos) porBucket.set(a.bucket, [...(porBucket.get(a.bucket) ?? []), a.path])

  await Promise.all(
    [...porBucket].flatMap(([bucket, paths]) =>
      Array.from({ length: Math.ceil(paths.length / LOTE) }, async (_, i) => {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(paths.slice(i * LOTE, (i + 1) * LOTE), EXPIRACAO_SEGUNDOS)
        if (error) {
          console.error('[assinarArquivos]', bucket, error.message)
          return
        }
        for (const item of data ?? []) {
          if (item.path && item.signedUrl) assinadas.set(`${bucket}:${item.path}`, item.signedUrl)
        }
      }),
    ),
  )
  return assinadas
}

async function assinarFotos(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>,
  fotos: FotoRow[],
): Promise<FotoRow[]> {
  const bucketDe = (f: FotoRow) => f.bucket ?? 'projetos_fotos'
  const urls = await assinarArquivos(supabase, fotos.map((f) => ({ bucket: bucketDe(f), path: f.storage_path })))
  return fotos.map((f) => ({ ...f, url: urls.get(`${bucketDe(f)}:${f.storage_path}`) ?? f.url }))
}

/**
 * Lâminas das versões, em ordem, já com link assinado. A RLS de
 * `versoes_laminas` decide o que volta: fora da equipe, só versão aprovada
 * internamente — rascunho da diagramação não chega ao cliente.
 */
async function carregarLaminas(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>,
  versaoIds: string[],
): Promise<Map<string, Lamina[]>> {
  const porVersao = new Map<string, Lamina[]>()
  if (versaoIds.length === 0) return porVersao

  const { data, error } = await supabase
    .from('versoes_laminas')
    .select('*')
    .in('versao_id', versaoIds)
    .order('ordem', { ascending: true })
  if (error) {
    console.error('[carregarLaminas]', error.message)
    return porVersao
  }
  const linhas = (data ?? []) as VersaoLaminaRow[]
  const urls = await assinarArquivos(supabase, linhas.map((l) => ({ bucket: l.bucket, path: l.storage_path })))
  for (const l of linhas) {
    const lamina: Lamina = { id: l.id, ordem: l.ordem, url: urls.get(`${l.bucket}:${l.storage_path}`) ?? '', largura: l.largura, altura: l.altura, ehCapa: l.eh_capa }
    porVersao.set(l.versao_id, [...(porVersao.get(l.versao_id) ?? []), lamina])
  }
  return porVersao
}

async function hydrateProjetos(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>,
  rows: ProjetoRow[],
): Promise<Project[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const [{ data: fotos }, { data: versions }, { data: aprovacoes }, { data: atividades }, { data: profiles }] =
    await Promise.all([
      supabase.from('fotos').select('*').in('projeto_id', ids),
      supabase.from('design_versions').select('*').in('projeto_id', ids),
      supabase.from('aprovacoes').select('*').in('projeto_id', ids),
      supabase.from('projeto_atividades').select('*').in('projeto_id', ids).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nome_completo'),
    ])

  const autores = new Map(((profiles ?? []) as Pick<Profile, 'id' | 'nome_completo'>[]).map((p) => [p.id, p.nome_completo]))
  const [fotosAssinadas, laminasPorVersao] = await Promise.all([
    assinarFotos(supabase, (fotos ?? []) as FotoRow[]),
    carregarLaminas(supabase, ((versions ?? []) as DesignVersionRow[]).map((v) => v.id)),
  ])

  return rows.map((row) => {
    const projeto = mapProjeto(
      row,
      {
        fotos: fotosAssinadas.filter((f) => f.projeto_id === row.id),
        designVersions: ((versions ?? []) as DesignVersionRow[]).filter((v) => v.projeto_id === row.id),
        approvals: ((aprovacoes ?? []) as AprovacaoRow[]).filter((a) => a.projeto_id === row.id),
        activity: ((atividades ?? []) as ProjetoAtividadeRow[]).filter((a) => a.projeto_id === row.id),
      },
      autores,
    )
    return {
      ...projeto,
      designVersions: projeto.designVersions.map((v) => ({ ...v, laminas: laminasPorVersao.get(v.id) ?? [] })),
    }
  })
}

/** Projetos visíveis para o usuário atual (RLS aplica o escopo — fotógrafo/cliente/equipe). */
export async function getProjects(): Promise<Project[]> {
  if (isDemoMode()) return MOCK_PROJECTS

  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase.from('projetos').select('*').order('created_at', { ascending: false })
  if (error) {
    console.error('[getProjects]', error.message)
    return []
  }
  return hydrateProjetos(supabase, (data ?? []) as ProjetoRow[])
}

/** Caixa de saída de comunicações (outbox) de um projeto — só equipe/fotógrafo, ver RLS. */
export async function getComunicacoesLog(projetoId: string): Promise<import('@/types/platform').ComunicacaoLogEntry[]> {
  if (isDemoMode()) return []

  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('comunicacoes_log')
    .select('*')
    .eq('projeto_id', projetoId)
    .order('data_criacao', { ascending: false })
  if (error) {
    console.error('[getComunicacoesLog]', error.message)
    return []
  }
  return (data ?? []).map((row) => {
    const r = row as { id: string; tipo_evento: string; assunto: string; corpo_html: string; status: 'simulado' | 'enviado' | 'falhou'; data_criacao: string }
    return { id: r.id, tipoEvento: r.tipo_evento, assunto: r.assunto, corpoHtml: r.corpo_html, status: r.status, dataCriacao: r.data_criacao }
  })
}

/**
 * Pins/comentários ainda abertos por projeto e versão (0019) — o que a equipe
 * precisa aplicar. Chave: `${projetoId}:${versao}`.
 */
export async function getApontamentosPendentes(projetoIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  if (isDemoMode() || projetoIds.length === 0) return mapa
  const { supabase } = await requireUser()
  if (!supabase) return mapa
  const { data, error } = await supabase
    .from('prova_comentarios')
    .select('projeto_id, versao')
    .in('projeto_id', projetoIds)
    .eq('resolvido', false)
  if (error) {
    console.error('[getApontamentosPendentes]', error.message)
    return mapa
  }
  for (const r of (data ?? []) as Pick<ProvaComentarioRow, 'projeto_id' | 'versao'>[]) {
    const chave = `${r.projeto_id}:${r.versao}`
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1)
  }
  return mapa
}

/** Comentários da prova digital, de todas as versões — só usado na tela de aprovação do cliente. */
export async function getProofComments(projetoId: string): Promise<import('@/types/platform').ProofComment[]> {
  if (isDemoMode()) {
    const project = MOCK_PROJECTS.find((p) => p.id === projetoId)
    if (!project) return []
    return project.approvals
      .filter((a) => a.status === 'alteracao_solicitada' && a.comentario)
      .map((a) => ({ id: a.id, pageIndex: 0, versao: a.versao, texto: a.comentario as string, autor: a.usuario, data: a.data }))
  }

  const { supabase } = await requireUser()
  if (!supabase) return []
  const [{ data, error }, { data: profiles }] = await Promise.all([
    supabase.from('prova_comentarios').select('*').eq('projeto_id', projetoId).order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, nome_completo'),
  ])
  if (error) {
    console.error('[getProofComments]', error.message)
    return []
  }
  const autores = new Map(((profiles ?? []) as Pick<Profile, 'id' | 'nome_completo'>[]).map((p) => [p.id, p.nome_completo]))
  return ((data ?? []) as ProvaComentarioRow[]).map((r) => ({
    id: r.id,
    pageIndex: r.page_index,
    versao: r.versao,
    texto: r.texto,
    autor: (r.autor_id && autores.get(r.autor_id)) || 'Você',
    data: r.created_at,
    laminaId: r.lamina_id,
    // numeric do Postgres chega como string pelo PostgREST.
    posicaoX: r.posicao_x === null ? null : Number(r.posicao_x),
    posicaoY: r.posicao_y === null ? null : Number(r.posicao_y),
    resolvido: r.resolvido ?? false,
    resolvidoEm: r.resolvido_em ?? null,
  }))
}

export async function getProject(id: string): Promise<Project | null> {
  if (isDemoMode()) return MOCK_PROJECTS.find((p) => p.id === id) ?? null

  const { supabase } = await requireUser()
  if (!supabase) return null
  const { data, error } = await supabase.from('projetos').select('*').eq('id', id).maybeSingle<ProjetoRow>()
  if (error || !data) return null
  const [projeto] = await hydrateProjetos(supabase, [data])
  return projeto ?? null
}

const NAO_ATIVOS_DASHBOARD = ['finalizado', 'arquivado', 'aprovado', 'aprovado_aguardando_pagamento']
const AGUARDANDO_PRODUCAO = ['projeto_criado', 'aguardando_fotos', 'fotos_recebidas', 'aguardando_briefing', 'pronto_para_diagramacao']
const EM_PRODUCAO_STATUSES = ['em_diagramacao', 'em_revisao_interna', 'em_ajustes', 'alteracoes_solicitadas']

export type DashboardMetrics = {
  ativos: number
  aguardandoProducao: number
  emProducao: number
  aguardandoAprovacao: number
  concluidos: number
  atrasados: number
  novosProjetos30d: number
}

/**
 * Métricas do dashboard admin — consulta enxuta (só as colunas de status/SLA/
 * data, sem hidratar fotos/versões/aprovações) porque aqui só precisamos
 * contar, não renderizar os projetos inteiros.
 */
export interface MetricasFinanceiras {
  /** Soma de `valor_pago` dos pedidos com pagamento confirmado (Stripe). */
  faturamento: number
  pedidosPagos: number
  /** faturamento / pedidosPagos; 0 sem pedido pago. */
  ticketMedio: number
  naFilaDesign: number
  /** Pedidos avulsos criados e ainda não pagos. */
  aguardandoPagamento: number
  /** Valor de tabela dos planos desses pedidos — o que entra se todos pagarem. */
  aReceber: number
}

/**
 * Indicadores do fluxo de pedidos (`orders`). Pedidos de assinatura não têm
 * `valor_pago` — a mensalidade é cobrada fora deste fluxo — então faturamento
 * e ticket médio refletem só a venda avulsa.
 */
export async function getMetricasFinanceiras(): Promise<MetricasFinanceiras> {
  type Linha = {
    status: string
    valor_pago: number | string | null
    pago_em: string | null
    planos: { preco: number | string; tipo_cobranca: string } | null
  }

  let linhas: Linha[] = []
  if (isDemoMode()) {
    linhas = DEMO_ORDERS.map((o) => ({ status: o.status, valor_pago: o.valor_pago, pago_em: o.pago_em, planos: null }))
  } else {
    const { supabase } = await requireAdmin()
    if (supabase) {
      const { data, error } = await supabase.from('orders').select('status, valor_pago, pago_em, planos(preco, tipo_cobranca)')
      if (error) console.error('[getMetricasFinanceiras]', error.message)
      linhas = (data ?? []) as unknown as Linha[]
    }
  }

  const pagos = linhas.filter((l) => l.pago_em !== null)
  const faturamento = pagos.reduce((soma, l) => soma + Number(l.valor_pago ?? 0), 0)
  const aguardando = linhas.filter((l) => l.status === 'pendente' && l.planos?.tipo_cobranca !== 'assinatura')

  return {
    faturamento,
    pedidosPagos: pagos.length,
    ticketMedio: pagos.length > 0 ? faturamento / pagos.length : 0,
    naFilaDesign: linhas.filter((l) => l.status === 'na_fila_design').length,
    aguardandoPagamento: aguardando.length,
    aReceber: aguardando.reduce((soma, l) => soma + Number(l.planos?.preco ?? 0), 0),
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const THIRTY_DAYS_MS = 30 * 86_400_000

  const vazio: DashboardMetrics = {
    ativos: 0,
    aguardandoProducao: 0,
    emProducao: 0,
    aguardandoAprovacao: 0,
    concluidos: 0,
    atrasados: 0,
    novosProjetos30d: 0,
  }

  let rows: { status: string; dataLimiteProducao: string; dataLimiteAprovacao: string | null; created_at: string }[] = []

  if (isDemoMode()) {
    rows = MOCK_PROJECTS.map((p) => ({
      status: p.status,
      dataLimiteProducao: p.dataLimiteProducao,
      dataLimiteAprovacao: p.dataLimiteAprovacao,
      created_at: p.createdAt,
    }))
  } else {
    const { supabase } = await requireUser()
    if (!supabase) return vazio
    const { data, error } = await supabase.from('projetos').select('status, data_limite_producao, data_limite_aprovacao, created_at')
    if (error) {
      console.error('[getDashboardMetrics]', error.message)
      return vazio
    }
    rows = ((data ?? []) as { status: string; data_limite_producao: string; data_limite_aprovacao: string | null; created_at: string }[]).map(
      (r) => ({ status: r.status, dataLimiteProducao: r.data_limite_producao, dataLimiteAprovacao: r.data_limite_aprovacao, created_at: r.created_at }),
    )
  }

  const now = Date.now()
  const estaAtrasado = (p: (typeof rows)[number]) => {
    if (NAO_ATIVOS_DASHBOARD.includes(p.status)) return false
    const deadline = p.status === 'aguardando_aprovacao_cliente' && p.dataLimiteAprovacao ? p.dataLimiteAprovacao : p.dataLimiteProducao
    return new Date(deadline).getTime() < now
  }

  return {
    ativos: rows.filter((p) => !NAO_ATIVOS_DASHBOARD.includes(p.status)).length,
    aguardandoProducao: rows.filter((p) => AGUARDANDO_PRODUCAO.includes(p.status)).length,
    emProducao: rows.filter((p) => EM_PRODUCAO_STATUSES.includes(p.status)).length,
    aguardandoAprovacao: rows.filter((p) => p.status === 'aguardando_aprovacao_cliente').length,
    concluidos: rows.filter((p) => ['aprovado', 'finalizado'].includes(p.status)).length,
    atrasados: rows.filter(estaAtrasado).length,
    novosProjetos30d: rows.filter((p) => now - new Date(p.created_at).getTime() < THIRTY_DAYS_MS).length,
  }
}

export type ActivityFeedEntry = { id: string; mensagem: string; projeto: string | null; createdAt: string }

/** As últimas atividades reais de todos os projetos (`projeto_atividades`), com o nome do projeto. */
export async function getRecentActivity(limit = 6): Promise<ActivityFeedEntry[]> {
  if (isDemoMode()) {
    return MOCK_ACTIVITY_LOG.slice(0, limit).map((a) => ({ id: a.id, mensagem: a.mensagem, projeto: null, createdAt: a.createdAt }))
  }

  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('projeto_atividades')
    .select('id, mensagem, created_at, projetos(nome)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[getRecentActivity]', error.message)
    return []
  }
  return ((data ?? []) as unknown as { id: string; mensagem: string; created_at: string; projetos: { nome: string } | null }[]).map(
    (row) => ({ id: row.id, mensagem: row.mensagem, projeto: row.projetos?.nome ?? null, createdAt: row.created_at }),
  )
}

/** Alertas reais: mesmo cálculo de SLA usado no Painel de SLA e nas tags do Kanban. */
export async function getRealAlerts(): Promise<{ id: string; mensagem: string; severidade: 'atencao' | 'urgente' }[]> {
  if (isDemoMode()) return MOCK_ALERTS

  const projects = await getProjects()
  const alerts: { id: string; mensagem: string; severidade: 'atencao' | 'urgente' }[] = []

  for (const p of projects) {
    const sla = getSlaInfo(p)
    if (!sla) continue
    if (sla.tone === 'atrasado') {
      alerts.push({ id: `atraso-${p.id}`, mensagem: `Projeto "${p.nome}" ${sla.label.toLowerCase()}.`, severidade: 'urgente' })
    } else if (sla.tone === 'atencao') {
      alerts.push({ id: `prazo-${p.id}`, mensagem: `Projeto "${p.nome}" — ${sla.label.toLowerCase()}.`, severidade: 'atencao' })
    }
  }
  return alerts.slice(0, 6)
}

/* ------------------------------------------------------------------------ */
/* Vitrine e Biblioteca de Mídia (Fase 5/6) — só admin/gestor gerenciam.      */
/* ------------------------------------------------------------------------ */

export async function getMediaAssets(): Promise<MediaAsset[]> {
  if (isDemoMode()) return MOCK_MEDIA_ASSETS

  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase.from('media_assets').select('*').order('created_at', { ascending: false })
  if (error) {
    console.error('[getMediaAssets]', error.message)
    return []
  }
  return ((data ?? []) as MediaAssetRow[]).map(mapMediaAsset)
}

/** Todos os banners (inclusive inativos) — uso do admin. */
export async function getBanners(): Promise<Banner[]> {
  if (isDemoMode()) return MOCK_BANNERS

  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase.from('banners').select('*').order('ordem', { ascending: true })
  if (error) {
    console.error('[getBanners]', error.message)
    return []
  }
  return ((data ?? []) as BannerRow[]).map(mapBanner)
}

/** Só banners ativos, para o site público — nunca lança (a home não pode cair). */
export async function getPublicBanners(): Promise<Banner[]> {
  if (isDemoMode()) return MOCK_BANNERS.filter((b) => b.ativo)

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase.from('banners').select('*').eq('ativo', true).order('ordem', { ascending: true })
    if (error) throw error
    return ((data ?? []) as BannerRow[]).map(mapBanner)
  } catch (error) {
    console.error('[getPublicBanners]', error)
    return []
  }
}

async function hydrateCollections(collections: PortfolioCollectionRow[], items: PortfolioItemRow[]): Promise<PortfolioCollection[]> {
  return collections.map((c) => mapPortfolioCollection(c, items))
}

/** Todas as coleções (inclusive rascunho) — uso do admin. */
export async function getPortfolioCollections(): Promise<PortfolioCollection[]> {
  if (isDemoMode()) return MOCK_PORTFOLIO_COLLECTIONS

  const { supabase } = await requireUser()
  if (!supabase) return []
  const [{ data: collections, error }, { data: items }] = await Promise.all([
    supabase.from('portfolio_collections').select('*').order('ordem', { ascending: true }),
    supabase.from('portfolio_items').select('*'),
  ])
  if (error) {
    console.error('[getPortfolioCollections]', error.message)
    return []
  }
  return hydrateCollections((collections ?? []) as PortfolioCollectionRow[], (items ?? []) as PortfolioItemRow[])
}

export async function getPortfolioCollection(id: string): Promise<PortfolioCollection | null> {
  if (isDemoMode()) return MOCK_PORTFOLIO_COLLECTIONS.find((c) => c.id === id) ?? null

  const { supabase } = await requireUser()
  if (!supabase) return null
  const [{ data: collection }, { data: items }] = await Promise.all([
    supabase.from('portfolio_collections').select('*').eq('id', id).maybeSingle<PortfolioCollectionRow>(),
    supabase.from('portfolio_items').select('*').eq('collection_id', id),
  ])
  if (!collection) return null
  return mapPortfolioCollection(collection, (items ?? []) as PortfolioItemRow[])
}

/** Só coleções publicadas, para o site público — nunca lança. */
export async function getPublicPortfolioCollections(): Promise<PortfolioCollection[]> {
  if (isDemoMode()) return MOCK_PORTFOLIO_COLLECTIONS.filter((c) => c.status === 'publicado')

  try {
    const supabase = createPublicClient()
    const [{ data: collections, error }, { data: items }] = await Promise.all([
      supabase.from('portfolio_collections').select('*').eq('status', 'publicado').order('ordem', { ascending: true }),
      supabase.from('portfolio_items').select('*'),
    ])
    if (error) throw error
    return hydrateCollections((collections ?? []) as PortfolioCollectionRow[], (items ?? []) as PortfolioItemRow[])
  } catch (error) {
    console.error('[getPublicPortfolioCollections]', error)
    return []
  }
}

/* ------------------------------------------------------------------------ */
/* CMS no-code — páginas dinâmicas do site (só admin/gestor gerenciam)        */
/* ------------------------------------------------------------------------ */

function mapPagina(row: {
  id: string
  slug: string
  titulo: string
  conteudo_html: string
  seo_description: string | null
  status: 'publicado' | 'rascunho'
  created_at: string
  updated_at: string
}): import('@/types/platform').PaginaConteudo {
  return {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
    conteudoHtml: row.conteudo_html,
    seoDescription: row.seo_description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Todas as páginas (inclusive rascunho) — uso do admin. */
export async function getPaginasConteudo(): Promise<import('@/types/platform').PaginaConteudo[]> {
  if (isDemoMode()) return []

  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase.from('paginas_conteudo').select('*').order('updated_at', { ascending: false })
  if (error) {
    console.error('[getPaginasConteudo]', error.message)
    return []
  }
  return (data ?? []).map(mapPagina)
}

/** Só a versão pública/publicada de uma página, pelo slug — usada em `/p/[slug]`. Nunca lança. */
export async function getPublicPagina(slug: string): Promise<import('@/types/platform').PaginaConteudo | null> {
  if (isDemoMode()) return null

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase.from('paginas_conteudo').select('*').eq('slug', slug).eq('status', 'publicado').maybeSingle()
    if (error) throw error
    return data ? mapPagina(data) : null
  } catch (error) {
    console.error('[getPublicPagina]', error)
    return null
  }
}

/** URLs das imagens usadas pelos banners/portfólio públicos, num mapa id -> url. */
export async function getPublicMediaUrlMap(ids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)))
  if (uniq.length === 0) return new Map()
  if (isDemoMode()) return new Map(MOCK_MEDIA_ASSETS.filter((a) => uniq.includes(a.id)).map((a) => [a.id, a.url]))

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase.from('media_assets').select('id, url').in('id', uniq)
    if (error) throw error
    return new Map(((data ?? []) as { id: string; url: string | null }[]).map((r) => [r.id, r.url ?? '']))
  } catch (error) {
    console.error('[getPublicMediaUrlMap]', error)
    return new Map()
  }
}

/* ------------------------------------------------------------------------ */
/* Motor de precificação/upsell — catálogo de produtos e faturas             */
/* ------------------------------------------------------------------------ */

/** Catálogo de produtos com preço — todos (admin) ou só ativos, conforme RLS. */
export async function getProdutos(): Promise<Produto[]> {
  if (isDemoMode()) return []

  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase.from('produtos').select('*').order('ordem', { ascending: true })
  if (error) {
    console.error('[getProdutos]', error.message)
    return []
  }
  return ((data ?? []) as ProdutoRow[]).map(mapProduto)
}

/**
 * Prévia da cobrança de lâminas extras da versão liberada mais recente — o
 * mesmo cálculo que o banco usa ao aprovar (`calcular_excedente`, 0023).
 * Só o fotógrafo dono e a operação conseguem; para os demais devolve null.
 */
export async function getResumoExcedente(projetoId: string): Promise<ResumoExcedente | null> {
  if (isDemoMode()) return null
  const { supabase } = await requireUser()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('calcular_excedente', { p_projeto_id: projetoId })
  if (error) {
    if (error.code !== '42501') console.error('[getResumoExcedente]', error.message)
    return null
  }
  const r = data?.[0]
  if (!r) return null
  return {
    versao: r.versao,
    laminas: r.laminas,
    temCapa: r.tem_capa,
    inclusas: r.inclusas,
    excedente: r.excedente,
    // numeric chega como string pelo PostgREST.
    preco: Number(r.preco),
    valor: Number(r.valor),
  }
}

/**
 * CRM de retenção (0024): alertas em aberto/contatados primeiro, com o
 * contato do fotógrafo para a gestão agir. RLS: só admin e gestor.
 */
export type AlertaCrm = {
  id: string
  tipo: NotificacaoCrmRow['tipo']
  status: NotificacaoCrmRow['status']
  referencia: string
  dados: NotificacaoCrmRow['dados']
  criadaEm: string
  resolvidaEm: string | null
  fotografo: { id: string; estudio: string; nome: string | null; email: string | null; telefone: string | null }
}

export async function getAlertasCrm(): Promise<AlertaCrm[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('notificacoes_crm')
    .select('*')
    .order('criada_em', { ascending: false })
    .limit(200)
  if (error) {
    console.error('[getAlertasCrm]', error.message)
    return []
  }
  const linhas = (data ?? []) as NotificacaoCrmRow[]
  if (linhas.length === 0) return []
  const ids = [...new Set(linhas.map((l) => l.fotografo_id))]
  const [{ data: estudios }, { data: perfis }] = await Promise.all([
    supabase.from('fotografos').select('id, estudio').in('id', ids),
    supabase.from('profiles').select('id, nome_completo, email, telefone').in('id', ids),
  ])
  const ordem: Record<NotificacaoCrmRow['status'], number> = { aberta: 0, contatado: 1, resolvida: 2, dispensada: 3 }
  return linhas
    .map((l) => {
      const e = (estudios ?? []).find((x) => x.id === l.fotografo_id)
      const p = (perfis ?? []).find((x) => x.id === l.fotografo_id)
      return {
        id: l.id,
        tipo: l.tipo,
        status: l.status,
        referencia: l.referencia,
        dados: l.dados ?? {},
        criadaEm: l.criada_em,
        resolvidaEm: l.resolvida_em,
        fotografo: {
          id: l.fotografo_id,
          estudio: e?.estudio ?? 'Estúdio',
          nome: p?.nome_completo ?? null,
          email: p?.email ?? null,
          telefone: p?.telefone ?? null,
        },
      }
    })
    .sort((a, b) => ordem[a.status] - ordem[b.status])
}

/** Itens detalhados das faturas (0026), por fatura. RLS: operação e fotógrafo dono. */
async function carregarItensDasFaturas(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>,
  faturaIds: string[],
): Promise<Map<string, FaturaItem[]>> {
  const mapa = new Map<string, FaturaItem[]>()
  if (faturaIds.length === 0) return mapa
  const { data, error } = await supabase
    .from('fatura_itens')
    .select('*')
    .in('fatura_id', faturaIds)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[carregarItensDasFaturas]', error.message)
    return mapa
  }
  for (const r of (data ?? []) as FaturaItemRow[]) {
    const item: FaturaItem = {
      id: r.id,
      tipo: r.tipo,
      descricao: r.descricao,
      quantidade: r.quantidade,
      valorUnitario: Number(r.valor_unitario),
      valorTotal: Number(r.valor_total),
      precoRevendaUnitario: r.preco_revenda_unitario === null ? null : Number(r.preco_revenda_unitario),
      origem: r.origem,
      situacao: r.situacao,
    }
    mapa.set(r.fatura_id, [...(mapa.get(r.fatura_id) ?? []), item])
  }
  return mapa
}

/**
 * Ofertas de adicionais na aprovação da prova (0026). Casal: só o que o
 * estúdio oferece, pelo preço de revenda. Fotógrafo: tudo, pelo custo.
 */
export async function getOfertasDaProva(projetoId: string): Promise<OfertaAdicional[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase.rpc('ofertas_da_prova', { p_projeto_id: projetoId })
  if (error) {
    if (error.code !== '42501') console.error('[getOfertasDaProva]', error.message)
    return []
  }
  return (data ?? []).map((o) => ({
    id: o.adicional_id,
    nome: o.nome,
    descricao: o.descricao,
    imagemUrl: o.imagem_url,
    preco: Number(o.preco),
    precoRevenda: Number(o.preco_revenda),
  }))
}

/**
 * Catálogo de adicionais do estúdio (0026): o que a Seu Álbum oferece, com o
 * custo, e a configuração do fotógrafo (preço de venda e se oferece ao casal).
 * RLS: o fotógrafo lê o catálogo ativo e só as próprias configurações.
 */
export type ItemCatalogoEstudio = {
  id: string
  nome: string
  descricao: string | null
  imagemUrl: string | null
  custo: number
  sugerido: number
  /** null = usa o sugerido. */
  precoVenda: number | null
  oferecer: boolean
}

export async function getCatalogoDoEstudio(): Promise<ItemCatalogoEstudio[]> {
  if (isDemoMode()) return []
  const { supabase, user } = await requireUser()
  if (!supabase) return []
  const [{ data: itens, error }, { data: config }] = await Promise.all([
    supabase.from('adicionais').select('*').eq('ativo', true).order('ordem', { ascending: true }),
    supabase.from('adicionais_estudio').select('*').eq('fotografo_id', user.id),
  ])
  if (error) {
    console.error('[getCatalogoDoEstudio]', error.message)
    return []
  }
  return ((itens ?? []) as AdicionalRow[]).map((a) => {
    const c = ((config ?? []) as AdicionalEstudioRow[]).find((x) => x.adicional_id === a.id)
    return {
      id: a.id,
      nome: a.nome,
      descricao: a.descricao,
      imagemUrl: a.imagem_url,
      custo: Number(a.preco_custo),
      sugerido: Number(a.preco_sugerido),
      precoVenda: c?.preco_revenda === null || c?.preco_revenda === undefined ? null : Number(c.preco_revenda),
      oferecer: c?.oferecer_ao_cliente ?? true,
    }
  })
}

export type AdicionalAdmin = {
  id: string
  slug: string
  nome: string
  descricao: string | null
  imagemUrl: string | null
  custo: number
  sugerido: number
  ativo: boolean
  ordem: number
  /** Unidades em faturas (itens confirmados). */
  vendidos: number
  /** Estúdios que desligaram o item para os clientes deles. */
  estudiosSemOferta: number
}

/** Catálogo completo de adicionais (inclusive inativos) para a gestão no admin. */
export async function getAdicionaisAdmin(): Promise<AdicionalAdmin[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const [{ data: itens, error }, { data: vendas }, { data: desligados }] = await Promise.all([
    supabase.from('adicionais').select('*').order('ordem', { ascending: true }).order('nome', { ascending: true }),
    supabase.from('fatura_itens').select('adicional_id, quantidade').eq('tipo', 'adicional').eq('situacao', 'confirmado'),
    supabase.from('adicionais_estudio').select('adicional_id').eq('oferecer_ao_cliente', false),
  ])
  if (error) {
    console.error('[getAdicionaisAdmin]', error.message)
    return []
  }
  return ((itens ?? []) as AdicionalRow[]).map((a) => ({
    id: a.id,
    slug: a.slug,
    nome: a.nome,
    descricao: a.descricao,
    imagemUrl: a.imagem_url,
    custo: Number(a.preco_custo),
    sugerido: Number(a.preco_sugerido),
    ativo: a.ativo,
    ordem: a.ordem,
    vendidos: ((vendas ?? []) as { adicional_id: string | null; quantidade: number }[])
      .filter((v) => v.adicional_id === a.id)
      .reduce((soma, v) => soma + v.quantidade, 0),
    estudiosSemOferta: ((desligados ?? []) as { adicional_id: string }[]).filter((d) => d.adicional_id === a.id).length,
  }))
}

/** Adicionais confirmados de cada projeto, para a lista de produção da gráfica. */
export async function getAdicionaisDeProducao(projetoIds: string[]): Promise<Map<string, { descricao: string; quantidade: number }[]>> {
  const mapa = new Map<string, { descricao: string; quantidade: number }[]>()
  if (isDemoMode() || projetoIds.length === 0) return mapa
  const { supabase } = await requireUser()
  if (!supabase) return mapa
  const { data: faturas } = await supabase
    .from('faturas')
    .select('id, projeto_id')
    .in('projeto_id', projetoIds)
    .in('status_pagamento', ['pago', 'dispensada'])
  const itens = await carregarItensDasFaturas(supabase, (faturas ?? []).map((f) => f.id))
  for (const f of faturas ?? []) {
    const adicionais = (itens.get(f.id) ?? [])
      .filter((i) => i.tipo === 'adicional' && i.situacao === 'confirmado')
      .map((i) => ({ descricao: i.descricao, quantidade: i.quantidade }))
    if (adicionais.length > 0) mapa.set(f.projeto_id, [...(mapa.get(f.projeto_id) ?? []), ...adicionais])
  }
  return mapa
}

/** Cobranças de lâminas extras em aberto do fotógrafo logado (RLS: só as dele). */
export type CobrancaPendente = Fatura & { projetoNome: string; projetoNumero: number }

export async function getCobrancasPendentes(): Promise<CobrancaPendente[]> {
  if (isDemoMode()) return []
  const { supabase, user } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('faturas')
    .select('*, projetos!inner(nome, numero, fotografo_id)')
    .eq('status_pagamento', 'pendente')
    .in('tipo', ['laminas_extras', 'fechamento'])
    .eq('projetos.fotografo_id', user.id)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[getCobrancasPendentes]', error.message)
    return []
  }
  const linhas = (data ?? []) as unknown as (FaturaRow & { projetos: { nome: string; numero: number } })[]
  const itens = await carregarItensDasFaturas(supabase, linhas.map((r) => r.id))
  return linhas.map((r) => ({
    ...mapFatura({ ...r, valor_total: Number(r.valor_total) }),
    detalhes: itens.get(r.id) ?? [],
    projetoNome: r.projetos.nome,
    projetoNumero: r.projetos.numero,
  }))
}

/** Faturas de um projeto, mais recente primeiro — painel de cobrança do admin. */
export async function getFaturasDoProjeto(projetoId: string): Promise<Fatura[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('faturas')
    .select('*')
    .eq('projeto_id', projetoId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[getFaturasDoProjeto]', error.message)
    return []
  }
  const linhas = (data ?? []) as FaturaRow[]
  const itens = await carregarItensDasFaturas(supabase, linhas.map((r) => r.id))
  return linhas.map((r) => ({ ...mapFatura({ ...r, valor_total: Number(r.valor_total) }), detalhes: itens.get(r.id) ?? [] }))
}

/** A fatura de upsell pendente de um projeto, se existir — usada na Prova Digital. */
export async function getFaturaPendente(projetoId: string): Promise<Fatura | null> {
  if (isDemoMode()) return null

  const { supabase } = await requireUser()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('faturas')
    .select('*')
    .eq('projeto_id', projetoId)
    .eq('status_pagamento', 'pendente')
    .order('created_at', { ascending: false })
    .maybeSingle()
  if (error) {
    console.error('[getFaturaPendente]', error.message)
    return null
  }
  return data ? mapFatura(data as FaturaRow) : null
}

/* ------------------------------------------------------------------------ */
/* Upgrade B2B — CRM de orçamentos do fotógrafo                             */
/* ------------------------------------------------------------------------ */

/** Orçamentos do fotógrafo logado (RLS já restringe — equipe vê todos). */
export async function getOrcamentos(): Promise<Orcamento[]> {
  if (isDemoMode()) return []

  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase.from('orcamentos').select('*').order('created_at', { ascending: false })
  if (error) {
    console.error('[getOrcamentos]', error.message)
    return []
  }
  return ((data ?? []) as OrcamentoRow[]).map(mapOrcamento)
}

/** Recorte público de um orçamento, pelo hash do link — nunca lança, nunca expõe a tabela inteira. */
export async function getOrcamentoPublico(hash: string): Promise<OrcamentoPublico | null> {
  if (isDemoMode()) return null

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase.rpc('get_orcamento_publico', { p_hash: hash })
    if (error) throw error
    const row = data?.[0]
    if (!row) return null
    return {
      clienteFinalNome: row.cliente_final_nome,
      itens: row.itens_json,
      valorTotal: row.valor_total,
      estudio: row.estudio,
      logoUrl: row.logo_url,
      criadoEm: row.criado_em,
    }
  } catch (error) {
    console.error('[getOrcamentoPublico]', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Editor de álbum (migration 0027)                                            */
/* -------------------------------------------------------------------------- */

/** Uma sessão de diagramação dura horas: o link das fotos precisa durar junto. */
const EXPIRACAO_EDITOR_SEGUNDOS = 8 * 60 * 60

/**
 * Lê todas as linhas de uma consulta em páginas: o PostgREST corta cada
 * resposta em 1000 linhas (max_rows), e um projeto pode ter milhares de fotos.
 */
export async function lerTodasAsLinhas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const TAMANHO = 1000
  const linhas: T[] = []
  for (let de = 0; ; de += TAMANHO) {
    const { data, error } = await pagina(de, de + TAMANHO - 1)
    if (error) return { data: linhas, error }
    linhas.push(...((data ?? []) as T[]))
    if (!data || data.length < TAMANHO) break
  }
  return { data: linhas, error: null }
}

/** Projeto nestes status já foi aprovado: a diagramação fica travada (0027). */
export const STATUS_PROJETO_TRAVADO = ['aprovado_aguardando_pagamento', 'aprovado', 'enviado', 'finalizado', 'arquivado']

export type FotoDoEditor = {
  id: string
  url: string
  nome: string
  largura: number | null
  altura: number | null
  grupo?: string
  capturadaEm?: string | null
  favorita?: boolean
  obrigatoria?: boolean
  estouro?: number | null
  /** Versões leves (miniatura para listas, prévia para o canvas); o `url` é o original. */
  urlMini?: string | null
  urlPreview?: string | null
  fx?: number | null
  fy?: number | null
  pasta?: string | null
  prioridade?: 'principal' | 'secundaria' | 'complementar' | null
  /** Já tem versões leves salvas (não precisa gerar de novo). */
  temDerivados?: boolean
}

export type AlbumParaEditor = {
  id: string
  nome: string
  clienteNome: string | null
  tipo: string | null
  modelo: string | null
  status: StatusAlbum
  pastas: { id: string; nome: string }[]
  formato: string
  orientacao: AlbumLayoutRow['orientacao']
  sangriaMm: number
  margemSeguraMm: number
  documento: unknown
  revisao: number
  fotos: FotoDoEditor[]
  /** Álbum de projeto: publica versão na esteira. Avulso: link de aprovação e ZIP. */
  projeto: { id: string; numero: number; nome: string; laminasInclusas: number | null; status: string } | null
  /** Aprovado/finalizado (ou projeto aprovado): só leitura. */
  travado: boolean
  atualizadoEm: string
}

export type AlbumResumo = {
  id: string
  nome: string
  clienteNome: string | null
  formato: string
  orientacao: AlbumLayoutRow['orientacao']
  laminas: number
  fotos: number
  status: StatusAlbum
  arquivado: boolean
  miniatura: string | null
  projeto: { id: string; numero: number; nome: string; status: string } | null
  criadoEm: string
  atualizadoEm: string
}

export type VersaoDoAlbum = { id: string; tipo: AlbumLayoutVersaoRow['tipo']; rotulo: string | null; criadoEm: string; laminas: number }

export type AprovacaoDoAlbum = {
  id: string
  numero: number
  token: string
  status: AlbumAprovacaoRow['status']
  laminas: AlbumAprovacaoRow['laminas']
  mensagemCliente: string | null
  decididoPorNome: string | null
  decididoEm: string | null
  criadoEm: string
  comentarios: { id: string; laminaIndice: number; x: number | null; y: number | null; texto: string; autor: string; origem: 'cliente' | 'equipe'; resolvido: boolean; criadoEm: string }[]
}

function nomeDoArquivo(path: string) {
  return path.split('/').pop()?.replace(/^[0-9a-f-]{36}-/, '').replace(/^\d{13}-/, '') ?? path
}

/** Fotos de um projeto prontas para o editor (links assinados longos). */
async function fotosDoProjetoParaEditor(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>,
  projetoId: string,
): Promise<FotoDoEditor[]> {
  const { data, error } = await lerTodasAsLinhas<FotoRow>((de, ate) =>
    supabase.from('fotos').select('*').eq('projeto_id', projetoId).order('created_at', { ascending: true }).order('id', { ascending: true }).range(de, ate),
  )
  if (error) {
    console.error('[fotosDoProjetoParaEditor]', error.message)
    return []
  }
  const linhas = data
  const bucketDe = (f: FotoRow) => f.bucket ?? 'projetos_fotos'
  const urls = await assinarArquivos(
    supabase,
    linhas.map((f) => ({ bucket: bucketDe(f), path: f.storage_path })),
    EXPIRACAO_EDITOR_SEGUNDOS,
  )
  return linhas.map((f) => ({
    id: f.id,
    url: urls.get(`${bucketDe(f)}:${f.storage_path}`) ?? f.url ?? '',
    nome: nomeDoArquivo(f.storage_path),
    largura: null,
    altura: null,
    grupo: f.grupo ?? undefined,
    capturadaEm: f.capturada_em,
    favorita: f.favorita,
    obrigatoria: f.obrigatoria,
  }))
}

async function fotosAvulsasParaEditor(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>,
  fotos: AlbumLayoutRow['fotos'],
): Promise<FotoDoEditor[]> {
  const urls = await assinarArquivos(
    supabase,
    fotos.map((f) => ({ bucket: 'albuns_fotos', path: f.path })),
    EXPIRACAO_EDITOR_SEGUNDOS,
  )
  return fotos.map((f) => ({
    id: f.id,
    url: urls.get(`albuns_fotos:${f.path}`) ?? '',
    nome: f.nome,
    largura: f.largura,
    altura: f.altura,
  }))
}

/**
 * Junta às fotos o que o editor já sabe delas: versões leves (assinadas),
 * medidas (dimensões, estouro, foco) e a organização da biblioteca.
 */
async function completarFotos(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>,
  fotos: FotoDoEditor[],
  derivados: Record<string, DerivadoFoto>,
  biblioteca: BibliotecaAlbum,
): Promise<FotoDoEditor[]> {
  const paths = fotos.flatMap((f) => {
    const d = derivados[f.id]
    return d ? [d.mini, d.preview] : []
  })
  const urls = await assinarArquivos(supabase, paths.map((path) => ({ bucket: 'albuns_fotos', path })), EXPIRACAO_EDITOR_SEGUNDOS)
  return fotos.map((f) => {
    const d = derivados[f.id]
    const meta = biblioteca.fotos?.[f.id]
    return {
      ...f,
      largura: d?.largura ?? f.largura,
      altura: d?.altura ?? f.altura,
      estouro: d ? d.estouro : f.estouro,
      fx: d?.fx ?? null,
      fy: d?.fy ?? null,
      urlMini: d ? (urls.get(`albuns_fotos:${d.mini}`) ?? null) : null,
      urlPreview: d ? (urls.get(`albuns_fotos:${d.preview}`) ?? null) : null,
      temDerivados: Boolean(d),
      favorita: meta?.favorita ?? f.favorita,
      prioridade: meta?.prioridade ?? null,
      pasta: meta?.pasta ?? null,
    }
  })
}

/** Fotos atuais do álbum (depois de um upload no editor). */
export async function getFotosDoEditor(layoutId: string): Promise<FotoDoEditor[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data } = await supabase
    .from('album_layouts')
    .select('projeto_id, fotos, derivados, biblioteca')
    .eq('id', layoutId)
    .maybeSingle<Pick<AlbumLayoutRow, 'projeto_id' | 'fotos' | 'derivados' | 'biblioteca'>>()
  if (!data) return []
  const base = data.projeto_id ? await fotosDoProjetoParaEditor(supabase, data.projeto_id) : await fotosAvulsasParaEditor(supabase, data.fotos ?? [])
  return completarFotos(supabase, base, data.derivados ?? {}, data.biblioteca ?? {})
}

export async function getAlbumParaEditor(id: string): Promise<AlbumParaEditor | null> {
  if (isDemoMode()) return null
  const { supabase } = await requireUser()
  if (!supabase) return null
  const { data, error } = await supabase.from('album_layouts').select('*').eq('id', id).maybeSingle<AlbumLayoutRow>()
  if (error || !data) {
    if (error) console.error('[getAlbumParaEditor]', error.message)
    return null
  }

  let projeto: AlbumParaEditor['projeto'] = null
  let fotos: FotoDoEditor[]
  if (data.projeto_id) {
    const { data: p } = await supabase
      .from('projetos')
      .select('id, numero, nome, status, laminas_inclusas')
      .eq('id', data.projeto_id)
      .maybeSingle<Pick<ProjetoRow, 'id' | 'numero' | 'nome' | 'status'> & { laminas_inclusas: number | null }>()
    if (!p) return null
    projeto = { id: p.id, numero: Number(p.numero), nome: p.nome, status: p.status, laminasInclusas: p.laminas_inclusas ?? null }
    fotos = await fotosDoProjetoParaEditor(supabase, data.projeto_id)
  } else {
    fotos = await fotosAvulsasParaEditor(supabase, data.fotos ?? [])
  }
  fotos = await completarFotos(supabase, fotos, data.derivados ?? {}, data.biblioteca ?? {})

  return {
    id: data.id,
    nome: data.nome,
    clienteNome: data.cliente_nome,
    tipo: data.tipo,
    modelo: data.modelo,
    status: data.status,
    pastas: data.biblioteca?.pastas ?? [],
    formato: data.formato,
    orientacao: data.orientacao,
    sangriaMm: Number(data.sangria_mm),
    margemSeguraMm: Number(data.margem_segura_mm),
    documento: data.documento,
    revisao: data.revisao,
    fotos,
    projeto,
    travado: ['aprovado', 'finalizado', 'em_producao'].includes(data.status) || (projeto !== null && STATUS_PROJETO_TRAVADO.includes(projeto.status)),
    atualizadoEm: data.updated_at,
  }
}

/** Id do documento de diagramação de um projeto, se já existir. */
export async function getLayoutIdDoProjeto(projetoId: string): Promise<string | null> {
  if (isDemoMode()) return null
  const { supabase } = await requireUser()
  if (!supabase) return null
  const { data } = await supabase.from('album_layouts').select('id').eq('projeto_id', projetoId).maybeSingle<{ id: string }>()
  return data?.id ?? null
}

/** Todos os álbuns (avulsos e de projeto) para a tela inicial do editor. */
export async function getAlbuns(): Promise<AlbumResumo[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('album_layouts')
    .select('id, nome, cliente_nome, formato, orientacao, laminas_qtd, status, arquivado, miniatura, projeto_id, fotos, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('[getAlbuns]', error.message)
    return []
  }
  type Linha = Pick<
    AlbumLayoutRow,
    'id' | 'nome' | 'cliente_nome' | 'formato' | 'orientacao' | 'laminas_qtd' | 'status' | 'arquivado' | 'miniatura' | 'projeto_id' | 'fotos' | 'created_at' | 'updated_at'
  >
  const linhas = (data ?? []) as Linha[]
  const ids = linhas.map((l) => l.projeto_id).filter((x): x is string => Boolean(x))
  const projetos = new Map<string, { id: string; numero: number; nome: string; status: string }>()
  const fotosPorProjeto = new Map<string, number>()
  if (ids.length > 0) {
    const [{ data: ps }, { data: fs }] = await Promise.all([
      supabase.from('projetos').select('id, numero, nome, status').in('id', ids),
      lerTodasAsLinhas<{ projeto_id: string }>((de, ate) => supabase.from('fotos').select('projeto_id').in('projeto_id', ids).order('id').range(de, ate)),
    ])
    for (const p of (ps ?? []) as { id: string; numero: number; nome: string; status: string }[]) projetos.set(p.id, { ...p, numero: Number(p.numero) })
    for (const f of (fs ?? []) as { projeto_id: string }[]) fotosPorProjeto.set(f.projeto_id, (fotosPorProjeto.get(f.projeto_id) ?? 0) + 1)
  }
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    clienteNome: l.cliente_nome,
    formato: l.formato,
    orientacao: l.orientacao,
    laminas: l.laminas_qtd ?? 0,
    fotos: l.projeto_id ? (fotosPorProjeto.get(l.projeto_id) ?? 0) : Array.isArray(l.fotos) ? l.fotos.length : 0,
    status: l.status,
    arquivado: l.arquivado,
    miniatura: l.miniatura,
    projeto: l.projeto_id ? (projetos.get(l.projeto_id) ?? null) : null,
    criadoEm: l.created_at,
    atualizadoEm: l.updated_at,
  }))
}

export async function getVersoesDoAlbum(layoutId: string): Promise<VersaoDoAlbum[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('album_layout_versoes')
    .select('id, tipo, rotulo, created_at, documento')
    .eq('layout_id', layoutId)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) {
    console.error('[getVersoesDoAlbum]', error.message)
    return []
  }
  return ((data ?? []) as Pick<AlbumLayoutVersaoRow, 'id' | 'tipo' | 'rotulo' | 'created_at' | 'documento'>[]).map((v) => {
    const laminas = (v.documento as { laminas?: unknown[] } | null)?.laminas
    return { id: v.id, tipo: v.tipo, rotulo: v.rotulo, criadoEm: v.created_at, laminas: Array.isArray(laminas) ? laminas.length : 0 }
  })
}

export async function getAprovacoesDoAlbum(layoutId: string): Promise<AprovacaoDoAlbum[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('album_aprovacoes')
    .select('*')
    .eq('layout_id', layoutId)
    .order('numero', { ascending: false })
  if (error) {
    console.error('[getAprovacoesDoAlbum]', error.message)
    return []
  }
  const aprovacoes = (data ?? []) as AlbumAprovacaoRow[]
  const comentarios = new Map<string, AprovacaoDoAlbum['comentarios']>()
  if (aprovacoes.length > 0) {
    const { data: cs } = await supabase
      .from('album_aprovacao_comentarios')
      .select('*')
      .in('aprovacao_id', aprovacoes.map((a) => a.id))
      .order('created_at', { ascending: true })
    for (const c of (cs ?? []) as AlbumAprovacaoComentarioRow[]) {
      comentarios.set(c.aprovacao_id, [
        ...(comentarios.get(c.aprovacao_id) ?? []),
        {
          id: c.id,
          laminaIndice: c.lamina_indice,
          x: c.x === null ? null : Number(c.x),
          y: c.y === null ? null : Number(c.y),
          texto: c.texto,
          autor: c.autor_nome,
          origem: c.origem,
          resolvido: c.resolvido,
          criadoEm: c.created_at,
        },
      ])
    }
  }
  return aprovacoes.map((a) => ({
    id: a.id,
    numero: a.numero,
    token: a.token,
    status: a.status,
    laminas: a.laminas,
    mensagemCliente: a.mensagem_cliente,
    decididoPorNome: a.decidido_por_nome,
    decididoEm: a.decidido_em,
    criadoEm: a.created_at,
    comentarios: comentarios.get(a.id) ?? [],
  }))
}
