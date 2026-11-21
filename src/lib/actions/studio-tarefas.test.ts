import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), demo: false }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const { criarTarefaStudio, atualizarTarefaStudio, mudarStatusTarefaStudio } = await import('./studio-tarefas')
const org = 'b1000000-0000-4000-8000-000000000001'
const tarefa = 'b1000000-0000-4000-8000-000000000002'
const resp = 'b1000000-0000-4000-8000-000000000003'

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: tarefa, error: null })
})

describe('tarefas do estúdio', () => {
  it('valida antes de consultar o banco', async () => {
    const base = { organizacaoId: org, chave: 'chave-0001-abcd', titulo: 'Ligar' }
    for (const ruim of [
      { ...base, organizacaoId: 'x' }, { ...base, chave: 'curta' }, { ...base, titulo: 'a' }, { ...base, prioridade: 'urgente' },
      { ...base, prazo: 'ontem à noite' }, { ...base, responsavelId: 'nao-uuid' }, { ...base, descricao: 'x'.repeat(2001) },
    ]) expect((await criarTarefaStudio(ruim)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('prazo só com data vira fim do dia em Brasília', async () => {
    await criarTarefaStudio({ organizacaoId: org, chave: 'chave-0001-abcd', titulo: 'Ligar', prazo: '2026-11-30' })
    expect(mocks.rpc).toHaveBeenCalledWith('criar_tarefa_studio', expect.objectContaining({ p_prazo: '2026-12-01T02:59:00.000Z', p_prioridade: 'media' }))
  })
  it('sem prazo manda nulo e cria com a chave', async () => {
    expect(await criarTarefaStudio({ organizacaoId: org, chave: 'chave-0001-abcd', titulo: 'Ligar', responsavelId: resp })).toEqual({ ok: true, id: tarefa })
    expect(mocks.rpc).toHaveBeenCalledWith('criar_tarefa_studio', expect.objectContaining({ p_prazo: null, p_responsavel: resp, p_chave: 'chave-0001-abcd' }))
  })
  it('responsável fora da equipe: mensagem segura do banco', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'O responsável precisa ser membro ativo da equipe.' } })
    expect(await criarTarefaStudio({ organizacaoId: org, chave: 'chave-0001-abcd', titulo: 'Ligar', responsavelId: resp }))
      .toEqual({ ok: false, erro: 'O responsável precisa ser membro ativo da equipe.' })
  })
  it('não grava em demonstração', async () => {
    mocks.demo = true
    expect((await criarTarefaStudio({ organizacaoId: org, chave: 'chave-0001-abcd', titulo: 'Ligar' })).ok).toBe(false)
    expect((await mudarStatusTarefaStudio(tarefa, 'concluida')).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('concluir é idempotente: repetir devolve mudou=false', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null })
    expect(await mudarStatusTarefaStudio(tarefa, 'concluida')).toEqual({ ok: true, mudou: true })
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null })
    expect(await mudarStatusTarefaStudio(tarefa, 'concluida')).toEqual({ ok: true, mudou: false })
    expect((await mudarStatusTarefaStudio(tarefa, 'arquivada')).ok).toBe(false)
  })
  it('quem não pode alterar (visualizador, editor em tarefa alheia) recebe negativa genérica', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'interno' } })
    const r = await mudarStatusTarefaStudio(tarefa, 'concluida')
    expect(r).toEqual({ ok: false, erro: 'Você não tem permissão para esta ação.' })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
  it('atualiza com os campos validados', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect((await atualizarTarefaStudio(tarefa, { titulo: 'Novo', responsavelId: 'x', prioridade: 'alta' })).ok).toBe(false)
    expect((await atualizarTarefaStudio(tarefa, { titulo: 'Novo', responsavelId: resp, prioridade: 'alta', prazo: '' })).ok).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith('atualizar_tarefa_studio', expect.objectContaining({ p_prazo: null, p_prioridade: 'alta' }))
  })
  it('falha de rede não vaza detalhe e permite nova tentativa', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('detalhe interno'))
    const r = await mudarStatusTarefaStudio(tarefa, 'concluida')
    expect(JSON.stringify(r)).not.toContain('detalhe interno')
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null })
    expect((await mudarStatusTarefaStudio(tarefa, 'concluida')).ok).toBe(true)
  })
})
