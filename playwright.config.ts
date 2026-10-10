import { defineConfig, devices } from '@playwright/test'
import { ANON_KEY, PORTA_APP, SERVICE_KEY, SUPABASE_URL, URL_APP } from './e2e/support/ambiente'

/**
 * Testes de navegador (cliques de verdade) contra o Supabase LOCAL.
 * Ver "Testes E2E no navegador" no README.
 *
 * O `next dev` sobe aqui com o ambiente travado no banco local: as variáveis
 * abaixo têm precedência sobre um `.env.local` (que o Next não sobrescreve), e
 * as integrações externas ficam vazias para nada sair da máquina.
 */
export default defineConfig({
  testDir: './e2e',
  // O editor de álbum tem config própria (R2 falso): playwright.editor.config.ts.
  testIgnore: ['editor/**'],
  globalSetup: './e2e/global-setup.ts',
  // Um navegador por vez: o `next dev` compila cada rota na primeira visita.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: URL_APP,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev -p ${PORTA_APP}`,
    url: `${URL_APP}/auth/login`,
    timeout: 180_000,
    // Nunca reaproveita um servidor já aberto: poderia estar ligado a outro banco.
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      NEXT_PUBLIC_SITE_URL: URL_APP,
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      WEBHOOK_SECRET: '',
      R2_ACCOUNT_ID: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET: '',
      R2_PUBLIC_BUCKET: '',
      R2_PUBLIC_URL: '',
      CRON_SECRET: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
