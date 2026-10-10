import { defineConfig, devices } from '@playwright/test'
import { AMBIENTE_E2E, PORTA_APP, PORTA_R2_FALSO, URL_APP } from './e2e/editor/ambiente'

/**
 * Testes de navegador do editor de álbum (Smart Album), só contra o stack
 * LOCAL: Supabase de `supabase start` + `next dev` (porta 3107) + um R2 falso
 * em memória. Nunca aponta para o projeto remoto: `e2e/support/ambiente.ts`
 * recusa URL que não seja 127.0.0.1/localhost. Separado do playwright.config.ts
 * porque o `next dev` daqui sobe com o desvio do R2 (NODE_OPTIONS).
 *
 *   npm run test:e2e:editor   (ver "Testes E2E do editor de álbum" no README)
 */
export default defineConfig({
  testDir: './e2e/editor',
  outputDir: './e2e/editor/.resultados',
  // O editor é pesado (canvas + server actions no `next dev`): um por vez.
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/editor/global-setup.ts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: URL_APP,
    viewport: { width: 1440, height: 900 },
    storageState: './e2e/editor/.auth/admin.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
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
      env: AMBIENTE_E2E,
      timeout: 180_000,
      // Nunca reaproveita um servidor já aberto: poderia estar ligado a outro banco ou ao R2 de verdade.
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
