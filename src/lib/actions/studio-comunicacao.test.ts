import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), demo: false }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const acoes = await import('./studio-comunicacao')
const org = 'c1000000-0000-4000-8000-000000000001'
const modelo = 'c1000000-0000-4000-8000-000000000002'
const cliente = 'c1000000-0000-4000-8000-000000000003'
const item = 'c1000000-0000-4000-8000-000000000004'
const modeloValido = { organizacaoId: org, nome: 'Proposta', finalidade: 'livre', canal: 'email', assunto: 'Olá {{cliente_primeiro_nome}}', corpo: 'Proposta de {{valor}}', ativo: true }

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: modelo, error: null })
})

describe('modelos de mensagem', () => {
  it('rejeita variável fora da lista, canal e finalidade inválidos sem tocar no banco', async () => {
    for (const ruim of [
      { ...modeloValido, corpo: 'Olá {{senha}}' }, { ...modeloValido, canal: 'sms' }, { ...modeloValido, finalidade: 'spam' },
      { ...modeloValido, nome: 'a' }, { ...modeloValido, corpo: '   ' }, { ...modeloValido, assunto: '{{ quebrado' },
    ]) expect((await acoes.salvarModeloStudio(ruim)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('salva modelo válido', async () => {
    expect(await acoes.salvarModeloStudio(modeloValido)).toEqual({ ok: true, id: modelo })
    expect(mocks.rpc).toHaveBeenCalledWith('salvar_modelo_studio', expect.objectContaining({ p_org: org, p_id: null, p_canal: 'email' }))
  })
  it('nome repetido mostra a mensagem segura do banco', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'Já existe um modelo com este nome.' } })
    expect(await acoes.salvarModeloStudio(modeloValido)).toEqual({ ok: false, erro: 'Já existe um modelo com este nome.' })
  })
})

describe('prévia: nunca envia', () => {
  it('só chama a RPC de renderização', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ assunto: 'Olá Ana', corpo: 'x', faltando: [] }], error: null })
    const r = await acoes.previaModeloStudio(org, modelo, cliente, null)
    expect(r.ok && r.previa.assunto).toBe('Olá Ana')
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('renderizar_modelo_studio', { p_org: org, p_modelo: modelo, p_cliente: cliente, p_negocio: null })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
  it('resposta vazia vira erro, ids inválidos não chegam ao banco', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null })
    expect((await acoes.previaModeloStudio(org, modelo)).ok).toBe(false)
    expect((await acoes.previaModeloStudio('x', modelo)).ok).toBe(false)
  })
})

describe('fila de saída (envio externo desligado)', () => {
  it('enfileirar manda a chave de idempotência e não usa canal desconhecido', async () => {
    mocks.rpc.mockResolvedValue({ data: item, error: null })
    expect((await acoes.enfileirarMensagemStudio({ organizacaoId: org, chave: 'chave-0001-abcd', canal: 'sms', clienteId: cliente, modeloId: modelo })).ok).toBe(false)
    expect(await acoes.enfileirarMensagemStudio({ organizacaoId: org, chave: 'chave-0001-abcd', canal: 'email', clienteId: cliente, modeloId: modelo })).toEqual({ ok: true, id: item })
    expect(mocks.rpc).toHaveBeenCalledWith('enfileirar_mensagem_studio', expect.objectContaining({ p_chave: 'chave-0001-abcd', p_modelo: modelo, p_corpo: null }))
  })
  it('texto livre exige corpo e variáveis conhecidas', async () => {
    const base = { organizacaoId: org, chave: 'chave-0002-abcd', canal: 'email', clienteId: cliente }
    expect((await acoes.enfileirarMensagemStudio({ ...base, corpo: '' })).ok).toBe(false)
    expect((await acoes.enfileirarMensagemStudio({ ...base, corpo: 'Oi {{xyz}}' })).ok).toBe(false)
    mocks.rpc.mockResolvedValueOnce({ data: item, error: null })
    expect((await acoes.enfileirarMensagemStudio({ ...base, corpo: 'Oi {{cliente_nome}}', assunto: 'Olá' })).ok).toBe(true)
  })
  it('cliente descadastrado: mensagem segura', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'O cliente optou por não receber neste canal.' } })
    expect(await acoes.enfileirarMensagemStudio({ organizacaoId: org, chave: 'chave-0003-abcd', canal: 'email', clienteId: cliente, modeloId: modelo }))
      .toEqual({ ok: false, erro: 'O cliente optou por não receber neste canal.' })
  })
  it('processar usa só o adaptador registro e devolve resumo simulado', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [{ id: item, canal: 'email', destinatario: 'a@example.invalid', assunto: '', corpo: 'x', tentativas: 1 }], error: null })
      .mockResolvedValueOnce({ data: 'enviada', error: null })
    const r = await acoes.processarFilaStudio(org)
    expect(r).toEqual({ ok: true, resumo: { reservadas: 1, simuladas: 1, falhas: 0, ignoradas: 0 } })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'concluir_outbox_studio', { p_id: item, p_ok: true, p_adaptador: 'registro', p_erro: null })
  })
  it('processar sem permissão não vaza detalhe', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'interno' } })
    const r = await acoes.processarFilaStudio(org)
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('interno')
  })
  it('cancelar e reenfileirar: false do banco vira negativa legível', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    expect((await acoes.cancelarSaidaStudio(item)).ok).toBe(false)
    expect((await acoes.reenfileirarSaidaStudio(item)).ok).toBe(false)
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect((await acoes.cancelarSaidaStudio(item)).ok).toBe(true)
  })
  it('automações só devolvem contagens de itens gerados', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { lembretes_tarefa: 2, followups_proposta: 1 }, error: null })
    expect(await acoes.rodarAutomacoesStudio(org)).toEqual({ ok: true, lembretes: 2, followups: 1 })
    expect(mocks.rpc).toHaveBeenCalledWith('rodar_automacoes_studio', { p_org: org })
  })
  it('descadastro e prazo de follow-up validam entrada', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect((await acoes.definirOptoutStudio(org, cliente, 'sms', true)).ok).toBe(false)
    expect((await acoes.definirOptoutStudio(org, cliente, 'email', true)).ok).toBe(true)
    expect((await acoes.definirFollowupDiasStudio(org, 0)).ok).toBe(false)
    expect((await acoes.definirFollowupDiasStudio(org, 61)).ok).toBe(false)
    expect((await acoes.definirFollowupDiasStudio(org, 2.5)).ok).toBe(false)
  })
  it('em demonstração nada chega ao banco', async () => {
    mocks.demo = true
    expect((await acoes.processarFilaStudio(org)).ok).toBe(false)
    expect((await acoes.rodarAutomacoesStudio(org)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
})
