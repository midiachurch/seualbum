#!/usr/bin/env node
/**
 * Verificação de produção depois de um deploy — SÓ LEITURA.
 *
 *   node scripts/verificar-producao.mjs [https://seualbum.vercel.app] [--vercel]
 *
 * Faz apenas requisições sem login e sem efeito colateral: GETs de páginas e
 * chamadas às rotas protegidas SEM credencial (ou com assinatura falsa), que
 * precisam ser recusadas antes de tocar no banco, no R2 ou no Stripe. Nenhum
 * dado real é enviado. Os códigos esperados saem do código de cada rota em
 * `src/app/api/**` e `src/app/auth/callback`.
 *
 * --vercel: roda `npx vercel@50 env ls production` (precisa de `vercel login`
 * e do projeto linkado) e lista quais variáveis OBRIGATÓRIAS da tabela do
 * README estão faltando. Só nomes; nenhum valor é baixado nem impresso.
 *
 * Sai com código 1 se alguma verificação falhar.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const comVercel = args.includes('--vercel')
const base = (args.find((a) => !a.startsWith('--')) ?? 'https://seualbum.vercel.app').replace(/\/+$/, '')
const TIMEOUT_MS = 20_000

/** Faz a requisição sem seguir redirects; devolve status e Location (ou o erro de rede). */
async function chamar(caminho, { method = 'GET', headers = {}, body } = {}) {
  try {
    const res = await fetch(`${base}${caminho}`, {
      method,
      headers: { 'user-agent': 'seualbum-verificar-producao', ...headers },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    await res.arrayBuffer().catch(() => {})
    return { status: res.status, location: res.headers.get('location') ?? '' }
  } catch (e) {
    return { status: 0, erro: e instanceof Error ? e.message : String(e), location: '' }
  }
}

const JSON_VAZIO = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }

/**
 * Cada verificação: `avaliar(r)` devolve null quando passa, ou a explicação da falha.
 */
const verificacoes = [
  {
    nome: 'Home',
    req: ['/'],
    esperado: '200',
    avaliar: (r) => (r.status === 200 ? null : 'a home não abriu'),
  },
  {
    nome: 'Página de login',
    req: ['/auth/login'],
    esperado: '200',
    avaliar: (r) => (r.status === 200 ? null : 'a página de login não abriu'),
  },
  {
    // `dry_run=1`: mesmo que a rota abrisse sem segredo, só contaria — nunca apagaria.
    nome: 'Cron limpar-fotos-r2 sem segredo',
    req: ['/api/cron/limpar-fotos-r2?dry_run=1'],
    esperado: '401/403',
    avaliar: (r) =>
      r.status === 401 || r.status === 403
        ? null
        : r.status === 200
          ? 'a rota ABRIU sem CRON_SECRET (fail-open)'
          : r.status >= 500
            ? 'a rota quebrou antes de checar o segredo'
            : 'resposta inesperada',
  },
  {
    nome: 'Webhook Stripe c/ assinatura falsa',
    req: [
      '/api/webhooks/pagamento',
      { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=0,v1=assinatura_falsa' }, body: '{}' },
    ],
    esperado: '400',
    avaliar: (r) =>
      r.status === 400
        ? null
        : r.status === 503
          ? 'STRIPE_SECRET_KEY e/ou STRIPE_WEBHOOK_SECRET ausentes'
          : r.status === 200
            ? 'aceitou assinatura falsa!'
            : 'resposta inesperada',
  },
  {
    nome: 'Webhook status sem segredo',
    req: ['/api/webhooks/status', JSON_VAZIO],
    esperado: '401',
    avaliar: (r) => (r.status === 401 ? null : r.status === 200 ? 'aceitou chamada sem x-webhook-secret!' : 'resposta inesperada'),
  },
  {
    nome: 'Auth callback sem code',
    req: ['/auth/callback'],
    esperado: '3xx → login?erro=codigo_ausente',
    avaliar: (r) =>
      r.status >= 300 && r.status < 400 && r.location.includes('erro=codigo_ausente')
        ? null
        : r.status >= 500
          ? 'o callback quebrou (Supabase mal configurado?)'
          : 'resposta inesperada',
  },
  ...[
    ['/api/uploads/pedido-foto', 'R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET'],
    ['/api/uploads/pedido-foto/confirmar', 'R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET'],
    ['/api/uploads/midia', 'R2_PUBLIC_BUCKET/R2_PUBLIC_URL (ou as R2_* privadas)'],
    ['/api/uploads/logo', 'R2_PUBLIC_BUCKET/R2_PUBLIC_URL (ou as R2_* privadas)'],
  ].map(([rota, vars]) => ({
    // Estas rotas checam R2 e sessão ANTES de ler o corpo: sem login, 401.
    nome: `Upload ${rota.replace('/api/uploads/', '')} sem sessão`,
    req: [rota, JSON_VAZIO],
    esperado: '401',
    avaliar: (r) =>
      r.status === 401
        ? null
        : r.status === 503
          ? `armazenamento não configurado: falta ${vars} (ou NEXT_PUBLIC_SUPABASE_URL → modo demo)`
          : r.status >= 500
            ? 'erro 500: provável variável do Supabase/R2 faltando'
            : 'resposta inesperada',
  })),
  {
    // Lâmina valida o corpo antes da sessão: `{}` precisa dar 400, não 500.
    nome: 'Upload lamina com corpo vazio',
    req: ['/api/uploads/lamina', JSON_VAZIO],
    esperado: '400',
    avaliar: (r) => (r.status === 400 ? null : r.status >= 500 ? 'a rota quebrou' : 'resposta inesperada'),
  },
]

function tabela(linhas, colunas) {
  const larguras = colunas.map((c, i) => Math.max(c.length, ...linhas.map((l) => String(l[i]).length)))
  const fmt = (l) => l.map((v, i) => String(v).padEnd(larguras[i])).join('  ').trimEnd()
  console.log(fmt(colunas))
  console.log(larguras.map((w) => '-'.repeat(w)).join('  '))
  for (const l of linhas) console.log(fmt(l))
}

/** Nomes das variáveis marcadas como "obrigatória" na tabela do README. */
function variaveisObrigatorias() {
  const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md'), 'utf8')
  return [...readme.matchAll(/^\|\s*`([A-Z0-9_]+)`\s*\|\s*obrigatória\s*\|/gm)].map((m) => m[1])
}

function verificarVercel() {
  console.log('\nVariáveis de ambiente (Vercel, production) — só nomes')
  let obrigatorias
  try {
    obrigatorias = variaveisObrigatorias()
  } catch (e) {
    console.log(`FAIL  não consegui ler o README: ${e instanceof Error ? e.message : e}`)
    return false
  }
  if (obrigatorias.length === 0) {
    console.log('FAIL  nenhuma variável obrigatória encontrada na tabela do README')
    return false
  }

  // A saída é capturada e nunca impressa; `env ls` mostra só nomes (valores vêm como "Encrypted").
  const r = spawnSync('npx', ['--yes', 'vercel@50', 'env', 'ls', 'production'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    shell: process.platform === 'win32',
  })
  if (r.error || r.status !== 0) {
    const motivo = r.error?.message ?? (r.stderr || '').split('\n').find((l) => /error|not|login|link/i.test(l)) ?? `código ${r.status}`
    console.log(`FAIL  \`npx vercel@50 env ls production\` falhou: ${motivo.trim()}`)
    console.log('      Rode `npx vercel@50 login` e `npx vercel@50 link` na raiz do projeto.')
    return false
  }

  const saida = `${r.stdout}\n${r.stderr}`
  const faltando = obrigatorias.filter((nome) => !new RegExp(`(^|\\s)${nome}(\\s|$)`, 'm').test(saida))
  for (const nome of obrigatorias) console.log(`${faltando.includes(nome) ? 'FAIL' : 'PASS'}  ${nome}`)
  if (faltando.length) console.log(`\nFaltando em production: ${faltando.join(', ')}`)
  return faltando.length === 0
}

console.log(`Verificando ${base} (somente leitura)\n`)

const linhas = []
let falhas = 0
for (const v of verificacoes) {
  const r = await chamar(...v.req)
  const problema =
    r.status === 0
      ? `erro de rede: ${r.erro}`
      : r.status === 404 && v.esperado !== '404'
        ? 'rota não existe neste deploy (produção atrás do main?)'
        : v.avaliar(r)
  if (problema) falhas++
  const obtido = r.status === 0 ? '—' : r.location ? `${r.status} → ${r.location.replace(base, '')}` : String(r.status)
  linhas.push([problema ? 'FAIL' : 'PASS', v.nome, v.esperado, obtido, problema ?? ''])
}
tabela(linhas, ['', 'Verificação', 'Esperado', 'Obtido', 'Diagnóstico'])

let vercelOk = true
if (comVercel) vercelOk = verificarVercel()

console.log(`\n${falhas === 0 && vercelOk ? 'Tudo certo.' : `${falhas} verificação(ões) HTTP falharam${vercelOk ? '' : '; variáveis faltando na Vercel'}.`}`)
process.exit(falhas === 0 && vercelOk ? 0 : 1)
