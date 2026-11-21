import { createClient } from '@supabase/supabase-js'
import { hostSemPorta } from './host'

/**
 * host → slug para o proxy, pela RPC pública `resolver_site_por_host` (só
 * devolve site PUBLICADO com domínio verificado e ativo). Cache em memória
 * curto (a chave é o host, então nunca mistura sites); retirada de publicação
 * ou domínio vale em até TTL_MS.
 */
const TTL_MS = 15_000
const MAX = 500
const cache = new Map<string, { slug: string | null; expira: number }>()

export async function resolverSlugPorHost(host: string, agora = Date.now()): Promise<string | null> {
  const h = hostSemPorta(host)
  const quente = cache.get(h)
  if (quente && quente.expira > agora) return quente.slug
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !chave) return null
  try {
    const supabase = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (entrada, init) => fetch(entrada, { ...init, cache: 'no-store' }) },
    })
    const { data, error } = await supabase.rpc('resolver_site_por_host', { p_host: h })
    if (error) return null // falha transitória não é cacheada
    const slug = typeof data === 'string' ? data : null
    if (cache.size >= MAX) cache.clear()
    cache.set(h, { slug, expira: agora + TTL_MS })
    return slug
  } catch {
    return null
  }
}

export function limparCacheDeHosts() { cache.clear() }
