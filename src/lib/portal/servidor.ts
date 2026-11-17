import 'server-only'
import { cookies } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/server'
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
