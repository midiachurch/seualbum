import 'server-only'

/** Publicação independente só existe quando nenhum provedor real está configurado. */
export function navegacaoIndependenteAtiva() {
  if (process.env.SEUALBUM_NAVEGACAO_INDEPENDENTE !== '1') return false
  return !Object.entries(process.env).some(([chave, valor]) => valor && (
    /^(NEXT_PUBLIC_SUPABASE_|SUPABASE_|STRIPE_|R2_|AWS_REKOGNITION_|RESEND_|SMTP_)/.test(chave)
    || ['WEBHOOK_SECRET', 'CRON_SECRET', 'SITES_HOST_ROUTING'].includes(chave)
  ))
}

/** A mesma navegação pode ser revisada localmente ou publicada sem provedores. */
export function previaLocalAtiva() {
  return navegacaoIndependenteAtiva() || (
    process.env.NODE_ENV === 'development'
    && process.env.SEUALBUM_PREVIA_LOCAL === '1'
    && process.env.SEUALBUM_OPERACAO_LOCAL === '1'
    && !process.env.NEXT_PUBLIC_SUPABASE_URL
  )
}

export function operacaoIndependenteDisponivel() {
  return navegacaoIndependenteAtiva() || (
    process.env.NODE_ENV === 'development' && process.env.SEUALBUM_OPERACAO_LOCAL === '1'
  )
}
