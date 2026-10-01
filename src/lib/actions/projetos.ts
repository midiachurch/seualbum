'use server'

import { revalidatePath } from 'next/cache'
import { requireClientPortal, requireEdicaoDeProducao, requireModuleAction, requireUser } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'
import { mapPhoto } from '@/lib/mappers'
import { generateSmartLayout } from '@/lib/smart-layout'
import { colunasDoApontamento, type Apontamento } from '@/lib/apontamento'
import { normalizarAdicionais } from '@/lib/adicionais'
import type { AlbumConfig, Briefing, ItemEscolhido, ProjectStatus } from '@/types/platform'
import type { FotoRow } from '@/types/database'

/**
 * Server Actions que substituem as simulações de estado local das Fases 2-4.
 * Só são chamadas pelos componentes de cliente quando `!DEMO_MODE` (ver cada
 * componente) — em modo de demonstração o comportamento anterior (useState
 * local, sem persistência) continua intacto.
 */

function assertRealMode() {
  if (isDemoMode()) throw new Error('Ação indisponível em modo de demonstração.')
}

/**
 * Aprovar ou pedir ajustes só vale com a prova de fato liberada. Sem isso, dava
 * para aprovar uma versão antiga enquanto a equipe preparava a próxima.
 */
async function exigirProvaAguardandoDecisao(
  supabase: NonNullable<Awaited<ReturnType<typeof requireClientPortal>>['supabase']>,
  projetoId: string,
) {
  const { data } = await supabase.from('projetos').select('status').eq('id', projetoId).maybeSingle()
  if (data?.status !== 'aguardando_aprovacao_cliente') {
    throw new Error('A prova não está aguardando aprovação no momento.')
  }
}

export async function createProjeto(input: {
  modoCliente: 'existente' | 'novo'
  clientId: string
  novoClienteNome: string
  novoClienteEmail: string
  fotografoId: string
  nomeProjeto: string
  tipoEvento: string
  dataEvento: string
  album: AlbumConfig
  briefing: Briefing
}): Promise<{ id: string; numero: number }> {
  assertRealMode()
  const { supabase } = await requireModuleAction('projetos', 'criar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  let clienteId = input.clientId
  if (input.modoCliente === 'novo') {
    const { data: novoCliente, error: clienteError } = await supabase
      .from('clientes')
      .insert({
        fotografo_id: input.fotografoId,
        nome: input.novoClienteNome,
        email: input.novoClienteEmail,
        status: 'ativo',
      })
      .select('id')
      .single()
    if (clienteError || !novoCliente) throw new Error(clienteError?.message ?? 'Não foi possível criar o cliente.')
    clienteId = novoCliente.id
  }

  const { data: projeto, error } = await supabase
    .from('projetos')
    .insert({
      nome: input.nomeProjeto,
      cliente_id: clienteId,
      fotografo_id: input.fotografoId,
      tipo_evento: input.tipoEvento || null,
      data_evento: input.dataEvento || null,
      status: 'projeto_criado',
      album_config: input.album,
      briefing: input.briefing,
    })
    .select('id, numero')
    .single()
  if (error || !projeto) throw new Error(error?.message ?? 'Não foi possível criar o projeto.')

  await supabase.from('projeto_atividades').insert({ projeto_id: projeto.id, mensagem: 'Projeto criado.' })

  revalidatePath('/admin/projetos')
  revalidatePath('/admin/producao')
  return projeto
}

async function logActivity(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>,
  projetoId: string,
  mensagem: string,
) {
  await supabase.from('projeto_atividades').insert({ projeto_id: projetoId, mensagem })
}

export async function updateProjetoStatus(projetoId: string, status: ProjectStatus, label: string) {
  assertRealMode()
  const { supabase } = await requireModuleAction('projetos', 'editar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('projetos').update({ status }).eq('id', projetoId)
  if (error) throw new Error(error.message)
  await logActivity(supabase, projetoId, `Status alterado para "${label}".`)

  revalidatePath(`/admin/projetos/${projetoId}`)
  revalidatePath('/admin/producao')
}

export async function assignProjeto(projetoId: string, responsavelId: string | null, nomeResponsavel: string | null) {
  assertRealMode()
  const { supabase } = await requireModuleAction('projetos', 'atribuir')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('projetos').update({ responsavel_id: responsavelId }).eq('id', projetoId)
  if (error) throw new Error(error.message)
  await logActivity(supabase, projetoId, responsavelId ? `Atribuído a ${nomeResponsavel}.` : 'Atribuição removida.')

  revalidatePath(`/admin/projetos/${projetoId}`)
  revalidatePath('/admin/producao')
}

export async function addDesignVersion(projetoId: string, arquivoUrl: string, comentarios: string | null) {
  assertRealMode()
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { count } = await supabase
    .from('design_versions')
    .select('id', { count: 'exact', head: true })
    .eq('projeto_id', projetoId)

  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('design_versions').insert({
    projeto_id: projetoId,
    numero: (count ?? 0) + 1,
    responsavel_id: userData.user?.id ?? null,
    arquivo_url: arquivoUrl,
    comentarios,
    status: 'enviada',
  })
  if (error) throw new Error(error.message)

  await supabase.from('projetos').update({ status: 'em_revisao_interna' }).eq('id', projetoId)
  await logActivity(supabase, projetoId, `Nova versão enviada para revisão interna (v${(count ?? 0) + 1}).`)

  revalidatePath(`/admin/projetos/${projetoId}`)
}

/**
 * Smart Layout (seção "Preparando para IA"): gera um esboço de diagramação
 * automático a partir das fotos já enviadas pelo cliente, sem depender de
 * design manual. Mesma trilha de uma versão normal (revisão interna) — só
 * muda a origem dos dados, `gerado_automaticamente = true`.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LAMINAS = 300

export interface LaminaEnviada {
  storagePath: string
  ordem: number
  largura: number | null
  altura: number | null
}

/**
 * Upload em massa de lâminas (migration 0018). As imagens já subiram do
 * navegador para `projetos_fotos/{projetoId}/versoes/{lote}/`; aqui a versão
 * nasce e as lâminas são registradas em ordem.
 *
 * O navegador só informa caminhos — cada um é conferido contra o que existe
 * de fato na pasta do lote, então não dá para "registrar" arquivo alheio.
 * Se gravar as lâminas falhar, a versão é desfeita (não fica versão vazia).
 */
export async function criarVersaoComLaminas(input: {
  projetoId: string
  lote: string
  laminas: LaminaEnviada[]
  comentarios: string | null
  /** A lâmina de ordem 1 é a capa — não conta na franquia (migration 0023). */
  primeiraEhCapa?: boolean
}): Promise<{ versaoId: string; numero: number }> {
  assertRealMode()
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { projetoId, lote, laminas } = input
  if (!UUID_RE.test(projetoId) || !UUID_RE.test(lote)) throw new Error('Envio inválido.')
  if (!Array.isArray(laminas) || laminas.length === 0) throw new Error('Envie pelo menos uma lâmina.')
  if (laminas.length > MAX_LAMINAS) throw new Error(`No máximo ${MAX_LAMINAS} lâminas por versão.`)

  const pasta = `${projetoId}/versoes/${lote}`
  const ordens = laminas.map((l) => l.ordem).sort((a, b) => a - b)
  if (ordens.some((o, i) => o !== i + 1)) throw new Error('Ordem das lâminas inválida.')
  const dimensaoOk = (v: number | null) => v === null || (Number.isInteger(v) && v > 0 && v < 100_000)
  for (const l of laminas) {
    const nome = typeof l.storagePath === 'string' ? l.storagePath.slice(pasta.length + 1) : ''
    if (!l.storagePath?.startsWith(`${pasta}/`) || !nome || nome.includes('/') || nome.includes('..')) {
      throw new Error('Arquivo fora da pasta deste envio.')
    }
    if (!dimensaoOk(l.largura) || !dimensaoOk(l.altura)) throw new Error('Dimensões de lâmina inválidas.')
  }

  const { data: noStorage, error: listError } = await supabase.storage
    .from('projetos_fotos')
    .list(pasta, { limit: MAX_LAMINAS + 1 })
  if (listError) throw new Error('Não foi possível conferir os arquivos enviados.')
  const existentes = new Set((noStorage ?? []).filter((o) => o.id !== null).map((o) => `${pasta}/${o.name}`))
  const faltando = laminas.filter((l) => !existentes.has(l.storagePath)).length
  if (faltando > 0) throw new Error(`${faltando} lâmina(s) não chegaram ao Storage. Envie de novo.`)

  const { data: userData } = await supabase.auth.getUser()

  // `numero` é único por projeto; se duas versões nascerem juntas, tenta de novo.
  let versao: { id: string; numero: number } | null = null
  for (let tentativa = 0; tentativa < 2 && !versao; tentativa++) {
    const { data: ultima } = await supabase
      .from('design_versions')
      .select('numero')
      .eq('projeto_id', projetoId)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()
    const numero = (ultima?.numero ?? 0) + 1
    const { data, error } = await supabase
      .from('design_versions')
      .insert({
        projeto_id: projetoId,
        numero,
        responsavel_id: userData.user?.id ?? null,
        comentarios: input.comentarios?.trim().slice(0, 2000) || null,
        status: 'enviada',
      })
      .select('id, numero')
      .single()
    if (data) versao = data
    else if (error?.code !== '23505') throw new Error(error?.message ?? 'Não foi possível criar a versão.')
  }
  if (!versao) throw new Error('Não foi possível numerar a versão. Tente de novo.')

  const { error: laminasError } = await supabase.from('versoes_laminas').insert(
    laminas.map((l) => ({
      versao_id: versao.id,
      ordem: l.ordem,
      storage_path: l.storagePath,
      largura: l.largura,
      altura: l.altura,
      eh_capa: Boolean(input.primeiraEhCapa) && l.ordem === 1,
    })),
  )
  if (laminasError) {
    await supabase.from('design_versions').delete().eq('id', versao.id)
    throw new Error(`Não foi possível registrar as lâminas: ${laminasError.message}`)
  }

  // Subir a versão nova = "Finalizar atualizações": os apontamentos que ainda
  // estavam abertos nas versões anteriores contam como aplicados. A nova
  // versão nasce limpa (os pins são por versão/lâmina — não são herdados).
  const { data: aplicados } = await supabase
    .from('prova_comentarios')
    .update({ resolvido: true })
    .eq('projeto_id', projetoId)
    .lt('versao', versao.numero)
    .eq('resolvido', false)
    .select('id')
  const nAplicados = aplicados?.length ?? 0

  await supabase.from('projetos').update({ status: 'em_revisao_interna' }).eq('id', projetoId)
  await logActivity(
    supabase,
    projetoId,
    `Nova versão com ${laminas.length} ${laminas.length === 1 ? 'lâmina' : 'lâminas'} enviada para revisão interna (v${versao.numero}).` +
      (nAplicados > 0 ? ` ${nAplicados} ${nAplicados === 1 ? 'apontamento pendente marcado' : 'apontamentos pendentes marcados'} como aplicado${nAplicados === 1 ? '' : 's'}.` : ''),
  )

  revalidatePath(`/admin/projetos/${projetoId}`)
  revalidatePath('/admin/design')
  return { versaoId: versao.id, numero: versao.numero }
}

export async function createSmartLayoutVersion(projetoId: string) {
  assertRealMode()
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const [{ data: fotosRows }, { data: projeto }, { count }] = await Promise.all([
    supabase.from('fotos').select('*').eq('projeto_id', projetoId),
    supabase.from('projetos').select('album_config').eq('id', projetoId).single(),
    supabase.from('design_versions').select('id', { count: 'exact', head: true }).eq('projeto_id', projetoId),
  ])

  const fotos = ((fotosRows ?? []) as FotoRow[]).map(mapPhoto)
  if (fotos.length === 0) throw new Error('Este projeto ainda não tem fotos enviadas.')

  const paginasContratadas = (projeto?.album_config as { quantidadePaginas?: number } | null)?.quantidadePaginas ?? 20
  const layout = generateSmartLayout(fotos, paginasContratadas)

  const { data: userData } = await supabase.auth.getUser()
  const numero = (count ?? 0) + 1

  const { data: novaVersao, error } = await supabase
    .from('design_versions')
    .insert({
      projeto_id: projetoId,
      numero,
      responsavel_id: userData.user?.id ?? null,
      arquivo_url: null,
      comentarios: 'Esboço gerado automaticamente pelo Smart Layout.',
      status: 'enviada',
      quantidade_paginas: layout.length,
      layout_json: layout,
      gerado_automaticamente: true,
    })
    .select('id, numero, created_at')
    .single()
  if (error || !novaVersao) throw new Error(error?.message ?? 'Não foi possível gerar o Smart Layout.')

  await supabase.from('projetos').update({ status: 'em_revisao_interna' }).eq('id', projetoId)
  await logActivity(supabase, projetoId, `Smart Layout gerou automaticamente a versão ${numero} (${layout.length} páginas).`)

  revalidatePath(`/admin/projetos/${projetoId}`)

  return {
    id: novaVersao.id as string,
    numero: novaVersao.numero as number,
    data: novaVersao.created_at as string,
    responsavelId: userData.user?.id ?? '',
    arquivo: '',
    comentarios: 'Esboço gerado automaticamente pelo Smart Layout.',
    status: 'enviada' as const,
    quantidadePaginas: layout.length,
    layoutJson: layout,
    automatico: true,
  }
}

export async function reviewDesignVersion(
  projetoId: string,
  versionId: string,
  decision: 'aprovada' | 'rejeitada',
  comentario?: string,
) {
  assertRealMode()
  const { supabase } = await requireModuleAction('projetos', 'aprovar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('design_versions').update({ status: decision }).eq('id', versionId)
  if (error) throw new Error(error.message)

  const novoStatus: ProjectStatus = decision === 'aprovada' ? 'aguardando_aprovacao_cliente' : 'em_ajustes'
  await supabase.from('projetos').update({ status: novoStatus }).eq('id', projetoId)
  await logActivity(
    supabase,
    projetoId,
    decision === 'aprovada'
      ? 'Diagramação aprovada internamente — pronta para seguir ao cliente.'
      : `Ajustes solicitados na revisão interna.${comentario ? ` "${comentario}"` : ''}`,
  )

  revalidatePath(`/admin/projetos/${projetoId}`)
}

/**
 * Cliente aprova a prova, com os adicionais que escolheu no modal de oferta.
 * `aprovar_prova` (0026) grava aprovação e adicionais juntos; o preço vem
 * do banco. O que o casal pede entra "aguardando o estúdio" — quem aceita e
 * paga é o fotógrafo (white label).
 */
export async function clientApprove(projetoId: string, versao: number, adicionais: ItemEscolhido[] = []) {
  assertRealMode()
  const { supabase } = await requireClientPortal()
  if (!supabase) throw new Error('Sem conexão com o banco.')
  await exigirProvaAguardandoDecisao(supabase, projetoId)

  const { error } = await supabase.rpc('aprovar_prova', {
    p_projeto_id: projetoId,
    p_versao: versao,
    p_adicionais: normalizarAdicionais(adicionais),
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/cliente/projetos/${projetoId}`)
}

export async function clientRequestChanges(projetoId: string, versao: number, comentario: string) {
  assertRealMode()
  const { supabase, user } = await requireClientPortal()
  if (!supabase) throw new Error('Sem conexão com o banco.')
  await exigirProvaAguardandoDecisao(supabase, projetoId)

  const { error } = await supabase
    .from('aprovacoes')
    .insert({ projeto_id: projetoId, versao, usuario_id: user.id, status: 'alteracao_solicitada', comentario })
  if (error) throw new Error(error.message)

  revalidatePath(`/cliente/projetos/${projetoId}`)
}

export async function addProofComment(
  projetoId: string,
  pageIndex: number,
  versao: number,
  texto: string,
  apontamento?: Apontamento | null,
) {
  assertRealMode()
  const { supabase, user } = await requireClientPortal()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('prova_comentarios').insert({
    projeto_id: projetoId,
    page_index: pageIndex,
    versao,
    texto: texto.slice(0, 2000),
    autor_id: user.id,
    ...colunasDoApontamento(apontamento),
  })
  if (error) throw new Error(error.message)
}

/**
 * A equipe marca (ou desmarca) um comentário/pin da prova como resolvido. O
 * banco carimba `resolvido_em` e só deixa a equipe mexer no estado de
 * resolução — texto e posição do pin ficam como o cliente deixou (migration 0019).
 */
export async function marcarComentarioResolvido(
  comentarioId: string,
  resolvido: boolean,
): Promise<{ ok: true; resolvidoEm: string | null } | { ok: false; erro: string }> {
  if (isDemoMode()) return { ok: true, resolvidoEm: resolvido ? new Date().toISOString() : null }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { data, error } = await supabase
    .from('prova_comentarios')
    .update({ resolvido })
    .eq('id', comentarioId)
    .select('projeto_id, resolvido_em')
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[marcarComentarioResolvido]', error.message)
    return { ok: false, erro: 'Não foi possível atualizar o comentário. Tente de novo.' }
  }
  revalidatePath(`/admin/projetos/${data.projeto_id}/prova`)
  return { ok: true, resolvidoEm: data.resolvido_em }
}

/** Registra no banco uma foto já enviada ao Storage pelo navegador (ver upload-dropzone/client-photos-manager). */
export async function registerFoto(input: {
  projetoId: string
  storagePath: string
  url: string
  grupo?: string
  /** EXIF lido no navegador (lib/exif) — relógio da câmera, sem fuso. */
  capturadaEm?: string | null
  camera?: string | null
}) {
  assertRealMode()
  const { supabase } = await requireUser()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const capturadaEm =
    typeof input.capturadaEm === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(input.capturadaEm)
      ? input.capturadaEm
      : null
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.from('fotos').insert({
    projeto_id: input.projetoId,
    storage_path: input.storagePath,
    url: input.url,
    grupo: input.grupo ?? null,
    enviado_por: userData.user?.id ?? null,
    capturada_em: capturadaEm,
    camera: typeof input.camera === 'string' ? input.camera.slice(0, 80) : null,
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/admin/projetos/${input.projetoId}`)
  revalidatePath(`/cliente/projetos/${input.projetoId}`)
}

export async function toggleTeamMemberStatus(memberId: string, novoStatus: 'ativo' | 'inativo') {
  assertRealMode()
  const { supabase } = await requireModuleAction('equipe', 'criar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('profiles').update({ status: novoStatus }).eq('id', memberId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/equipe')
}
