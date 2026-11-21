'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'
import { createAdminClient } from '@/lib/supabase/server'
import { removerObjetos } from '@/lib/r2/cliente'
import { dominioValido, normalizarDominio } from '@/lib/sites/dominio'
import { verificarDominioSite, type ClienteRpc } from '@/lib/sites/dominio-servico'
import { resolvedorDnsNode } from '@/lib/sites/dns-node'
import { ehConflitoDeRevisao, mensagemDeErroSite } from '@/lib/sites/erros'
import { validarConteudoSite } from '@/lib/sites/validar'
import type { Json } from '@/types/database'

type Falha = { ok: false; erro: string; conflito?: boolean; erros?: string[] }
const DEMO: Falha = { ok: false, erro: 'Demonstração: o site não será gravado no servidor.' }
const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

async function contexto() {
  if (isDemoMode()) return null
  const { supabase } = await requireUser()
  return supabase ?? null
}

/** Invalida o cache público do site (por slug; o host próprio é reescrito para o mesmo caminho). */
async function revalidarSite(supabase: NonNullable<Awaited<ReturnType<typeof contexto>>>, siteId: string, slugAntigo?: string) {
  const { data } = await supabase.from('sites').select('slug').eq('id', siteId).maybeSingle()
  for (const slug of new Set([data?.slug, slugAntigo].filter(Boolean) as string[])) revalidatePath(`/s/${slug}`, 'layout')
  revalidatePath('/dashboard/site')
}

/** Invalida o cache público do site dono de um domínio (canônico/OG mudam com o domínio ativo). */
async function revalidarSiteDoDominio(supabase: NonNullable<Awaited<ReturnType<typeof contexto>>>, dominioId: string) {
  const { data } = await supabase.from('site_dominios').select('site_id').eq('id', dominioId).maybeSingle()
  if (data?.site_id) await revalidarSite(supabase, data.site_id)
}

export async function criarSite(organizacaoId: string, nome: string, slug: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível criar o site. Confira o nome e o endereço.' }
  const s = typeof slug === 'string' ? slug.trim().toLowerCase() : ''
  if (!uuidValido(organizacaoId) || typeof nome !== 'string' || nome.trim().length < 2 || nome.length > 120 || !SLUG.test(s)) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data, error } = await supabase.rpc('criar_site', { p_org: organizacaoId, p_nome: nome.trim(), p_slug: s })
    if (error || typeof data !== 'string') return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    revalidatePath('/dashboard/site')
    return { ok: true as const, id: data }
  } catch { return falha }
}

export async function atualizarDadosSite(siteId: string, nome: string, slug: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível salvar. Confira o nome e o endereço.' }
  const s = typeof slug === 'string' ? slug.trim().toLowerCase() : ''
  if (!uuidValido(siteId) || typeof nome !== 'string' || nome.trim().length < 2 || nome.length > 120 || !SLUG.test(s)) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data: antes } = await supabase.from('sites').select('slug').eq('id', siteId).maybeSingle()
    const { data, error } = await supabase.rpc('atualizar_site_dados', { p_site: siteId, p_nome: nome.trim(), p_slug: s })
    if (error || data !== true) return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    await revalidarSite(supabase, siteId, antes?.slug)
    return { ok: true as const }
  } catch { return falha }
}

/** Valida/sanitiza no servidor e grava o rascunho com concorrência otimista. */
export async function salvarRascunhoSite(siteId: string, conteudo: unknown, revisao: number) {
  const falha: Falha = { ok: false, erro: 'Não foi possível salvar o rascunho. Tente de novo.' }
  if (!uuidValido(siteId) || !Number.isInteger(revisao) || revisao < 1) return falha
  const v = validarConteudoSite(conteudo)
  if (!v.ok) return { ok: false, erro: 'Corrija os campos destacados antes de salvar.', erros: v.erros.slice(0, 20) } as Falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data, error } = await supabase.rpc('salvar_site_rascunho', { p_site: siteId, p_conteudo: v.conteudo as unknown as Json, p_rev: revisao })
    if (error || typeof data !== 'number') {
      return { ok: false, erro: mensagemDeErroSite(error, falha.erro), conflito: ehConflitoDeRevisao(error) } as Falha
    }
    revalidatePath('/dashboard/site')
    return { ok: true as const, revisao: data, conteudo: v.conteudo }
  } catch { return falha }
}

/** `chave` é gerada pela tela por clique: repetir o pedido (retry/duplo clique) não cria outra versão. */
export async function publicarSite(siteId: string, chave: string, nota?: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível publicar. Tente de novo.' }
  if (!uuidValido(siteId) || !uuidValido(chave) || (nota !== undefined && (typeof nota !== 'string' || nota.length > 200))) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data, error } = await supabase.rpc('publicar_site', { p_site: siteId, p_chave: chave, p_nota: nota?.trim() || null })
    if (error || typeof data !== 'string') return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    await revalidarSite(supabase, siteId)
    return { ok: true as const, versaoId: data }
  } catch { return falha }
}

export async function reverterSite(siteId: string, versaoId: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível voltar para essa versão.' }
  if (!uuidValido(siteId) || !uuidValido(versaoId)) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data, error } = await supabase.rpc('reverter_site_versao', { p_site: siteId, p_versao: versaoId })
    if (error || typeof data !== 'string') return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    await revalidarSite(supabase, siteId)
    return { ok: true as const }
  } catch { return falha }
}

export async function despublicarSite(siteId: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível tirar o site do ar.' }
  if (!uuidValido(siteId)) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data, error } = await supabase.rpc('despublicar_site', { p_site: siteId })
    if (error || typeof data !== 'boolean') return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    await revalidarSite(supabase, siteId)
    return { ok: true as const, retirado: data }
  } catch { return falha }
}

export async function restaurarVersaoNoRascunho(siteId: string, versaoId: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível restaurar essa versão no rascunho.' }
  if (!uuidValido(siteId) || !uuidValido(versaoId)) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data, error } = await supabase.rpc('restaurar_site_versao_no_rascunho', { p_site: siteId, p_versao: versaoId })
    if (error || typeof data !== 'number') return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    revalidatePath('/dashboard/site')
    return { ok: true as const, revisao: data }
  } catch { return falha }
}

/** Remove a mídia da biblioteca do site (o banco recusa se estiver em uso) e apaga o arquivo público. */
export async function removerMidiaSite(midiaId: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível remover a imagem.' }
  if (!uuidValido(midiaId)) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data, error } = await supabase.rpc('remover_site_midia', { p_id: midiaId })
    if (error || typeof data !== 'string') return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    await removerObjetos([data], 'publico').catch((e) => console.error('[sites] remover arquivo', e))
    revalidatePath('/dashboard/site')
    return { ok: true as const }
  } catch { return falha }
}

export async function adicionarDominioSite(siteId: string, dominio: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível adicionar o domínio. Use algo como fotos.meuestudio.com.br.' }
  if (!uuidValido(siteId) || !dominioValido(dominio)) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data, error } = await supabase.rpc('adicionar_site_dominio', { p_site: siteId, p_dominio: normalizarDominio(dominio) })
    if (error || !Array.isArray(data) || !data[0]) return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    revalidatePath('/dashboard/site')
    return { ok: true as const, id: data[0].id }
  } catch { return falha }
}

export async function verificarDominioSiteAction(dominioId: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível verificar o domínio agora. Tente de novo.' }
  if (!uuidValido(dominioId)) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const r = await verificarDominioSite({
      usuario: supabase as unknown as ClienteRpc,
      servico: () => createAdminClient() as unknown as ClienteRpc,
      resolvedor: resolvedorDnsNode(),
    }, dominioId)
    if (r.ok) await revalidarSiteDoDominio(supabase, dominioId)
    return r
  } catch { return falha }
}

export async function definirDominioAtivoSite(dominioId: string, ativo: boolean) {
  const falha: Falha = { ok: false, erro: 'Não foi possível alterar o domínio.' }
  if (!uuidValido(dominioId) || typeof ativo !== 'boolean') return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data, error } = await supabase.rpc('definir_site_dominio_ativo', { p_id: dominioId, p_ativo: ativo })
    if (error || data !== true) return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    await revalidarSiteDoDominio(supabase, dominioId)
    return { ok: true as const }
  } catch { return falha }
}

export async function removerDominioSite(dominioId: string) {
  const falha: Falha = { ok: false, erro: 'Não foi possível remover o domínio.' }
  if (!uuidValido(dominioId)) return falha
  const supabase = await contexto()
  if (!supabase) return DEMO
  try {
    const { data: dom } = await supabase.from('site_dominios').select('site_id').eq('id', dominioId).maybeSingle()
    const { data, error } = await supabase.rpc('remover_site_dominio', { p_id: dominioId })
    if (error || data !== true) return { ok: false, erro: mensagemDeErroSite(error, falha.erro) } as Falha
    if (dom?.site_id) await revalidarSite(supabase, dom.site_id)
    return { ok: true as const }
  } catch { return falha }
}
