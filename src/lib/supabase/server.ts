import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Cliente para Server Components, Server Actions e Route Handlers.
 * Em Next 15 `cookies()` é assíncrono — por isso a função é async.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Components não podem escrever cookies. O refresh do token
            // acontece no middleware, então ignorar aqui é seguro.
          }
        },
      },
    },
  )
}

/**
 * Cliente anônimo para dados públicos (catálogo de planos, portfólio).
 *
 * Não toca em cookies de propósito: ler `cookies()` marca a rota como dinâmica
 * e desliga o ISR, o que faria a landing comercial ser renderizada a cada
 * visita em vez de servida do CDN.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * Cliente privilegiado que ignora RLS. Use apenas em webhooks e jobs de
 * servidor — nunca em código que roda a partir de input do usuário.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')

  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  })
}
