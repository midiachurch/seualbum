import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SUPABASE_URL } from './support/ambiente'
import { servico } from './support/seed'

/**
 * Antes da suíte: confere que o Supabase local responde e liga o pagamento
 * simulado das faturas de fechamento (`private.app_config`, schema que a API
 * não expõe — por isso direto no contêiner do Postgres local).
 */
export default async function globalSetup() {
  const { error } = await servico().from('adicionais').select('id').limit(1)
  if (error) {
    throw new Error(
      `Supabase local inacessível em ${SUPABASE_URL} (${error.message}). Rode \`supabase start\` e \`supabase db reset --local\`.`,
    )
  }

  const contêiner = process.env.E2E_DB_CONTAINER ?? `supabase_db_${projetoLocal()}`
  const sql =
    "insert into private.app_config (key, value) values ('pagamento_simulado', 'true') " +
    "on conflict (key) do update set value = 'true'"
  try {
    execFileSync('docker', ['exec', contêiner, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qc', sql], {
      stdio: 'pipe',
    })
  } catch (e) {
    throw new Error(
      `Não consegui ligar pagamento_simulado no contêiner ${contêiner} (defina E2E_DB_CONTAINER): ${
        e instanceof Error ? e.message : e
      }`,
    )
  }
}

/** `project_id` do supabase/config.toml (gerado por `supabase init`, não versionado). */
function projetoLocal() {
  try {
    const toml = readFileSync(join(__dirname, '..', 'supabase', 'config.toml'), 'utf8')
    const m = toml.match(/^project_id\s*=\s*"([^"]+)"/m)
    if (m) return m[1]
  } catch {
    // sem config.toml: cai no nome da pasta, como o `supabase init` faz.
  }
  return 'seualbum'
}
