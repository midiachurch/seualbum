import { beforeEach, describe, expect, it, vi } from 'vitest'

const jar = new Map<string, string>()
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), demo: false, set: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n) } : undefined),
    set: (n: string, v: string, o: unknown) => { jar.set(n, v); mocks.set(n, v, o) },
  }),
}))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('server-only', () => ({}))
const acoes = await import('./agendar')
const tentativa = 'a1000000-0000-4000-8000-000000000001'
const reservaId = 'a2000000-0000-4000-8000-000000000002'
const entrada = { slug: 'ensaio', inicio: '2026-11-26T13:00:00+00:00', nome: 'Ana Souza', email: 'Ana@Exemplo.com', telefone: '', tentativa }

beforeEach(() => {
  vi.clearAllMocks(); jar.clear(); mocks.demo = false
  mocks.rpc.mockResolvedValue({ data: { id: reservaId, status: 'hold' }, error: null })
})

describe('agendamento público: criar hold', () => {
  it('rejeita entrada inválida e demonstração sem tocar no banco', async () => {
    expect((await acoes.criarHoldPublico({ ...entrada, email: 'sem-arroba' })).ok).toBe(false)
    expect((await acoes.criarHoldPublico({ ...entrada, nome: 'A' })).ok).toBe(false)
    expect((await acoes.criarHoldPublico({ ...entrada, slug: 'Slug Ruim' })).ok).toBe(false)
    expect((await acoes.criarHoldPublico({ ...entrada, tentativa: 'x' })).ok).toBe(false)
    expect((await acoes.criarHoldPublico({ ...entrada, inicio: 'amanhã' })).ok).toBe(false)
    mocks.demo = true
    expect((await acoes.criarHoldPublico(entrada)).ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('manda só o hash ao banco e guarda o segredo em cookie httpOnly restrito a /agendar', async () => {
    expect(await acoes.criarHoldPublico(entrada)).toEqual({ ok: true, id: reservaId })
    const args = mocks.rpc.mock.calls[0][1]
    expect(args.p_email).toBe('ana@exemplo.com')
    expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/)
    const segredo = jar.get(`agenda_r_${reservaId}`)
    expect(segredo).toMatch(/^[a-f0-9]{64}$/)
    expect(args.p_token_hash).not.toBe(segredo)
    expect(mocks.set).toHaveBeenCalledWith(`agenda_r_${reservaId}`, segredo, expect.objectContaining({ httpOnly: true, path: '/agendar', sameSite: 'lax' }))
  })
  it('repetir a mesma tentativa reaproveita o segredo (idempotente)', async () => {
    await acoes.criarHoldPublico(entrada)
    await acoes.criarHoldPublico(entrada)
    expect(mocks.rpc.mock.calls[1][1].p_token_hash).toBe(mocks.rpc.mock.calls[0][1].p_token_hash)
  })
  it('mensagens amigáveis para conflito e abuso, sem erro interno', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '23P01', message: 'detalhe interno' } })
    const conflito = await acoes.criarHoldPublico(entrada)
    expect(JSON.stringify(conflito)).toMatch(/ocupado/)
    expect(JSON.stringify(conflito)).not.toContain('detalhe interno')
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '54000', message: 'x' } })
    expect(JSON.stringify(await acoes.criarHoldPublico(entrada))).toMatch(/tentativas/)
    expect(jar.size).toBe(0)
  })
  it('exceção de rede vira falha genérica e permite novo clique', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('timeout interno'))
    const r = await acoes.criarHoldPublico(entrada)
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('timeout interno')
    expect((await acoes.criarHoldPublico(entrada)).ok).toBe(true)
  })
})

describe('agendamento público: operar a própria reserva', () => {
  it('sem cookie do segredo não chama o banco', async () => {
    const r = await acoes.confirmarReservaPublica(reservaId)
    expect(r.ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect((await acoes.cancelarReservaPublica('lixo')).ok).toBe(false)
  })
  it('com o segredo, confirma enviando o hash e trata hold expirado como falha', async () => {
    await acoes.criarHoldPublico(entrada)
    mocks.rpc.mockClear()
    mocks.rpc.mockResolvedValueOnce({ data: 'confirmada', error: null })
    expect(await acoes.confirmarReservaPublica(reservaId)).toEqual({ ok: true, status: 'confirmada' })
    expect(mocks.rpc.mock.calls[0][0]).toBe('agenda_confirmar_publica')
    expect(mocks.rpc.mock.calls[0][1].p_token_hash).toMatch(/^[a-f0-9]{64}$/)
    mocks.rpc.mockResolvedValueOnce({ data: 'expirada', error: null })
    expect((await acoes.confirmarReservaPublica(reservaId)).ok).toBe(false)
  })
  it('pagamento tardio do sinal não confirma: informa devolução', async () => {
    await acoes.criarHoldPublico(entrada)
    mocks.rpc.mockResolvedValueOnce({ data: 'reembolso_pendente', error: null })
    const r = await acoes.pagarSinalSimulado(reservaId)
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).toMatch(/devolvido/)
  })
  it('cancelamento fora do prazo mostra a política, não o erro do banco', async () => {
    await acoes.criarHoldPublico(entrada)
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '55000', message: 'Fora do prazo de cancelamento.' } })
    const r = await acoes.cancelarReservaPublica(reservaId)
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).toMatch(/prazo de cancelamento/)
    mocks.rpc.mockResolvedValueOnce({ data: 'cancelada', error: null })
    expect((await acoes.cancelarReservaPublica(reservaId)).ok).toBe(true)
  })
  it('remarcar valida o instante e usa o segredo do cookie', async () => {
    await acoes.criarHoldPublico(entrada)
    expect((await acoes.remarcarReservaPublica(reservaId, 'amanhã')).ok).toBe(false)
    mocks.rpc.mockResolvedValueOnce({ data: '2026-11-27T13:00:00+00:00', error: null })
    expect((await acoes.remarcarReservaPublica(reservaId, '2026-11-27T13:00:00+00:00')).ok).toBe(true)
    expect(mocks.rpc).toHaveBeenLastCalledWith('agenda_remarcar_publica', expect.objectContaining({ p_id: reservaId, p_novo_inicio: '2026-11-27T13:00:00+00:00' }))
  })
  it('lista slots para remarcar só com slug e datas válidos', async () => {
    expect((await acoes.listarSlotsParaRemarcar('Slug Ruim', '2026-11-26', '2026-12-01')).ok).toBe(false)
    mocks.rpc.mockResolvedValueOnce({ data: [{ slot_inicio: 'a', slot_fim: 'b' }], error: null })
    expect(await acoes.listarSlotsParaRemarcar('ensaio', '2026-11-26', '2026-12-01')).toMatchObject({ ok: true })
  })
})
