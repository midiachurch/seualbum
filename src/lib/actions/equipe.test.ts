import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), demo: false }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const { adicionarMembroEquipe, removerMembroEquipe } = await import('./equipe')
const org = 'a1000000-0000-4000-8000-000000000001'
const pessoa = 'a2000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: pessoa, error: null })
})

describe('equipe do estúdio', () => {
  it.each([['x', 'a@b.co', 'editor'], [org, 'sem-arroba', 'editor'], [org, 'a@b.co', 'dono'], [org, 'a@b.co', 'superuser'], [org, `${'a'.repeat(260)}@b.co`, 'editor']])(
    'não consulta o banco com entrada inválida (%#)', async (o, e, p) => {
      expect((await adicionarMembroEquipe(o, e, p)).ok).toBe(false)
      expect(mocks.requireUser).not.toHaveBeenCalled()
    })
  it('não grava em demonstração', async () => {
    mocks.demo = true
    expect((await adicionarMembroEquipe(org, 'a@b.co', 'editor')).ok).toBe(false)
    expect((await removerMembroEquipe(org, pessoa)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('envia e-mail aparado e papel; autorização é decidida pelo banco', async () => {
    expect(await adicionarMembroEquipe(org, '  a@b.co ', 'visualizador')).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('adicionar_membro_organizacao', { p_org: org, p_email: 'a@b.co', p_papel: 'visualizador' })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/equipe')
  })
  it('não vaza erro do banco ao negar permissão', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'detalhe interno 42501' } })
    const r = await adicionarMembroEquipe(org, 'a@b.co', 'admin')
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('detalhe interno')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
  it('remoção só confirma quando o banco confirma', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect(await removerMembroEquipe(org, pessoa)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('remover_membro_organizacao', { p_org: org, p_user: pessoa })
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    expect((await removerMembroEquipe(org, pessoa)).ok).toBe(false)
    expect((await removerMembroEquipe('x', pessoa)).ok).toBe(false)
  })
  it('permite retry após falha de rede', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('rede'))
    expect((await adicionarMembroEquipe(org, 'a@b.co', 'editor')).ok).toBe(false)
    expect((await adicionarMembroEquipe(org, 'a@b.co', 'editor')).ok).toBe(true)
  })
})
