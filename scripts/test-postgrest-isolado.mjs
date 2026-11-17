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

// Portal sem cadastro: HTTP anon usa capacidade explícita, não um JWT de usuário fictício.
const linkHash = '1'.repeat(64), sessaoHash = '2'.repeat(64)
const gerir = (p, revogar=false) => ({p_projeto_id:projeto(p),p_link_hash:linkHash,p_codigo:'12345678',p_revogar:revogar})
let result = await request('/rpc/gerir_portal',config.tokens[2],gerir(1))
check(result.status===403,'outro fotógrafo não concede portal')
result = await request('/rpc/gerir_portal',config.tokens[1],gerir(1))
check(result.status===200 && typeof result.body==='string','fotógrafo dono concede portal via HTTP')
result = await request('/rpc/abrir_portal',null,{p_link_hash:linkHash,p_codigo:'00000000',p_sessao_hash:sessaoHash})
check(result.status===200 && result.body===false,'login errado falha sem abortar contador')
result = await request('/rpc/abrir_portal',null,{p_link_hash:linkHash,p_codigo:'12345678',p_sessao_hash:sessaoHash})
check(result.status===200 && result.body===true,'cliente sem conta abre sessão por código')
result = await request('/rpc/portal_projeto',null,{p_sessao_hash:sessaoHash})
check(result.status===200 && result.body.id===projeto(1) && result.body.fotos.length===1,'capacidade retorna só projeto/fotos concedidos')
check(!('storage_path' in result.body.fotos[0]),'resumo portal não retorna chave privada')
result = await request('/rpc/portal_foto',null,{p_sessao_hash:sessaoHash,p_foto_id:foto(2)})
check(result.status===401 && result.body.code==='42501','capacidade não atravessa projeto na leitura de imagem')
result = await request('/rpc/portal_projeto',null,{p_sessao_hash:'3'.repeat(64)})
check(result.status===401 && result.body.code==='42501','capacidade inventada falha fechado')
result = await request('/rpc/portal_favorito',null,{p_sessao_hash:sessaoHash,p_foto_id:foto(1),p_favorita:true})
check(result.status===200 && result.body===true,'portal grava favorito por RPC sem acesso geral')
const entregaPayload={p_sessao_hash:sessaoHash,p_foto_ids:[foto(1)],p_revisao:0,p_chave:'a5000000-0000-4000-8000-000000000001'}
result = await request('/rpc/portal_entregar',null,entregaPayload)
check(result.status===200 && result.body.revisao===1 && result.body.total===1,'portal entrega snapshot real via HTTP')
const entregaId=result.body.id
result = await request('/rpc/portal_entregar',null,entregaPayload)
check(result.status===200 && result.body.id===entregaId,'retry HTTP retorna snapshot único')
result = await request('/rpc/portal_projeto',null,{p_sessao_hash:sessaoHash})
check(result.status===200 && result.body.eventos.filter((e)=>e.tipo==='selecao_entregue').length===1,'timeline HTTP não duplica entrega')
result = await request(`/selecoes_entregues?select=id&id=eq.${entregaId}`,config.tokens[2])
check(result.status===200 && result.body.length===0,'outro fotógrafo não lê snapshot por tabela')
result = await request(`/selecao_entregue_fotos?select=foto_id&selecao_id=eq.${entregaId}`,config.tokens[1])
check(result.status===200 && result.body.length===1,'dono recupera itens entregues por RLS')
result = await request('/rpc/gerir_portal',config.tokens[1],gerir(1,true))
check(result.status===200,'revogar portal via HTTP')
result = await request('/rpc/portal_projeto',null,{p_sessao_hash:sessaoHash})
check(result.status===401 && result.body.code==='42501','sessão já emitida não lê após revogação')
result = await request('/rpc/portal_favorito',null,{p_sessao_hash:sessaoHash,p_foto_id:foto(1),p_favorita:false})
check(result.status===401 && result.body.code==='42501','sessão revogada não altera favorito')
result = await request('/rpc/portal_entregar',null,{...entregaPayload,p_chave:'a5000000-0000-4000-8000-000000000002',p_revisao:1})
check(result.status===401 && result.body.code==='42501','sessão revogada não entrega seleção')
console.log(`HTTP assertions total: ${count}`)
