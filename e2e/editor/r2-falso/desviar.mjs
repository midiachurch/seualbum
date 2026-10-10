// Pré-carregado no `next dev` dos testes (NODE_OPTIONS=--import ...): desvia
// as chamadas do SDK S3 para *.r2.cloudflarestorage.com até o R2 falso local
// (servidor.mjs). Só existe no ambiente do Playwright; o app não muda.
import http from 'node:http'
import https from 'node:https'

const porta = Number(process.env.R2_FALSO_PORTA ?? 56490)
const ehR2 = (h) => typeof h === 'string' && /\.r2\.cloudflarestorage\.com(:\d+)?$/.test(h)

const original = https.request
https.request = function request(...args) {
  const [a, b] = args
  const opcoes = typeof a === 'object' && !(a instanceof URL) ? a : typeof b === 'object' && typeof b !== 'function' ? b : null
  const host = opcoes ? (opcoes.hostname ?? opcoes.host) : a instanceof URL ? a.hostname : typeof a === 'string' ? new URL(a).hostname : null
  if (!ehR2(host)) return original.apply(this, args)
  const base = typeof a === 'object' && !(a instanceof URL) ? a : {}
  const caminho = base.path ?? (a instanceof URL ? a.pathname + a.search : typeof a === 'string' ? new URL(a).pathname + new URL(a).search : '/')
  const cb = args.find((x) => typeof x === 'function')
  const desviado = { ...base, ...(opcoes && opcoes !== base ? opcoes : {}), protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1', port: porta, path: caminho, agent: undefined }
  return http.request(desviado, cb)
}
