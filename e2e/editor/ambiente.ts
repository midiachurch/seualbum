import { ANON_KEY, SERVICE_KEY, SUPABASE_URL } from '../support/ambiente'

/**
 * Endereços e variáveis do stack LOCAL dos testes do editor. Tudo pode ser
 * trocado por variável de ambiente, mas a URL do Supabase precisa ser local:
 * estes testes criam usuários, álbuns e projetos e nunca devem tocar o remoto.
 *
 * As chaves padrão são as públicas de demonstração que o `supabase start`
 * imprime em qualquer máquina — nada do `.env.local`.
 */
export const PORTA_APP = Number(process.env.E2E_PORTA_APP ?? 3107)
export const PORTA_R2_FALSO = Number(process.env.E2E_PORTA_R2_FALSO ?? 56490)
export const URL_APP = `http://localhost:${PORTA_APP}`
export const URL_R2_FALSO = `http://127.0.0.1:${PORTA_R2_FALSO}`

// Mesmo Supabase local e mesmas chaves de demonstração dos outros testes E2E
// (E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY / E2E_SUPABASE_SERVICE_KEY). O módulo recusa URL não local.
export { SUPABASE_URL } from '../support/ambiente'
export const SUPABASE_ANON = ANON_KEY
export const SUPABASE_SERVICE = SERVICE_KEY

/** Bucket do R2 falso (qualquer nome serve: o servidor falso aceita todos). */
export const R2_BUCKET_E2E = 'seualbum-e2e'

export const ADMIN_E2E = { email: 'admin-editor@e2e.local', senha: 'senha-e2e-editor-123' }

/** Variáveis do `next dev` dos testes. O R2 aponta para o falso via `desviar.mjs`. */
export const AMBIENTE_E2E: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE,
  NEXT_PUBLIC_SITE_URL: URL_APP,
  R2_ACCOUNT_ID: 'e2e-local',
  R2_ACCESS_KEY_ID: 'e2e',
  R2_SECRET_ACCESS_KEY: 'e2e',
  R2_BUCKET: R2_BUCKET_E2E,
  R2_FALSO_PORTA: String(PORTA_R2_FALSO),
  NODE_OPTIONS: '--import ./e2e/editor/r2-falso/desviar.mjs',
  // Integrações externas vazias: nada sai da máquina.
  R2_PUBLIC_BUCKET: '',
  R2_PUBLIC_URL: '',
  STRIPE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  WEBHOOK_SECRET: '',
  CRON_SECRET: '',
  NEXT_TELEMETRY_DISABLED: '1',
}
