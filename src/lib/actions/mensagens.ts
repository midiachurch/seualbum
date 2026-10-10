'use server'

import { isDemoMode } from '@/lib/demo-mode'
import { requireUser } from '@/lib/supabase/queries'
import {
  MENSAGENS_POR_PAGINA,
  ehCanal,
  ehDataIso,
  ehUuid,
  mapMensagem,
  validarCorpo,
  type CanalConversa,
  type ConversaResumo,
  type MensagemView,
  type PaginaDeMensagens,
  type PerfilMensagens,
  type Resultado,
} from '@/lib/mensagens'
import { EQUIPE_ROLES, type PlatformRole } from '@/types/platform'
import type { MensagemRow } from '@/types/database'

/**
 * Mensagens interligadas (migration 0037). Toda action é uma porta de entrada
 * não confiável: valida o formato aqui e deixa a decisão de acesso com o
 * banco (RLS de `mensagens`/`conversas` e as funções `abrir_conversa`,
 * `marcar_conversa_lida`, `listar_conversas`). Autor, lado, nome e data da
 * mensagem são gravados pelo gatilho do banco — o navegador manda só o texto.
 */

type Sessao = {
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>
  userId: string
  perfil: PerfilMensagens
}

function perfilDoPapel(role: PlatformRole | null | undefined): PerfilMensagens {
  if (role && EQUIPE_ROLES.includes(role)) return 'equipe'
  if (role === 'fotografo') return 'fotografo'
  return 'cliente'
}

async function sessao(): Promise<{ ok: true; s: Sessao } | { ok: false; erro: string }> {
  if (isDemoMode()) return { ok: false, erro: 'Mensagens indisponíveis no modo de demonstração.' }
  const { supabase, user, profile } = await requireUser()
  if (!supabase || !profile) return { ok: false, erro: 'Sem conexão com o banco.' }
  return { ok: true, s: { supabase, userId: user.id, perfil: perfilDoPapel(profile.role) } }
}

/** Erros do banco que já vêm com texto para o usuário; o resto vira genérico. */
function traduzirErro(error: { message: string; code?: string }, contexto: string): string {
  console.error(`[mensagens:${contexto}]`, error.code, error.message)
  if (error.code === '42501') return 'Você não tem acesso a esta conversa.'
  if (['22023', '23514', 'P0001'].includes(error.code ?? '')) return error.message
  return 'Não foi possível concluir agora. Tente de novo.'
}

/** Busca ou cria o fio (geral do estúdio, do projeto com a equipe ou com o cliente). */
export async function abrirConversa(input: {
  canal: CanalConversa
  fotografoId?: string | null
  projetoId?: string | null
}): Promise<Resultado<{ conversaId: string }>> {
  if (!ehCanal(input?.canal)) return { ok: false, erro: 'Canal inválido.' }
  if (input.fotografoId != null && !ehUuid(input.fotografoId)) return { ok: false, erro: 'Estúdio inválido.' }
  if (input.projetoId != null && !ehUuid(input.projetoId)) return { ok: false, erro: 'Projeto inválido.' }
  if (input.canal === 'cliente_estudio' && !input.projetoId) {
    return { ok: false, erro: 'A conversa com o cliente é sempre de um projeto.' }
  }

  const r = await sessao()
  if (!r.ok) return r
  const { data, error } = await r.s.supabase.rpc('abrir_conversa', {
    p_canal: input.canal,
    p_fotografo_id: input.fotografoId ?? null,
    p_projeto_id: input.projetoId ?? null,
  })
  if (error || !data) return { ok: false, erro: error ? traduzirErro(error, 'abrir') : 'Conversa não encontrada.' }
  return { ok: true, conversaId: data }
}

export type FiltrosConversas = {
  canal?: CanalConversa | null
  fotografoId?: string | null
  projetoId?: string | null
  somenteNaoLidas?: boolean
  /** Fios ainda sem mensagem (aberto e ninguém escreveu). Padrão: escondidos. */
  incluirVazias?: boolean
  limite?: number
}

/** Fios que a pessoa logada enxerga, mais recentes primeiro, com não lidas. */
export async function listarConversas(filtros: FiltrosConversas = {}): Promise<Resultado<{ conversas: ConversaResumo[] }>> {
  if (filtros.canal != null && !ehCanal(filtros.canal)) return { ok: false, erro: 'Canal inválido.' }
  if (filtros.fotografoId != null && !ehUuid(filtros.fotografoId)) return { ok: false, erro: 'Estúdio inválido.' }
  if (filtros.projetoId != null && !ehUuid(filtros.projetoId)) return { ok: false, erro: 'Projeto inválido.' }
  const limite = Math.min(Math.max(Math.trunc(Number(filtros.limite) || 50), 1), 200)

  const r = await sessao()
  if (!r.ok) return r
  const { data, error } = await r.s.supabase.rpc('listar_conversas', {
    p_canal: filtros.canal ?? null,
    p_fotografo_id: filtros.fotografoId ?? null,
    p_projeto_id: filtros.projetoId ?? null,
    p_somente_nao_lidas: filtros.somenteNaoLidas === true,
    p_limite: limite,
  })
  if (error) return { ok: false, erro: traduzirErro(error, 'listar') }

  const conversas = (data ?? [])
    .filter((c) => filtros.incluirVazias || c.ultima_mensagem_em)
    .map<ConversaResumo>((c) => ({
      id: c.id,
      canal: c.canal,
      fotografoId: c.fotografo_id,
      estudio: c.estudio,
      estudioLogoUrl: c.estudio_logo_url,
      projetoId: c.projeto_id,
      projetoNome: c.projeto_nome,
      projetoNumero: c.projeto_numero,
      clienteNome: c.cliente_nome,
      ultimaMensagemEm: c.ultima_mensagem_em,
      ultimaMensagemPrevia: c.ultima_mensagem_previa,
      naoLidas: c.nao_lidas,
      criadaEm: c.created_at,
    }))
  return { ok: true, conversas }
}

/**
 * Uma página de mensagens do fio, da mais antiga para a mais nova. `antesDe`
 * (data ISO da mais antiga já na tela) traz a página anterior.
 */
export async function listarMensagens(conversaId: string, antesDe?: string | null): Promise<Resultado<PaginaDeMensagens>> {
  if (!ehUuid(conversaId)) return { ok: false, erro: 'Conversa inválida.' }
  if (antesDe != null && !ehDataIso(antesDe)) return { ok: false, erro: 'Página inválida.' }

  const r = await sessao()
  if (!r.ok) return r
  const { supabase, userId } = r.s

  let consulta = supabase
    .from('mensagens')
    .select('*')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: false })
    .limit(MENSAGENS_POR_PAGINA + 1)
  if (antesDe) consulta = consulta.lt('created_at', new Date(antesDe).toISOString())

  const [{ data, error }, leituras] = await Promise.all([
    consulta,
    supabase.from('conversa_leituras').select('usuario_id, lida_ate').eq('conversa_id', conversaId).neq('usuario_id', userId),
  ])
  if (error) return { ok: false, erro: traduzirErro(error, 'mensagens') }

  const linhas = (data ?? []) as MensagemRow[]
  const temMais = linhas.length > MENSAGENS_POR_PAGINA
  const mensagens = linhas.slice(0, MENSAGENS_POR_PAGINA).map(mapMensagem).reverse()
  // A RLS das leituras já esconde a da equipe no fio do cliente.
  const vistoAte = (leituras.data ?? []).reduce<string | null>(
    (max, l) => (!max || l.lida_ate > max ? l.lida_ate : max),
    null,
  )
  return { ok: true, mensagens, temMais, vistoAte }
}

export async function enviarMensagem(input: {
  conversaId: string
  corpo: string
  laminaId?: string | null
}): Promise<Resultado<{ mensagem: MensagemView }>> {
  if (!ehUuid(input?.conversaId)) return { ok: false, erro: 'Conversa inválida.' }
  if (input.laminaId != null && !ehUuid(input.laminaId)) return { ok: false, erro: 'Lâmina inválida.' }
  const corpo = validarCorpo(input.corpo)
  if (!corpo.ok) return corpo

  const r = await sessao()
  if (!r.ok) return r
  const { data, error } = await r.s.supabase
    .from('mensagens')
    .insert({ conversa_id: input.conversaId, corpo: corpo.corpo, autor_id: r.s.userId, lamina_id: input.laminaId ?? null })
    .select('*')
    .single<MensagemRow>()
  if (error || !data) return { ok: false, erro: error ? traduzirErro(error, 'enviar') : 'Mensagem não enviada.' }
  return { ok: true, mensagem: mapMensagem(data) }
}

/** "Li até agora" — zera as não lidas do fio para quem está logado. */
export async function marcarComoLida(conversaId: string): Promise<Resultado> {
  if (!ehUuid(conversaId)) return { ok: false, erro: 'Conversa inválida.' }
  const r = await sessao()
  if (!r.ok) return r
  const { error } = await r.s.supabase.rpc('marcar_conversa_lida', { p_conversa_id: conversaId })
  if (error) return { ok: false, erro: traduzirErro(error, 'lida') }
  return { ok: true }
}

/** Total de não lidas de quem está logado (selo do menu). 0 quando não dá para contar. */
export async function contarNaoLidas(): Promise<number> {
  const r = await sessao()
  if (!r.ok) return 0
  const { data, error } = await r.s.supabase.rpc('total_mensagens_nao_lidas')
  if (error) {
    console.error('[mensagens:contar]', error.message)
    return 0
  }
  return typeof data === 'number' ? data : 0
}

/** Exclusão lógica da PRÓPRIA mensagem: a linha fica, o texto some. */
export async function apagarMensagem(mensagemId: string): Promise<Resultado<{ mensagem: MensagemView }>> {
  if (!ehUuid(mensagemId)) return { ok: false, erro: 'Mensagem inválida.' }
  const r = await sessao()
  if (!r.ok) return r
  const { data, error } = await r.s.supabase
    .from('mensagens')
    .update({ apagada_em: new Date().toISOString() })
    .eq('id', mensagemId)
    .eq('autor_id', r.s.userId)
    .is('apagada_em', null)
    .select('*')
    .maybeSingle<MensagemRow>()
  if (error) return { ok: false, erro: traduzirErro(error, 'apagar') }
  if (!data) return { ok: false, erro: 'Mensagem não encontrada.' }
  return { ok: true, mensagem: mapMensagem(data) }
}
