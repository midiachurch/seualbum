import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), demo: false }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const { criarConviteEquipe, revogarConviteEquipe, aceitarConviteEquipe } = await import('./convites-equipe')
const org = 'a1000000-0000-4000-8000-000000000001'
const conviteId = 'a2000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: conviteId, error: null })
})

describe('convite por link para a equipe', () => {
  it.each([['x', 'a@b.co', 'editor'], [org, 'sem-arroba', 'editor'], [org, 'a@b.co', 'dono'], [org, 'a@b.co', 'x']])(
    'não consulta o banco com entrada inválida (%#)', async (o, e, p) => {
      expect((await criarConviteEquipe(o, e, p)).ok).toBe(false)
      expect(mocks.requireUser).not.toHaveBeenCalled()
    })
  it('gera o segredo no servidor e envia só o hash; devolve o link uma vez', async () => {
    const r = await criarConviteEquipe(org, ' A@B.co ', 'editor')
    expect(r.ok).toBe(true)
    const caminho = (r as { caminho: string }).caminho
    const token = caminho.replace('/dashboard/convite/', '')
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    const args = mocks.rpc.mock.calls[0][1]
    expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(args.p_token_hash).not.toBe(token)
    expect(JSON.stringify(args)).not.toContain(token)
    expect(args).toMatchObject({ p_org: org, p_email: 'A@B.co', p_papel: 'editor' })
  })
  it('cada convite recebe um segredo diferente', async () => {
    const a = await criarConviteEquipe(org, 'a@b.co', 'editor')
    const b = await criarConviteEquipe(org, 'a@b.co', 'editor')
    expect((a as { caminho: string }).caminho).not.toBe((b as { caminho: string }).caminho)
  })
  it('não devolve link quando o banco nega e não vaza detalhe', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'detalhe interno' } })
    const r = await criarConviteEquipe(org, 'a@b.co', 'admin')
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toMatch(/detalhe interno|convite\//)
  })
  it('não grava em demonstração', async () => {
    mocks.demo = true
    expect((await criarConviteEquipe(org, 'a@b.co', 'editor')).ok).toBe(false)
    expect((await revogarConviteEquipe(conviteId)).ok).toBe(false)
    expect((await aceitarConviteEquipe('a'.repeat(64))).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('revogação só confirma quando o banco confirma', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect(await revogarConviteEquipe(conviteId)).toEqual({ ok: true })
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    expect((await revogarConviteEquipe(conviteId)).ok).toBe(false)
    expect((await revogarConviteEquipe('x')).ok).toBe(false)
  })
  it('aceite rejeita token malformado sem consultar e usa mensagem única para qualquer falha', async () => {
    expect((await aceitarConviteEquipe('curto')).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Convite inválido ou expirado.' } })
    const a = await aceitarConviteEquipe('a'.repeat(64))
    mocks.rpc.mockRejectedValueOnce(new Error('rede'))
    const b = await aceitarConviteEquipe('a'.repeat(64))
    expect(a).toEqual(b)
  })
  it('aceite envia o hash, nunca o token', async () => {
    const token = 'b'.repeat(64)
    expect(await aceitarConviteEquipe(token)).toEqual({ ok: true })
    const args = mocks.rpc.mock.calls[0][1]
    expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(args.p_token_hash).not.toBe(token)
  })
})
