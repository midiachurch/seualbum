// Recebe somente configuração/JWTs sintéticos do harness Python via stdin.
const base = 'http://127.0.0.1:3000'
const projeto = (n) => `a2000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const foto = (n) => `a4000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let count = 0
function check(condition, label) {
  if (!condition) throw new Error(label)
  console.log(`ok ${++count} - ${label}`)
}
async function request(path, token, payload) {
  const response = await fetch(base + path, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(3000),
  })
  return { status: response.status, body: await response.json() }
}
let ready = false
for (let n = 0; n < 40; n++) {
  try {
    const result = await request('/', null)
    if (result.status === 200) { ready = true; break }
  } catch { /* Aguarda processo/schema cache local. */ }
  await new Promise((resolve) => setTimeout(resolve, 250))
}
if (!ready) throw new Error('PostgREST não iniciou no namespace isolado')
const favorite = (p, f, value) => ({ p_projeto_id: projeto(p), p_foto_id: foto(f), p_favorita: value })
for (let actor = 1; actor <= 8; actor++) {
  for (const p of [1, 2]) {
    const allowed = (p === 1 ? [1, 3, 5, 7, 8] : [2, 4, 6, 7, 8]).includes(actor)
    const rpc = await request('/rpc/definir_favorito_foto', config.tokens[actor], favorite(p, p, true))
    check(rpc.status === (allowed ? 200 : 403) && (allowed ? rpc.body === true : rpc.body.code === '42501'),
      `ator ${actor} projeto ${p}: RPC ${allowed ? 'permitida' : 'negada'}`)
    const read = await request(`/fotos?select=id,favorita&projeto_id=eq.${projeto(p)}`, config.tokens[actor])
    check(read.status === 200 && read.body.length === (allowed ? 1 : 0),
      `ator ${actor} projeto ${p}: GET respeita RLS`)
  }
}
const mismatch = await request('/rpc/definir_favorito_foto', config.tokens[1], favorite(1, 2, false))
check(mismatch.status === 403 && mismatch.body.code === '42501', 'foto de outro projeto negada')
const unmark = await request('/rpc/definir_favorito_foto', config.tokens[1], favorite(1, 1, false))
check(unmark.status === 200 && unmark.body === true, 'desmarcar retorna sucesso HTTP')
const activities = () => request(`/projeto_atividades?select=id,autor_id,created_at,mensagem&projeto_id=eq.${projeto(1)}&mensagem=like.Favorito%20manual%3A*`, config.tokens[1])
const before = await activities()
check(before.status === 200 && before.body.length === 2 && before.body.every((a) => a.autor_id && a.created_at),
  'histórico registra duas mudanças reais com ator/data')
const retry = await request('/rpc/definir_favorito_foto', config.tokens[1], favorite(1, 1, false))
const after = await activities()
check(retry.status === 200 && after.status === 200 && after.body.length === before.body.length,
  'retry de estado explícito não duplica evento')
const reload = await request(`/fotos?select=id,favorita&id=eq.${foto(1)}`, config.tokens[3])
check(reload.status === 200 && reload.body.length === 1 && reload.body[0].favorita === false,
  'novo GET por cliente recupera estado compartilhado persistido')
const selfie = await request('/rpc/favoritar_fotos', config.tokens[3], { p_projeto_id: projeto(1), p_foto_ids: [foto(1)] })
check(selfie.status === 200 && selfie.body === 1, 'RPC de selfie mantém contrato e marcação')
const recovered = await request(`/fotos?select=favorita&id=eq.${foto(1)}`, config.tokens[1])
check(recovered.status === 200 && recovered.body[0].favorita === true, 'GET recupera favorito alterado pela selfie')
const emptySub = await request('/rpc/definir_favorito_foto', config.noSub, favorite(1, 1, false))
check(emptySub.status === 403 && emptySub.body.code === '42501', 'JWT authenticated sem sub falha fechado')
for (const [label, token] of [['sem token', null], ['JWT anon', config.anon]]) {
  const result = await request('/rpc/definir_favorito_foto', token, favorite(1, 1, false))
  check(result.status === 401 && result.body.code === '42501', `${label}: RPC sem grant negada`)
}
const invalid = await request('/rpc/definir_favorito_foto', config.tokens[1], favorite(1, 1, null))
check(invalid.status === 400 && invalid.body.code === '22023', 'valor null rejeitado via HTTP')
const concurrent = await Promise.all(Array.from({ length: 8 }, () =>
  request('/rpc/definir_favorito_foto', config.tokens[1], favorite(1, 1, false))))
check(concurrent.every((result) => result.status === 200 && result.body === true),
  'oito comandos concorrentes de mesmo estado têm sucesso')
const concurrentHistory = await activities()
const concurrentRead = await request(`/fotos?select=favorita&id=eq.${foto(1)}`, config.tokens[3])
check(concurrentHistory.status === 200 && concurrentHistory.body.length === after.body.length + 1
  && concurrentRead.status === 200 && concurrentRead.body[0].favorita === false,
  'concorrência produz uma mudança/evento e estado persistido')
console.log(`HTTP assertions: ${count}`)
