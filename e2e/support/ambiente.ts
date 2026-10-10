/**
 * Ambiente dos testes de navegador: SEMPRE o Supabase local (`supabase start`).
 *
 * Nada aqui lê `.env.local` — as chaves padrão são as públicas de demonstração
 * que todo `supabase start` usa. Portas diferentes (outro projeto ocupando a
 * 54321) entram por E2E_SUPABASE_URL; chaves diferentes, por
 * E2E_SUPABASE_ANON_KEY / E2E_SUPABASE_SERVICE_KEY.
 */
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
export const SERVICE_KEY =
  process.env.E2E_SUPABASE_SERVICE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export const PORTA_APP = Number(process.env.E2E_PORT ?? 3210)
export const URL_APP = `http://localhost:${PORTA_APP}`

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL)) {
  throw new Error(`E2E_SUPABASE_URL precisa ser o Supabase local (recebido: ${SUPABASE_URL}).`)
}
