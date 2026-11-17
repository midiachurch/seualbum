import { defineConfig, devices } from '@playwright/test'
const url = 'http://127.0.0.1:3314'
if (!process.env.SEUALBUM_PORTAL_TEST_ANON || !process.env.SEUALBUM_PORTAL_CONTROL) throw new Error('Use o runner de portal descartável; não use ambiente real.')
export default defineConfig({
  testDir: './e2e/portal', workers: 1, retries: 0, timeout: 120_000, expect: { timeout: 25_000 },
  reporter: [['list']], use: { ...devices['Desktop Chrome'], baseURL:url, locale:'pt-BR', trace:'off', screenshot:'off' },
  webServer: { command:'node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3314', url:`${url}/portal/${'a'.repeat(64)}`, reuseExistingServer:false, timeout:180_000,
    env: { NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3313', NEXT_PUBLIC_SUPABASE_ANON_KEY:process.env.SEUALBUM_PORTAL_TEST_ANON,
      NEXT_PUBLIC_SITE_URL:url, SUPABASE_SERVICE_ROLE_KEY:'', STRIPE_SECRET_KEY:'', STRIPE_WEBHOOK_SECRET:'', WEBHOOK_SECRET:'',
      R2_ACCOUNT_ID:'synthetic', R2_ACCESS_KEY_ID:'synthetic', R2_SECRET_ACCESS_KEY:'synthetic-local-only', R2_BUCKET:'synthetic', R2_PUBLIC_BUCKET:'', R2_PUBLIC_URL:'',
      AWS_REKOGNITION_REGION:'', AWS_REKOGNITION_ACCESS_KEY_ID:'', AWS_REKOGNITION_SECRET_ACCESS_KEY:'',
      AWS_ACCESS_KEY_ID:'',AWS_SECRET_ACCESS_KEY:'',AWS_SESSION_TOKEN:'',CRON_SECRET:'',NEXT_TELEMETRY_DISABLED:'1' }
  },
})
