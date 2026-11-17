import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  demo: false,
  rpc: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const { definirFavoritoFoto } = await import('./favoritos')
const projeto = '22000000-0000-4000-8000-000000000001'
const foto = '24000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.demo = false
  mocks.rpc.mockResolvedValue({ data: true, error: null })
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
})

describe('favorito manual por sessão', () => {
  it.each([true, false])('persiste estado explícito %s pela RPC manual', async (favorita) => {
    expect(await definirFavoritoFoto(projeto, foto, favorita)).toEqual({ ok: true })
    expect(mocks.requireUser).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('definir_favorito_foto', {
      p_projeto_id: projeto, p_foto_id: foto, p_favorita: favorita,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/cliente/projetos/${projeto}`)
  })
  it.each([
    ['inválido', foto, true], [projeto, 'novo-1', true],
    [projeto, foto, 'false'], [null, foto, true], [projeto, {}, true],
  ])('rejeita payload inválido antes da sessão', async (p, f, favorita) => {
    expect((await definirFavoritoFoto(p as string, f as string, favorita as boolean)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('demo não declara persistência real', async () => {
    mocks.demo = true
    expect((await definirFavoritoFoto(projeto, foto, true)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('sem cliente de banco falha fechado', async () => {
    mocks.requireUser.mockResolvedValue({ supabase: null })
    expect((await definirFavoritoFoto(projeto, foto, true)).ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('erro de autorização não expõe detalhes do banco nem invalida cache', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'detalhe interno' } })
    expect(await definirFavoritoFoto(projeto, foto, true)).toEqual({ ok: false, erro: 'Sem permissão para alterar esta foto.' })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
  it.each([null, false, 1])('resposta inesperada %s não confirma persistência', async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null })
    expect((await definirFavoritoFoto(projeto, foto, true)).ok).toBe(false)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
  it('falha de rede pode ser tentada novamente com o mesmo estado', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('rede indisponível'))
    expect((await definirFavoritoFoto(projeto, foto, true)).ok).toBe(false)
    expect(await definirFavoritoFoto(projeto, foto, true)).toEqual({ ok: true })
  })
})
