import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), demo: false }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const { escolherPlanoGaleria } = await import('./franquia-galeria')
const chave = 'a1000000-0000-4000-8000-000000000001'
const idAssinatura = 'a2000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: idAssinatura, error: null })
})

describe('escolha de plano da galeria', () => {
  it.each([['invalida', 'essencial'], [chave, 'Essencial'], [chave, '../x'], [chave, '']])(
    'não consulta o banco com entrada inválida (%s, %s)', async (c, p) => {
      expect((await escolherPlanoGaleria(c, p)).ok).toBe(false)
      expect(mocks.requireUser).not.toHaveBeenCalled()
    })
  it('não grava em demonstração', async () => {
    mocks.demo = true
    expect((await escolherPlanoGaleria(chave, 'essencial')).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('envia só chave e plano; o fotógrafo é determinado pela sessão no servidor', async () => {
    expect(await escolherPlanoGaleria(chave, 'profissional')).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('escolher_plano_galeria', { p_chave: chave, p_plano: 'profissional' })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/galerias')
  })
  it.each([[{ data: null, error: null }], [{ data: false, error: null }], [{ data: null, error: { message: 'detalhe interno' } }]])(
    'não confirma resposta vazia nem erro, e não vaza detalhe', async resposta => {
      mocks.rpc.mockResolvedValue(resposta)
      const resultado = await escolherPlanoGaleria(chave, 'essencial')
      expect(resultado.ok).toBe(false)
      expect(JSON.stringify(resultado)).not.toContain('detalhe interno')
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })
  it('permite retry com a mesma chave após falha de rede', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('rede'))
    expect((await escolherPlanoGaleria(chave, 'essencial')).ok).toBe(false)
    expect((await escolherPlanoGaleria(chave, 'essencial')).ok).toBe(true)
  })
})
