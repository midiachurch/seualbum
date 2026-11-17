import { defineConfig, devices } from '@playwright/test'

const url = 'http://127.0.0.1:3119'

/** Interface demonstrativa somente: sem Auth, PostgREST, R2 ou credenciais reais. */
export default defineConfig({
  testDir: './e2e/demo',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: url,
    locale: 'pt-BR',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3119',
    url: `${url}/auth/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      NEXT_PUBLIC_SITE_URL: url,
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      WEBHOOK_SECRET: '',
      R2_ACCOUNT_ID: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET: '',
      R2_PUBLIC_BUCKET: '',
      R2_PUBLIC_URL: '',
      AWS_REKOGNITION_REGION: '',
      AWS_REKOGNITION_ACCESS_KEY_ID: '',
      AWS_REKOGNITION_SECRET_ACCESS_KEY: '',
      AWS_ACCESS_KEY_ID: '',
      AWS_SECRET_ACCESS_KEY: '',
      AWS_SESSION_TOKEN: '',
      CRON_SECRET: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
