import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), demo: false }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const { marcarNotificacaoSelecaoLida } = await import('./notificacoes-selecao')
const id = 'a1000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: true, error: null })
})

describe('leitura de notificações de seleção', () => {
  it('não consulta o banco com ID inválido ou em demonstração', async () => {
    expect((await marcarNotificacaoSelecaoLida('outro')).ok).toBe(false)
    mocks.demo = true
    expect((await marcarNotificacaoSelecaoLida(id)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('envia apenas o ID para a RPC; destinatário é determinado no servidor', async () => {
    expect(await marcarNotificacaoSelecaoLida(id)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('marcar_notificacao_selecao_lida', { p_id: id })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/galerias')
  })
  it.each([false, null])('não confirma notificação invisível ou resposta vazia (%s)', async data => {
    mocks.rpc.mockResolvedValue({ data, error: null })
    expect((await marcarNotificacaoSelecaoLida(id)).ok).toBe(false)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
  it('não expõe erro interno e permite retry após falha de rede', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('detalhe interno'))
    const resultado = await marcarNotificacaoSelecaoLida(id)
    expect(resultado.ok).toBe(false)
    expect(JSON.stringify(resultado)).not.toContain('detalhe interno')
    expect((await marcarNotificacaoSelecaoLida(id)).ok).toBe(true)
  })
})
