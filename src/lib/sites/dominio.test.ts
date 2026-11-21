import { describe, expect, it, vi } from 'vitest'
import { dominioValido, nomeRegistroTxt, normalizarDominio, verificarTitularidade, type ResolvedorDns } from './dominio'
import { verificarDominioSite, type ClienteRpc } from './dominio-servico'

const TOKEN = 'seualbum-verificacao=0123456789abcdef0123456789abcdef'
// Resolver de mentira: nenhum teste toca a rede.
const resolvedor = (resposta: string[][] | Error): ResolvedorDns & { resolverTxt: ReturnType<typeof vi.fn> } => ({
  resolverTxt: vi.fn(async () => { if (resposta instanceof Error) throw resposta; return resposta }),
})

describe('normalização e validação de domínio', () => {
  it('normaliza caixa, espaços e ponto final', () => {
    expect(normalizarDominio('  Fotos.Meu-Estudio.com.BR. ')).toBe('fotos.meu-estudio.com.br')
  })
  it.each(['meuestudio.com.br', 'fotos.meuestudio.com', 'a-b.co', 'xn--80ak6aa92e.com'])('aceita %s', (d) => expect(dominioValido(d)).toBe(true))
  it.each(['localhost', 'sem-ponto', 'a b.com', 'http://x.com', 'x.com/caminho', 'x.com:8080', '192.168.0.1', '-x.com', 'x..com', 'site.internal', 'site.local', 'x.test', 'x.example', '', 'a'.repeat(250) + '.com', 42, null])('rejeita %s', (d) => expect(dominioValido(d as string)).toBe(false))
  it('o registro TXT fica em _seualbum-verificacao.{dominio}', () => {
    expect(nomeRegistroTxt('Fotos.Exemplo.com.br.')).toBe('_seualbum-verificacao.fotos.exemplo.com.br')
  })
})

describe('verificação de titularidade por TXT (resolver injetado)', () => {
  it('encontra o token entre os registros e consulta o nome certo', async () => {
    const r = resolvedor([['v=spf1 -all'], [TOKEN]])
    expect(await verificarTitularidade(r, 'fotos.exemplo.com.br', TOKEN)).toEqual({ encontrado: true, registros: ['v=spf1 -all', TOKEN] })
    expect(r.resolverTxt).toHaveBeenCalledWith('_seualbum-verificacao.fotos.exemplo.com.br')
  })
  it('junta os pedaços de um TXT longo (DNS divide em strings de 255)', async () => {
    const r = resolvedor([[TOKEN.slice(0, 20), TOKEN.slice(20)]])
    expect((await verificarTitularidade(r, 'exemplo.com.br', TOKEN)).encontrado).toBe(true)
  })
  it('exige igualdade exata: token parecido ou embutido em outro texto não vale', async () => {
    expect((await verificarTitularidade(resolvedor([[TOKEN + 'x']]), 'exemplo.com.br', TOKEN)).encontrado).toBe(false)
    expect((await verificarTitularidade(resolvedor([['prefixo ' + TOKEN]]), 'exemplo.com.br', TOKEN)).encontrado).toBe(false)
    expect((await verificarTitularidade(resolvedor([['seualbum-verificacao=ffffffffffffffffffffffffffffffff']]), 'exemplo.com.br', TOKEN)).encontrado).toBe(false)
  })
  it('sem registro (NXDOMAIN/ENODATA) é "não encontrado", sem erro de infraestrutura', async () => {
    for (const code of ['ENOTFOUND', 'ENODATA', 'NXDOMAIN']) {
      expect(await verificarTitularidade(resolvedor(Object.assign(new Error('x'), { code })), 'exemplo.com.br', TOKEN)).toEqual({ encontrado: false, registros: [] })
    }
  })
  it('falha de rede/timeout vira dns_indisponivel (não conta como domínio recusado)', async () => {
    const r = await verificarTitularidade(resolvedor(Object.assign(new Error('x'), { code: 'ETIMEOUT' })), 'exemplo.com.br', TOKEN)
    expect(r).toEqual({ encontrado: false, registros: [], erro: 'dns_indisponivel' })
  })
  it('entrada inválida nem chega a consultar o DNS', async () => {
    const r = resolvedor([[TOKEN]])
    expect((await verificarTitularidade(r, 'localhost', TOKEN)).encontrado).toBe(false)
    expect((await verificarTitularidade(r, 'exemplo.com.br', 'token-forjado')).encontrado).toBe(false)
    expect(r.resolverTxt).not.toHaveBeenCalled()
  })
})

describe('fluxo de verificação em dois passos', () => {
  const ID = 'a1000000-0000-4000-8000-000000000001'
  const montar = (opts: { pedido?: { data: unknown; error: { code?: string } | null }; confirmacao?: { data: unknown; error: { code?: string } | null }; dns: string[][] | Error; servicoIndisponivel?: boolean }) => {
    const usuario = { rpc: vi.fn(async () => opts.pedido ?? { data: [{ dominio: 'exemplo.com.br', token: TOKEN, status: 'pendente' }], error: null }) }
    const servicoRpc = { rpc: vi.fn(async () => opts.confirmacao ?? { data: 'verificado', error: null }) }
    const servico = vi.fn(() => { if (opts.servicoIndisponivel) throw new Error('sem chave'); return servicoRpc as unknown as ClienteRpc })
    return { usuario, servicoRpc, servico, deps: { usuario: usuario as unknown as ClienteRpc, servico, resolvedor: resolvedor(opts.dns) } }
  }

  it('o pedido do usuário vem antes da consulta DNS e da atestação', async () => {
    const m = montar({ dns: [[TOKEN]] })
    expect(await verificarDominioSite(m.deps, ID)).toEqual({ ok: true, status: 'verificado' })
    expect(m.usuario.rpc).toHaveBeenCalledWith('preparar_verificacao_dominio', { p_id: ID })
    expect(m.servicoRpc.rpc).toHaveBeenCalledWith('confirmar_verificacao_dominio', { p_id: ID, p_registros: [TOKEN] })
    expect(m.usuario.rpc.mock.invocationCallOrder[0]).toBeLessThan(m.servicoRpc.rpc.mock.invocationCallOrder[0])
  })
  it('sem permissão no passo 1, o cliente de serviço nunca é criado', async () => {
    const m = montar({ pedido: { data: null, error: { code: '42501' } }, dns: [[TOKEN]] })
    expect(await verificarDominioSite(m.deps, ID)).toEqual({ ok: false, erro: 'Você não tem permissão para esta ação.' })
    expect(m.servico).not.toHaveBeenCalled()
    expect(m.deps.resolvedor.resolverTxt).not.toHaveBeenCalled()
  })
  it('já verificado: não consulta DNS nem atesta de novo', async () => {
    const m = montar({ pedido: { data: [{ dominio: 'exemplo.com.br', token: TOKEN, status: 'verificado' }], error: null }, dns: [] })
    expect(await verificarDominioSite(m.deps, ID)).toEqual({ ok: true, status: 'verificado' })
    expect(m.deps.resolvedor.resolverTxt).not.toHaveBeenCalled()
    expect(m.servico).not.toHaveBeenCalled()
  })
  it('registro ausente: atesta com os registros achados e o banco marca como falhou', async () => {
    const m = montar({ dns: [['outra-coisa']], confirmacao: { data: 'falhou', error: null } })
    expect(await verificarDominioSite(m.deps, ID)).toEqual({ ok: true, status: 'falhou', motivo: 'registro_nao_encontrado' })
    expect(m.servicoRpc.rpc).toHaveBeenCalledWith('confirmar_verificacao_dominio', { p_id: ID, p_registros: ['outra-coisa'] })
  })
  it('token certo mas domínio já verificado por outro: motivo dominio_em_uso', async () => {
    const m = montar({ dns: [[TOKEN]], confirmacao: { data: 'falhou', error: null } })
    expect(await verificarDominioSite(m.deps, ID)).toEqual({ ok: true, status: 'falhou', motivo: 'dominio_em_uso' })
  })
  it('DNS indisponível pede nova tentativa e não atesta nada', async () => {
    const m = montar({ dns: Object.assign(new Error('x'), { code: 'ETIMEOUT' }) })
    const r = await verificarDominioSite(m.deps, ID)
    expect(r.ok).toBe(false)
    expect(m.servico).not.toHaveBeenCalled()
  })
  it('ambiente sem chave de serviço responde com mensagem segura', async () => {
    const m = montar({ dns: [[TOKEN]], servicoIndisponivel: true })
    expect(await verificarDominioSite(m.deps, ID)).toEqual({ ok: false, erro: 'Verificação automática indisponível neste ambiente.' })
  })
  it('erro do banco na atestação não vaza detalhe', async () => {
    const m = montar({ dns: [[TOKEN]], confirmacao: { data: null, error: { code: 'XX000' } } })
    const r = await verificarDominioSite(m.deps, ID)
    expect(r).toEqual({ ok: false, erro: 'Não foi possível verificar o domínio agora. Tente de novo.' })
  })
})
