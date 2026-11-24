import 'server-only'
import { cookies } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/server'
import { lerContratoProva } from './prova'
import { segredoValido, hashSessaoPortal } from './segredos'

export type PortalProjeto = {
  id: string; nome: string; estudio: string | null; logo: string | null; revisao: number; total: number; favoritas: number; favorita_ids: string[]
  fotos: { id: string; grupo: string | null; favorita: boolean; nome_original: string | null }[]
  eventos: { tipo: string; data: string; responsavel: string }[]
}
export function portalConfigurado() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) }
export async function sessaoPortal(link: string) {
  if (!segredoValido(link) || !portalConfigurado()) return null
  const token = (await cookies()).get('seualbum_portal')?.value
  return segredoValido(token) ? hashSessaoPortal(link, token) : null
}
export async function lerPortal(link: string, apos?: string): Promise<PortalProjeto | null> {
  const hash = await sessaoPortal(link)
  if (!hash) return null
  const { data, error } = await createPublicClient().rpc('portal_projeto', { p_sessao_hash: hash, p_apos: apos ?? undefined })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
  return data as unknown as PortalProjeto
}

export async function lerProvaPortal(link: string): Promise<import('./prova').PortalProva | null> {
  const hash = await sessaoPortal(link)
  if (!hash) return null
  const { data, error } = await createPublicClient().rpc('portal_prova', { p_sessao_hash: hash })
  return error ? null : lerContratoProva(data)
}

export type ColecaoPortal = { id: string; nome: string; total: number }
export async function lerColecoesPortal(link: string): Promise<ColecaoPortal[]> {
  const hash = await sessaoPortal(link)
  if (!hash) return []
  const { data, error } = await createPublicClient().rpc('portal_colecoes', { p_sessao_hash: hash })
  return error || !Array.isArray(data) ? [] : (data as unknown as ColecaoPortal[])
}
export async function lerFotosColecaoPortal(link: string, colecao: string, apos?: string): Promise<PortalProjeto['fotos'] | null> {
  const hash = await sessaoPortal(link)
  if (!hash) return null
  const { data, error } = await createPublicClient().rpc('portal_fotos_colecao', { p_sessao_hash: hash, p_colecao: colecao, p_apos: apos ?? undefined })
  return error || !Array.isArray(data) ? null : (data as unknown as PortalProjeto['fotos'])
}
export async function downloadLiberadoPortal(link: string): Promise<boolean> {
  const hash = await sessaoPortal(link)
  if (!hash) return false
  const { data, error } = await createPublicClient().rpc('portal_download_config', { p_sessao_hash: hash })
  return !error && typeof data === 'object' && data !== null && !Array.isArray(data) && (data as { liberado?: unknown }).liberado === true
}
