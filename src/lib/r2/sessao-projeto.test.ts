import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), demo: false }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/r2/cliente', () => ({ r2Configurado: () => true, r2PublicoConfigurado: () => true }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'fotografo' } }) }) }) }),
    rpc: mocks.rpc,
  }),
}))
const { projetoParaUpload } = await import('./sessao')
const PROJETO = '22222222-2222-4222-8222-222222222222'
const responder = (ver: unknown, editar: unknown) =>
  mocks.rpc.mockImplementation(async (nome: string) =>
    nome === 'pode_ver_projeto' ? { data: ver, error: null } : { data: editar, error: null })

beforeEach(() => { vi.clearAllMocks(); mocks.demo = false })

describe('projetoParaUpload', () => {
  it('quem já vê o projeto (dono, cliente, equipe) passa sem consultar a organização', async () => {
    responder(true, false)
    expect((await projetoParaUpload(PROJETO)).ok).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
  it('editor da organização passa pela regra da organização', async () => {
    responder(false, true)
    expect((await projetoParaUpload(PROJETO)).ok).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith('pode_editar_projeto_org', { p_projeto: PROJETO })
  })
  it('visualizador (lê, não edita) recebe 404, sem revelar que o projeto existe', async () => {
    responder(false, false)
    const r = await projetoParaUpload(PROJETO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.resposta.status).toBe(404)
  })
  it('erro do banco em qualquer consulta nega', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    const r = await projetoParaUpload(PROJETO)
    expect(r.ok).toBe(false)
    mocks.rpc.mockImplementation(async (n: string) => n === 'pode_ver_projeto' ? { data: false, error: null } : { data: null, error: { message: 'x' } })
    expect((await projetoParaUpload(PROJETO)).ok).toBe(false)
  })
  it('em demonstração não abre a porta', async () => {
    mocks.demo = true
    expect((await projetoParaUpload(PROJETO)).ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
