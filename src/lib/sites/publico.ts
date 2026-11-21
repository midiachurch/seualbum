import 'server-only'

import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/server'
import { urlPublica } from '@/lib/r2/cliente'
import type { Json } from '@/types/database'
import type { MidiaPublicada, SitePublicado } from './tipos'

/** O JSON vindo do banco tem a forma mínima esperada? (o conteúdo já foi validado ao publicar.) */
export function sitePublicadoValido(j: Json | null | undefined): j is Json & SitePublicado {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return false
  const s = j as Record<string, unknown>
  const c = s.conteudo as Record<string, unknown> | undefined
  return typeof s.slug === 'string' && typeof s.nome === 'string' && !!c && c.v === 1 && Array.isArray(c.paginas) && c.paginas.length > 0 && typeof s.midias === 'object' && s.midias !== null
}

/**
 * Leitura PÚBLICA por slug: só a versão publicada (a RPC nunca devolve
 * rascunho). `cache` do React só deduplica dentro da MESMA requisição
 * (layout + página + metadata); a chave é o slug, então nada cruza sites.
 */
export const obterSitePublicado = cache(async (slug: string): Promise<SitePublicado | null> => {
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return null
  try {
    const { data, error } = await createPublicClient().rpc('obter_site_publicado', { p_slug: slug })
    if (error || !sitePublicadoValido(data)) return null
    return data as unknown as SitePublicado
  } catch {
    return null
  }
})

/** Endereço público de uma mídia do snapshot (bucket público do R2). `null` se o R2 público não está configurado. */
export function urlDaMidia(m: MidiaPublicada | undefined): string | null {
  if (!m || !m.chave.startsWith('sites/')) return null
  return urlPublica(m.chave)
}
