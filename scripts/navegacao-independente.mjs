import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ambienteLocal } from './operacao-local.mjs'

// As entradas vazias impedem que o Next recarregue serviços de .env.local.
const porta = process.env.SEUALBUM_LOCAL_PORT ?? '3121'
const env = ambienteLocal(process.env, porta)
for (const chave of Object.keys(process.env)) if (chave.startsWith('VERCEL_')) env[chave] = process.env[chave]
env.SITES_HOST_ROUTING = ''
env.SEUALBUM_PREVIA_LOCAL = '1'
env.SEUALBUM_NAVEGACAO_INDEPENDENTE = '1'
const comando = process.argv.includes('--build') ? ['build', '--webpack']
  : [process.argv.includes('--start') ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', porta]
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...comando], {
  cwd: fileURLToPath(new URL('..', import.meta.url)), env, stdio: 'inherit',
})
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => child.kill(sinal))
child.on('error', () => { console.error('Não foi possível iniciar a navegação independente.'); process.exitCode = 1 })
child.on('exit', codigo => { process.exitCode = codigo ?? 1 })
