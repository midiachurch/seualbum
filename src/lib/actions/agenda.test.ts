import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(), demo: false }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
const acoes = await import('./agenda')
const org = 'a1000000-0000-4000-8000-000000000001'
const rec = 'a2000000-0000-4000-8000-000000000002'
const res = 'a3000000-0000-4000-8000-000000000003'
const inicio = '2026-11-26T13:00:00+00:00'

const dados = {
  nome: 'Ensaio', slug: 'ensaio', tipo: 'pessoa', descricao: '', fuso: 'America/Sao_Paulo', duracaoMin: 60, bufferMin: 15, intervaloMin: 30,
  antecedenciaMinMin: 120, antecedenciaMaxDias: 60, cancelamentoAntecedenciaH: 24, sinalCentavos: null, publicado: true,
}

beforeEach(() => {
  vi.clearAllMocks(); mocks.demo = false
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
  mocks.rpc.mockResolvedValue({ data: true, error: null })
})

describe('agenda do estúdio: validação de entrada', () => {
  it('não consulta o banco com ids ou campos inválidos nem em demonstração', async () => {
    expect((await acoes.salvarRecursoAgenda('x', null, dados)).ok).toBe(false)
    expect((await acoes.salvarRecursoAgenda(org, null, { ...dados, slug: 'Slug Ruim' })).ok).toBe(false)
    expect((await acoes.salvarRecursoAgenda(org, null, { ...dados, duracaoMin: 3 })).ok).toBe(false)
    expect((await acoes.salvarRecursoAgenda(org, null, { ...dados, tipo: 'robo' })).ok).toBe(false)
    expect((await acoes.confirmarReservaEstudio('nao-e-uuid')).ok).toBe(false)
    expect((await acoes.reservarPeloEstudio(rec, 'amanhã', 'Ana Souza', 'ana@exemplo.com', '')).ok).toBe(false)
    expect((await acoes.criarBloqueioAgenda(rec, inicio, '2026-11-26T12:00:00+00:00', '')).ok).toBe(false)
    expect((await acoes.definirDisponibilidadeAgenda(rec, [{ dia: 1, inicio: '10:00', fim: '09:00' }])).ok).toBe(false)
    mocks.demo = true
    expect((await acoes.confirmarReservaEstudio(res)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
})

describe('agenda do estúdio: chamadas ao banco', () => {
  it('salva recurso enviando campos normalizados e revalida a página', async () => {
    mocks.rpc.mockResolvedValue({ data: rec, error: null })
    expect(await acoes.salvarRecursoAgenda(org, null, { ...dados, slug: ' Ensaio ', descricao: '  ' })).toEqual({ ok: true, id: rec })
    expect(mocks.rpc).toHaveBeenCalledWith('agenda_salvar_recurso', expect.objectContaining({ p_org: org, p_id: null, p_slug: 'ensaio', p_descricao: null, p_sinal_centavos: null }))
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/agenda')
  })
  it('reserva pelo estúdio sem mandar a chave em claro e com e-mail em minúsculas', async () => {
    mocks.rpc.mockResolvedValue({ data: res, error: null })
    expect(await acoes.reservarPeloEstudio(rec, inicio, 'Ana Souza', 'Ana@Exemplo.com', '')).toEqual({ ok: true, id: res })
    const args = mocks.rpc.mock.calls[0][1]
    expect(args.p_email).toBe('ana@exemplo.com')
    expect(args.p_telefone).toBeNull()
    expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/)
  })
  it('mapeia conflito de horário e falta de permissão sem expor erro interno', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '23P01', message: 'detalhe interno do banco' } })
    const conflito = await acoes.reservarPeloEstudio(rec, inicio, 'Ana Souza', 'ana@exemplo.com', '')
    expect(conflito).toMatchObject({ ok: false })
    expect(JSON.stringify(conflito)).toMatch(/ocupado/)
    expect(JSON.stringify(conflito)).not.toContain('detalhe interno')
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Sem permissão.' } })
    expect(JSON.stringify(await acoes.cancelarReservaEstudio(res, ''))).toMatch(/permissão/)
  })
  it('confirmar devolve falha quando o hold já expirou (estado que persiste no banco)', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 'expirada', error: null })
    const r = await acoes.confirmarReservaEstudio(res)
    expect(r.ok).toBe(false)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    mocks.rpc.mockResolvedValueOnce({ data: 'confirmada', error: null })
    expect((await acoes.confirmarReservaEstudio(res)).ok).toBe(true)
  })
  it('cancelar envia só motivo aparado e vazio vira nulo', async () => {
    mocks.rpc.mockResolvedValue({ data: 'cancelada', error: null })
    expect((await acoes.cancelarReservaEstudio(res, '  ')).ok).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith('agenda_cancelar', { p_id: res, p_motivo: null })
  })
  it('remarcar, concluir, vincular, sinal e reembolso chamam a RPC certa', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: inicio, error: null })
    expect((await acoes.remarcarReservaEstudio(res, inicio)).ok).toBe(true)
    expect(mocks.rpc).toHaveBeenLastCalledWith('agenda_remarcar', { p_id: res, p_novo_inicio: inicio })
    mocks.rpc.mockResolvedValueOnce({ data: 'concluida', error: null })
    expect((await acoes.concluirReservaEstudio(res)).ok).toBe(true)
    mocks.rpc.mockResolvedValueOnce({ data: rec, error: null })
    expect((await acoes.vincularClienteReserva(res)).ok).toBe(true)
    expect(mocks.rpc).toHaveBeenLastCalledWith('agenda_vincular_cliente', { p_id: res })
    mocks.rpc.mockResolvedValueOnce({ data: 'confirmada', error: null })
    expect((await acoes.registrarSinalEstudio(res)).ok).toBe(true)
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null })
    expect((await acoes.registrarReembolsoEstudio(res)).ok).toBe(true)
  })
  it('não vaza exceção de rede e permite retry', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('segredo interno'))
    const r = await acoes.concluirReservaEstudio(res)
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('segredo interno')
    mocks.rpc.mockResolvedValueOnce({ data: 'concluida', error: null })
    expect((await acoes.concluirReservaEstudio(res)).ok).toBe(true)
  })
  it('lista slots do estúdio validando datas', async () => {
    expect((await acoes.listarSlotsEstudio(rec, 'hoje', '2026-12-01')).ok).toBe(false)
    mocks.rpc.mockResolvedValueOnce({ data: [{ slot_inicio: inicio, slot_fim: inicio }], error: null })
    expect(await acoes.listarSlotsEstudio(rec, '2026-11-26', '2026-12-01')).toMatchObject({ ok: true })
  })
})
