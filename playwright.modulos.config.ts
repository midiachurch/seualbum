import { defineConfig, devices } from '@playwright/test'
import { AMBIENTE_E2E, PORTA_APP, PORTA_R2_FALSO, URL_APP } from './e2e/editor/ambiente'

/**
 * Jornadas de navegador dos módulos novos (equipe, Loja, coleções/download,
 * Agenda e Sites) contra o Supabase LOCAL e o R2 falso. Mesma regra do E2E do
 * editor: nada aponta para o remoto (a URL do Supabase precisa ser local).
 *
 *   supabase start   (stack temporário, ver README)
 *   E2E_SUPABASE_URL=http://127.0.0.1:56421 E2E_PORTA_APP=3109 E2E_PORTA_R2_FALSO=56491 npm run test:e2e:modulos
 *
 * O pagamento da Loja só roda porque a flag simulada é ligada AQUI (nunca em produção).
 */
export default defineConfig({
  testDir: './e2e/modulos',
  outputDir: './e2e/modulos/.resultados',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: URL_APP, locale: 'pt-BR', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    {
      command: 'node e2e/editor/r2-falso/servidor.mjs',
      url: `http://127.0.0.1:${PORTA_R2_FALSO}/__objetos`,
      env: { R2_FALSO_PORTA: String(PORTA_R2_FALSO) },
      reuseExistingServer: false,
    },
    {
      command: `npx next dev --port ${PORTA_APP}`,
      url: `${URL_APP}/auth/login`,
      env: { ...AMBIENTE_E2E, SEUALBUM_STORE_PAGAMENTO_SIMULADO: '1' },
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
