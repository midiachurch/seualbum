import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), removerObjetos: vi.fn(), createAdminClient: vi.fn(), adminRpc: vi.fn(), resolverTxt: vi.fn(), demo: false,
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/r2/cliente', () => ({ removerObjetos: mocks.removerObjetos }))
vi.mock('@/lib/sites/dns-node', () => ({ resolvedorDnsNode: () => ({ resolverTxt: mocks.resolverTxt }) }))
const acoes = await import('./sites')

const ID = 'a1000000-0000-4000-8000-000000000001'
const ORG = 'a2000000-0000-4000-8000-000000000002'
const VER = 'a3000000-0000-4000-8000-000000000003'
const CHAVE = 'a4000000-0000-4000-8000-000000000004'
const TOKEN = 'seualbum-verificacao=0123456789abcdef0123456789abcdef'
const docValido = { v: 1, paginas: [{ slug: 'inicio', titulo: 'Início', blocos: [{ id: 'h1', tipo: 'hero', dados: { titulo: 'Olá' } }] }] }

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: 'estudio-a', site_id: ID } }) }) }) })
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc, from: mocks.from } })
  mocks.createAdminClient.mockReturnValue({ rpc: mocks.adminRpc })
  mocks.rpc.mockResolvedValue({ data: true, error: null })
  mocks.removerObjetos.mockResolvedValue(undefined)
})

describe('ações do site: entrada e demonstração', () => {
  it('não consulta o banco com IDs inválidos ou em demonstração', async () => {
    expect((await acoes.publicarSite('x', CHAVE)).ok).toBe(false)
    expect((await acoes.publicarSite(ID, 'não-uuid')).ok).toBe(false)
    expect((await acoes.reverterSite(ID, 'x')).ok).toBe(false)
    expect((await acoes.despublicarSite('x')).ok).toBe(false)
    expect((await acoes.criarSite(ORG, 'Estúdio', 'Slug Inválido!')).ok).toBe(false)
    expect((await acoes.criarSite(ORG, 'A', 'estudio-a')).ok).toBe(false)
    expect((await acoes.adicionarDominioSite(ID, 'localhost')).ok).toBe(false)
    mocks.demo = true
    expect((await acoes.publicarSite(ID, CHAVE)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('rascunho: validação e sanitização no servidor', () => {
  it('rejeita conteúdo inválido sem tocar no banco e devolve os campos com erro', async () => {
    const r = await acoes.salvarRascunhoSite(ID, { v: 1, paginas: [{ slug: 'inicio', titulo: 'x', blocos: [{ id: 'b', tipo: 'iframe', dados: {} }] }] }, 1)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.erros?.length).toBeGreaterThan(0)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('envia ao banco o HTML já sanitizado (script, onerror e javascript: não passam)', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 2, error: null })
    const sujo = { v: 1, paginas: [{ slug: 'inicio', titulo: 'x', blocos: [{ id: 't', tipo: 'texto', dados: { html: '<p onclick="x()">oi</p><script>alert(1)</script><a href="javascript:alert(1)">l</a><img src=x onerror=alert(1)>' } }] }] }
    const r = await acoes.salvarRascunhoSite(ID, sujo, 1)
    expect(r.ok).toBe(true)
    const enviado = JSON.stringify(mocks.rpc.mock.calls[0][1])
    expect(enviado).not.toMatch(/script|onerror|onclick|javascript:|<img/i)
    expect(mocks.rpc).toHaveBeenCalledWith('salvar_site_rascunho', expect.objectContaining({ p_site: ID, p_rev: 1 }))
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/site')
  })
  it('revisão desatualizada vira conflito, sem detalhe interno', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'detalhe interno do postgres' } })
    const r = await acoes.salvarRascunhoSite(ID, docValido, 1)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.conflito).toBe(true)
    expect(JSON.stringify(r)).not.toContain('postgres')
  })
  it('sem permissão no banco: mensagem fixa', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Sem permissão.' } })
    const r = await acoes.salvarRascunhoSite(ID, docValido, 1)
    expect(r).toMatchObject({ ok: false, erro: 'Você não tem permissão para esta ação.' })
  })
  it('falha de rede não expõe erro e permite nova tentativa', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('ECONNRESET segredo'))
    const r = await acoes.salvarRascunhoSite(ID, docValido, 1)
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('segredo')
    mocks.rpc.mockResolvedValueOnce({ data: 2, error: null })
    expect((await acoes.salvarRascunhoSite(ID, docValido, 1)).ok).toBe(true)
  })
})

describe('publicação, rollback e retirada', () => {
  it('publica com chave de idempotência e invalida o cache do site (por slug)', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: VER, error: null })
    expect(await acoes.publicarSite(ID, CHAVE, '  primeira  ')).toEqual({ ok: true, versaoId: VER })
    expect(mocks.rpc).toHaveBeenCalledWith('publicar_site', { p_site: ID, p_chave: CHAVE, p_nota: 'primeira' })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/s/estudio-a', 'layout')
  })
  it('rollback e retirada também invalidam o cache e só confirmam resposta válida', async () => {
    expect((await acoes.reverterSite(ID, VER)).ok).toBe(false) // data: true (não é uuid) não confirma
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    mocks.rpc.mockResolvedValueOnce({ data: VER, error: null })
    expect((await acoes.reverterSite(ID, VER)).ok).toBe(true)
    expect(mocks.rpc).toHaveBeenLastCalledWith('reverter_site_versao', { p_site: ID, p_versao: VER })
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null })
    expect(await acoes.despublicarSite(ID)).toEqual({ ok: true, retirado: true })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/s/estudio-a', 'layout')
  })
  it('trocar o endereço invalida o caminho antigo e o novo', async () => {
    mocks.from.mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: 'antigo' } }) }) }) })
    await acoes.atualizarDadosSite(ID, 'Estúdio', 'estudio-a')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/s/antigo', 'layout')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/s/estudio-a', 'layout')
  })
  it('endereço indisponível chega à tela com a mensagem conhecida', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'Endereço indisponível.' } })
    expect(await acoes.criarSite(ORG, 'Estúdio A', 'estudio-a')).toMatchObject({ ok: false, erro: 'Endereço indisponível.' })
  })
})

describe('mídia do site', () => {
  it('remove o arquivo público só depois do banco aceitar a remoção', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: `sites/${ORG}/x-foto.jpg`, error: null })
    expect((await acoes.removerMidiaSite(ID)).ok).toBe(true)
    expect(mocks.removerObjetos).toHaveBeenCalledWith([`sites/${ORG}/x-foto.jpg`], 'publico')
  })
  it('mídia em uso não é apagada do armazenamento', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'A mídia está em uso no site.' } })
    expect(await acoes.removerMidiaSite(ID)).toMatchObject({ ok: false, erro: 'A mídia está em uso no site.' })
    expect(mocks.removerObjetos).not.toHaveBeenCalled()
  })
})

describe('domínio próprio', () => {
  it('normaliza o domínio antes de ir ao banco', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ id: ID, token: TOKEN }], error: null })
    expect(await acoes.adicionarDominioSite(ID, ' Fotos.Exemplo.com.br. ')).toEqual({ ok: true, id: ID })
    expect(mocks.rpc).toHaveBeenCalledWith('adicionar_site_dominio', { p_site: ID, p_dominio: 'fotos.exemplo.com.br' })
  })
  it('verifica com o DNS mockado: pedido do usuário, consulta e atestação do servidor', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ dominio: 'fotos.exemplo.com.br', token: TOKEN, status: 'pendente' }], error: null })
    mocks.resolverTxt.mockResolvedValueOnce([[TOKEN]])
    mocks.adminRpc.mockResolvedValueOnce({ data: 'verificado', error: null })
    expect(await acoes.verificarDominioSiteAction(ID)).toEqual({ ok: true, status: 'verificado' })
    expect(mocks.resolverTxt).toHaveBeenCalledWith('_seualbum-verificacao.fotos.exemplo.com.br')
    expect(mocks.adminRpc).toHaveBeenCalledWith('confirmar_verificacao_dominio', { p_id: ID, p_registros: [TOKEN] })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/s/estudio-a', 'layout')
  })
  it('sem permissão do usuário, o cliente de serviço não é usado', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    expect((await acoes.verificarDominioSiteAction(ID)).ok).toBe(false)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.adminRpc).not.toHaveBeenCalled()
  })
})
