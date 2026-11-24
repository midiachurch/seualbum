'use server'

import { cookies } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/queries'
import { cookiePortal, hashPortal, hashSessaoPortal, novoCodigo, novoSegredo, segredoValido, uuidValido } from '@/lib/portal/segredos'
import { portalConfigurado, sessaoPortal } from '@/lib/portal/servidor'

type Resultado = { ok: true } | { ok: false; erro: string }
const falha = (): Resultado => ({ ok: false, erro: 'Acesso indisponível, expirado ou revogado. Confira o código ou peça um novo link ao fotógrafo.' })

export async function criarAcessoPortal(projetoId: string) {
  if (!uuidValido(projetoId) || !portalConfigurado()) return { ok: false as const, erro: 'Portal não configurado.' }
  const { supabase } = await requireUser()
  if (!supabase) return { ok: false as const, erro: 'Portal não configurado.' }
  const link = novoSegredo(), codigo = novoCodigo()
  const { error } = await supabase.rpc('gerir_portal', { p_projeto_id: projetoId, p_link_hash: hashPortal(link), p_codigo: codigo, p_revogar: false })
  if (error) return { ok: false as const, erro: 'Não foi possível criar o acesso. Verifique a configuração e a permissão do projeto.' }
  return { ok: true as const, caminho: `/portal/${link}`, codigo }
}
export async function revogarAcessoPortal(projetoId: string): Promise<Resultado> {
  if (!uuidValido(projetoId) || !portalConfigurado()) return falha()
  const { supabase } = await requireUser()
  if (!supabase) return falha()
  const { error } = await supabase.rpc('gerir_portal', { p_projeto_id: projetoId, p_link_hash: null, p_codigo: null, p_revogar: true })
  return error ? falha() : { ok: true }
}
export async function entrarPortal(link: string, codigo: string): Promise<Resultado> {
  if (!segredoValido(link) || typeof codigo !== 'string' || !/^\d{8}$/.test(codigo) || !portalConfigurado()) return falha()
  const token = novoSegredo()
  const { data, error } = await createPublicClient().rpc('abrir_portal', { p_link_hash: hashPortal(link), p_codigo: codigo, p_sessao_hash: hashSessaoPortal(link, token) })
  if (error || data !== true) return falha()
  ;(await cookies()).set('seualbum_portal', token, cookiePortal(link))
  return { ok: true }
}
export async function favoritoPortal(link: string, fotoId: string, favorita: boolean): Promise<Resultado> {
  if (!uuidValido(fotoId) || typeof favorita !== 'boolean') return falha()
  const hash = await sessaoPortal(link)
  if (!hash) return falha()
  const { data, error } = await createPublicClient().rpc('portal_favorito', { p_sessao_hash: hash, p_foto_id: fotoId, p_favorita: favorita })
  return error || data !== true ? falha() : { ok: true }
}
export async function entregarPortal(link: string, revisao: number, chave: string, fotoIds: string[] = []): Promise<Resultado> {
  if (!Array.isArray(fotoIds) || fotoIds.length < 1 || fotoIds.length > 1000 || !fotoIds.every(uuidValido) || new Set(fotoIds).size !== fotoIds.length || !Number.isInteger(revisao) || revisao < 0 || !uuidValido(chave)) return falha()
  const hash = await sessaoPortal(link)
  if (!hash) return falha()
  const { data, error } = await createPublicClient().rpc('portal_entregar', { p_sessao_hash: hash, p_foto_ids: fotoIds, p_revisao: revisao, p_chave: chave })
  if (error || !data) return { ok: false, erro: 'Não foi possível entregar. Atualize a galeria para conferir a revisão e tente novamente.' }
  return { ok: true }
}

export async function comentarProvaPortal(link: string, versaoId: string, laminaId: string | null, tipo: 'comentario' | 'ajustes', texto: string, chave: string): Promise<Resultado> {
  const { comentarioProvaValido } = await import('@/lib/portal/prova')
  if (!comentarioProvaValido(versaoId, laminaId, tipo, texto, chave)) return { ok: false, erro: 'Escolha uma lâmina e escreva até 2000 caracteres.' }
  const naoRegistrado: Resultado = { ok: false, erro: 'Não foi possível registrar. Atualize para conferir se esta versão continua aberta.' }
  try {
    const hash = await sessaoPortal(link)
    if (!hash) return falha()
    const { data, error } = await createPublicClient().rpc('portal_comentar_prova', {
      p_sessao_hash: hash, p_versao_id: versaoId, p_lamina_id: laminaId, p_tipo: tipo, p_texto: texto.trim(), p_chave: chave,
    })
    return error || !uuidValido(data) ? naoRegistrado : { ok: true }
  } catch { return naoRegistrado }
}

export async function aprovarProvaPortal(link: string, versaoId: string, chave: string): Promise<Resultado & { aguardaFechamento?: boolean }> {
  const erro: Resultado = { ok: false, erro: 'Não foi possível aprovar. Atualize e confira se esta versão continua aberta.' }
  if (!uuidValido(versaoId) || !uuidValido(chave)) return erro
  try {
    const hash = await sessaoPortal(link)
    if (!hash) return falha()
    const { data, error } = await createPublicClient().rpc('portal_aprovar_prova', { p_sessao_hash: hash, p_versao_id: versaoId, p_chave: chave })
    if (error || !data || typeof data !== 'object' || Array.isArray(data) || !uuidValido(data.id) || !['aprovado', 'aprovado_aguardando_pagamento'].includes(String(data.status))) return erro
    return { ok: true, aguardaFechamento: data.status === 'aprovado_aguardando_pagamento' }
  } catch { return erro }
}
