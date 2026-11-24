import 'server-only'

/** Acesso direto à demonstração, exclusivamente no servidor local isolado. */
export function previaLocalAtiva() {
  return process.env.NODE_ENV === 'development'
    && process.env.SEUALBUM_PREVIA_LOCAL === '1'
    && process.env.SEUALBUM_OPERACAO_LOCAL === '1'
    && !process.env.NEXT_PUBLIC_SUPABASE_URL
}
