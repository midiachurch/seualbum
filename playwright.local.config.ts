import { defineConfig, devices } from '@playwright/test'

const url = 'http://127.0.0.1:3121'

export default defineConfig({
  testDir: './e2e/operacao-local',
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: url,
    locale: 'pt-BR',
    actionTimeout: 20_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/operacao-local.mjs',
    url: `${url}/operacao-local`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { SEUALBUM_LOCAL_PORT: '3121' },
  },
})
