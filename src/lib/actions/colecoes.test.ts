import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), demo: false }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const { salvarColecao, removerColecao, definirFotosColecao, definirDownloadGaleria } = await import('./colecoes')
const U = (n: number) => `a${n}000000-0000-4000-8000-000000000001`
const futuro = () => new Date(Date.now() + 86_400_000).toISOString()

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: U(2), error: null })
})

describe('coleções', () => {
  it.each([['x', U(2), 'Nome'], [U(1), 'x', 'Nome'], [U(1), U(2), 'a'], [U(1), U(2), 'a'.repeat(81)]])('não consulta o banco com entrada inválida (%#)', async (p, i, n) => {
    expect((await salvarColecao(p, i, n)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('salva com nome aparado, só confirma se o banco devolve o mesmo id', async () => {
    expect(await salvarColecao(U(1), U(2), '  Cerimônia ')).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('salvar_colecao', { p_id: U(2), p_projeto: U(1), p_nome: 'Cerimônia', p_ordem: 0 })
    mocks.rpc.mockResolvedValue({ data: U(9), error: null })
    expect((await salvarColecao(U(1), U(2), 'Cerimônia')).ok).toBe(false)
  })
  it('não vaza erro do banco', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'detalhe interno 42501' } })
    const r = await salvarColecao(U(1), U(2), 'Cerimônia')
    expect(JSON.stringify(r)).not.toContain('detalhe interno')
  })
  it('remover só confirma quando o banco confirma', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect(await removerColecao(U(1), U(2))).toEqual({ ok: true })
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    expect((await removerColecao(U(1), U(2))).ok).toBe(false)
  })
  it('define fotos como conjunto sem repetidas e limita a 1000', async () => {
    mocks.rpc.mockResolvedValue({ data: 2, error: null })
    expect(await definirFotosColecao(U(1), U(2), [U(3), U(4), U(3)])).toEqual({ ok: true, total: 2 })
    expect(mocks.rpc.mock.calls[0][1].p_foto_ids).toEqual([U(3), U(4)])
    const muitas = Array.from({ length: 1001 }, (_, i) => `b${String(i).padStart(7, '0')}-0000-4000-8000-000000000001`)
    expect((await definirFotosColecao(U(1), U(2), muitas)).ok).toBe(false)
    expect((await definirFotosColecao(U(1), U(2), ['x'])).ok).toBe(false)
  })
  it('em demonstração nada é gravado', async () => {
    mocks.demo = true
    expect((await salvarColecao(U(1), U(2), 'Nome')).ok).toBe(false)
    expect((await removerColecao(U(1), U(2))).ok).toBe(false)
    expect((await definirDownloadGaleria(U(1), true, null, 10)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
})

describe('download da galeria', () => {
  it.each([[true, 0], [true, 5001], [true, 1.5]])('limite inválido não consulta (%#)', async (l, n) => {
    expect((await definirDownloadGaleria(U(1), l, null, n)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('validade no passado ou inválida não consulta', async () => {
    expect((await definirDownloadGaleria(U(1), true, new Date(Date.now() - 1000).toISOString(), 10)).ok).toBe(false)
    expect((await definirDownloadGaleria(U(1), true, 'ontem', 10)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('envia liberação, validade e limite; o banco decide quem pode', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    const quando = futuro()
    expect(await definirDownloadGaleria(U(1), true, quando, 50)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('definir_download_galeria', { p_projeto: U(1), p_liberado: true, p_expira_em: quando, p_limite: 50 })
  })
  it('desligar não exige validade', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect((await definirDownloadGaleria(U(1), false, null, 10)).ok).toBe(true)
  })
})
