import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), demo: false }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const { criarNegocioStudio, mudarEtapaStudio, atualizarNegocioStudio, vincularProjetoNegocioStudio } = await import('./studio-funil')
const org = 'a1000000-0000-4000-8000-000000000001'
const neg = 'a1000000-0000-4000-8000-000000000002'
const resp = 'a1000000-0000-4000-8000-000000000003'
const entrada = { organizacaoId: org, chave: 'chave-0001-abcd', titulo: 'Casamento Ana', nome: 'Ana Souza', email: 'ana@example.invalid', telefone: '', origem: 'instagram', valor: 4500 }

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: neg, error: null })
})

describe('funil comercial: criar negócio', () => {
  it('valida a forma antes de consultar o banco', async () => {
    for (const ruim of [
      { ...entrada, organizacaoId: 'x' }, { ...entrada, chave: 'curta' }, { ...entrada, titulo: 'a' },
      { ...entrada, origem: 'tiktok' }, { ...entrada, valor: -1 }, { ...entrada, valor: Number.NaN },
      { ...entrada, email: 'sem-arroba' }, { ...entrada, nome: '' }, { ...entrada, clienteId: 'nao-uuid' },
    ]) expect((await criarNegocioStudio(ruim)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('não grava em demonstração', async () => {
    mocks.demo = true
    expect((await criarNegocioStudio(entrada)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('envia a chave de idempotência e o cliente novo; revalida a página', async () => {
    expect(await criarNegocioStudio(entrada)).toEqual({ ok: true, id: neg })
    expect(mocks.rpc).toHaveBeenCalledWith('criar_negocio_studio', expect.objectContaining({
      p_org: org, p_chave: entrada.chave, p_nome: 'Ana Souza', p_cliente_id: null, p_origem: 'instagram', p_valor: 4500,
    }))
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/estudio')
  })
  it('com cliente existente não manda nome (sem segundo cadastro)', async () => {
    await criarNegocioStudio({ ...entrada, nome: '', clienteId: resp })
    expect(mocks.rpc).toHaveBeenCalledWith('criar_negocio_studio', expect.objectContaining({ p_cliente_id: resp, p_nome: null }))
  })
  it('traduz erros conhecidos e esconde detalhes internos', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'Este cliente já tem um negócio em andamento.' } })
    expect(await criarNegocioStudio(entrada)).toEqual({ ok: false, erro: 'Este cliente já tem um negócio em andamento.' })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'detalhe interno' } })
    const r = await criarNegocioStudio(entrada)
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('detalhe interno')
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'relation "x" does not exist' } })
    expect(JSON.stringify(await criarNegocioStudio(entrada))).not.toContain('relation')
    mocks.rpc.mockRejectedValueOnce(new Error('detalhe interno'))
    expect(JSON.stringify(await criarNegocioStudio(entrada))).not.toContain('detalhe interno')
    expect((await criarNegocioStudio(entrada)).ok).toBe(true)
  })
})

describe('funil comercial: etapa', () => {
  it('rejeita etapa inválida, chave curta e perdido sem motivo', async () => {
    expect((await mudarEtapaStudio(neg, 'ganho', 'chave-0001-abcd')).ok).toBe(false)
    expect((await mudarEtapaStudio(neg, 'contato', 'curta')).ok).toBe(false)
    expect(await mudarEtapaStudio(neg, 'perdido', 'chave-0001-abcd')).toEqual({ ok: false, erro: 'Informe o motivo da perda.' })
    expect(await mudarEtapaStudio(neg, 'perdido', 'chave-0001-abcd', 'porque sim')).toEqual({ ok: false, erro: 'Informe o motivo da perda.' })
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('manda a chave e devolve mudou=false como sucesso sem efeito (retry)', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null })
    expect(await mudarEtapaStudio(neg, 'contato', 'chave-0001-abcd')).toEqual({ ok: true, mudou: true })
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null })
    expect(await mudarEtapaStudio(neg, 'contato', 'chave-0001-abcd')).toEqual({ ok: true, mudou: false })
    expect(mocks.rpc).toHaveBeenLastCalledWith('mudar_etapa_negocio_studio', { p_negocio: neg, p_para: 'contato', p_chave: 'chave-0001-abcd', p_motivo: null, p_detalhe: null })
  })
  it('perdido leva motivo e detalhe', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null })
    await mudarEtapaStudio(neg, 'perdido', 'chave-0002-abcd', 'preco', ' achou caro ')
    expect(mocks.rpc).toHaveBeenCalledWith('mudar_etapa_negocio_studio', expect.objectContaining({ p_motivo: 'preco', p_detalhe: 'achou caro' }))
  })
  it('visualizador (permissão negada no banco) recebe mensagem genérica', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'x' } })
    expect(await mudarEtapaStudio(neg, 'contato', 'chave-0001-abcd')).toEqual({ ok: false, erro: 'Você não tem permissão para esta ação.' })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})

describe('funil comercial: dados e projeto', () => {
  it('atualiza com validação e responsável obrigatório', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect((await atualizarNegocioStudio(neg, { titulo: 'Novo', valor: 10, origem: 'site', responsavelId: 'x' })).ok).toBe(false)
    expect((await atualizarNegocioStudio(neg, { titulo: 'Novo', valor: 10, origem: 'site', responsavelId: resp })).ok).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith('atualizar_negocio_studio', expect.objectContaining({ p_responsavel: resp, p_orcamento: null }))
  })
  it('vincula e desvincula projeto', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect((await vincularProjetoNegocioStudio(neg, null)).ok).toBe(true)
    expect((await vincularProjetoNegocioStudio(neg, 'nao-uuid')).ok).toBe(false)
    expect(mocks.rpc).toHaveBeenCalledWith('vincular_projeto_negocio_studio', { p_negocio: neg, p_projeto: null })
  })
})
