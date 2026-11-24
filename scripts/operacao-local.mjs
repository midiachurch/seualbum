import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// As entradas vazias têm precedência sobre .env.local no Next. Não lê,
// imprime nem transporta os valores de credenciais do projeto.
export function ambienteLocal(base = process.env, porta = '3121') {
  const env = { ...base }
  for (const chave of Object.keys(env)) {
    if (/^(NEXT_PUBLIC_SUPABASE_|SUPABASE_|STRIPE_|R2_|AWS_|VERCEL_|RESEND_|SMTP_)/.test(chave)) {
      env[chave] = ''
    }
  }
  for (const chave of [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'WEBHOOK_SECRET',
    'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET',
    'R2_PUBLIC_BUCKET', 'R2_PUBLIC_URL', 'R2_VARREDURA_ORFAOS',
    'AWS_REKOGNITION_REGION', 'AWS_REKOGNITION_ACCESS_KEY_ID', 'AWS_REKOGNITION_SECRET_ACCESS_KEY',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'CRON_SECRET',
  ]) env[chave] = ''
  return {
    ...env,
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${porta}`,
    SEUALBUM_OPERACAO_LOCAL: '1',
    NEXT_TELEMETRY_DISABLED: '1',
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const porta = process.env.SEUALBUM_LOCAL_PORT ?? '3121'
  if (!/^\d+$/.test(porta) || Number(porta) < 1024 || Number(porta) > 65535) {
    throw new Error('SEUALBUM_LOCAL_PORT deve ser uma porta entre 1024 e 65535.')
  }
  const child = spawn(process.execPath, [
    'node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', porta,
  ], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: {
    ...ambienteLocal(process.env, porta),
    SEUALBUM_PREVIA_LOCAL: process.argv.includes('--previa') ? '1' : '',
  }, stdio: 'inherit' })
  for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => child.kill(sinal))
  child.on('error', () => { console.error('Não foi possível iniciar o servidor local.'); process.exitCode = 1 })
  child.on('exit', (codigo) => { process.exitCode = codigo ?? 1 })
}
