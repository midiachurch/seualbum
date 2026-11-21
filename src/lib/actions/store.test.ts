import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpcUsuario: vi.fn(), rpcPublico: vi.fn(), rpcAdmin: vi.fn(), requireUser: vi.fn(), revalidatePath: vi.fn(),
  demo: false, sessao: 'a'.repeat(64) as string | null, configurado: true, permitido: true,
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/portal/servidor', () => ({ portalConfigurado: () => mocks.configurado, sessaoPortal: async () => mocks.sessao }))
vi.mock('@/lib/store/pagamento', async () => {
  const real = await vi.importActual<typeof import('@/lib/store/pagamento')>('@/lib/store/pagamento')
  return { ...real, pagamentoSimuladoPermitido: () => mocks.permitido }
})
vi.mock('@/lib/supabase/server', () => ({
  createPublicClient: () => ({ rpc: mocks.rpcPublico }),
  createAdminClient: () => ({ rpc: mocks.rpcAdmin }),
}))
const { salvarProdutoStore, vincularProdutoStore, finalizarCompraStore } = await import('./store')
const U = (n: number) => `a${n}000000-0000-4000-8000-000000000001`
const link = 'c'.repeat(64)
const compra = { chave: U(1), nome: 'Maria', email: 'maria@example.invalid', itens: [{ produtoId: U(2), fotoIds: [U(3)] }] }
const produto = { id: U(4), nome: 'Coleção', tipo: 'colecao_digital', precoCentavos: 9900, comissaoBps: 1000, ativo: true }

beforeEach(() => {
  vi.clearAllMocks(); Object.assign(mocks, { demo: false, sessao: 'a'.repeat(64), configurado: true, permitido: true })
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpcUsuario } })
  mocks.rpcUsuario.mockResolvedValue({ data: U(4), error: null })
  mocks.rpcPublico.mockResolvedValue({ data: { id: U(5), status: 'pendente', total_centavos: 9900 }, error: null })
  mocks.rpcAdmin.mockResolvedValue({ data: { resultado: 'aplicado', status: 'pago' }, error: null })
})

describe('catálogo da Store', () => {
  it.each([
    [{ ...produto, tipo: 'x' }], [{ ...produto, precoCentavos: -1 }], [{ ...produto, precoCentavos: 1.5 }],
    [{ ...produto, comissaoBps: 9000 }], [{ ...produto, nome: 'a' }], [{ ...produto, id: 'x' }], [{ ...produto, ativo: 'sim' as unknown as boolean }],
  ])('não consulta o banco com entrada inválida (%#)', async p => {
    expect((await salvarProdutoStore(U(6), p)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })
  it('envia centavos inteiros e deixa a permissão para o banco', async () => {
    expect(await salvarProdutoStore(U(6), produto)).toEqual({ ok: true })
    expect(mocks.rpcUsuario).toHaveBeenCalledWith('store_salvar_produto', expect.objectContaining({ p_org: U(6), p_preco: 9900, p_comissao_bps: 1000 }))
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/store')
  })
  it('só confirma quando o banco devolve o mesmo id e não vaza erro', async () => {
    mocks.rpcUsuario.mockResolvedValue({ data: null, error: { message: 'detalhe interno' } })
    const r = await salvarProdutoStore(U(6), produto)
    expect(r.ok).toBe(false); expect(JSON.stringify(r)).not.toContain('detalhe interno')
    mocks.rpcUsuario.mockResolvedValue({ data: U(9), error: null })
    expect((await salvarProdutoStore(U(6), produto)).ok).toBe(false)
  })
  it('vincular valida entrada, não grava em demonstração e confirma pelo banco', async () => {
    expect((await vincularProdutoStore('x', U(2), true)).ok).toBe(false)
    mocks.demo = true
    expect((await vincularProdutoStore(U(1), U(2), true)).ok).toBe(false)
    mocks.demo = false; mocks.rpcUsuario.mockResolvedValue({ data: true, error: null })
    expect(await vincularProdutoStore(U(1), U(2), true)).toEqual({ ok: true })
  })
})

describe('compra pelo portal', () => {
  it.each([
    [{ ...compra, chave: 'x' }], [{ ...compra, email: 'sem-arroba' }], [{ ...compra, nome: 'a' }], [{ ...compra, itens: [] }],
    [{ ...compra, itens: [{ produtoId: 'x' }] }], [{ ...compra, itens: [{ produtoId: U(2), quantidade: 0 }] }],
    [{ ...compra, itens: [{ produtoId: U(2), fotoIds: ['x'] }] }], [{ ...compra, desfecho: 'estornado' as unknown as 'pago' }],
  ])('não consulta o banco com entrada inválida (%#)', async c => {
    expect((await finalizarCompraStore(link, c)).ok).toBe(false)
    expect(mocks.rpcPublico).not.toHaveBeenCalled()
  })
  it('nunca envia total: só produtos, quantidades, fotos e o hash do token', async () => {
    await finalizarCompraStore(link, compra)
    const args = mocks.rpcPublico.mock.calls[0][1]
    expect(JSON.stringify(args)).not.toMatch(/total|preco|9900/)
    expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(args.p_sessao_hash).toBe('a'.repeat(64))
  })
  it('falha fechado fora do ambiente que permite pagamento simulado, sem tocar no banco', async () => {
    mocks.permitido = false
    const r = await finalizarCompraStore(link, compra)
    expect(r.ok).toBe(false); expect(mocks.rpcPublico).not.toHaveBeenCalled(); expect(mocks.rpcAdmin).not.toHaveBeenCalled()
  })
  it('sem sessão do portal não cria pedido', async () => {
    mocks.sessao = null
    expect((await finalizarCompraStore(link, compra)).ok).toBe(false); expect(mocks.rpcPublico).not.toHaveBeenCalled()
  })
  it('aplica o evento de pagamento pelo servidor, com o valor do pedido devolvido pelo banco', async () => {
    const r = await finalizarCompraStore(link, compra)
    expect(r).toMatchObject({ ok: true, status: 'pago' })
    expect(mocks.rpcAdmin).toHaveBeenCalledWith('store_aplicar_evento', expect.objectContaining({ p_provedor: 'simulado', p_tipo: 'pago', p_valor: 9900, p_pedido: U(5) }))
    expect((r as { entrega: string }).entrega).toMatch(/^\/loja\/entrega\/[a-f0-9]{64}$/)
  })
  it('retry da mesma compra devolve o MESMO link de entrega', async () => {
    const a = await finalizarCompraStore(link, compra)
    mocks.rpcPublico.mockResolvedValue({ data: { id: U(5), status: 'pago', total_centavos: 9900 }, error: null })
    const b = await finalizarCompraStore(link, compra)
    expect((a as { entrega: string }).entrega).toBe((b as { entrega: string }).entrega)
    expect(mocks.rpcAdmin).toHaveBeenCalledTimes(1)
  })
  it('compra recusada não entrega e mantém o desfecho', async () => {
    mocks.rpcAdmin.mockResolvedValue({ data: { resultado: 'aplicado', status: 'recusado' }, error: null })
    expect(await finalizarCompraStore(link, { ...compra, desfecho: 'recusado' })).toMatchObject({ ok: true, status: 'recusado' })
    expect(mocks.rpcAdmin).toHaveBeenCalledWith('store_aplicar_evento', expect.objectContaining({ p_tipo: 'recusado' }))
  })
  it('erro do banco não vaza e não aplica pagamento', async () => {
    mocks.rpcPublico.mockResolvedValue({ data: null, error: { message: 'detalhe interno' } })
    const r = await finalizarCompraStore(link, compra)
    expect(r.ok).toBe(false); expect(JSON.stringify(r)).not.toContain('detalhe interno'); expect(mocks.rpcAdmin).not.toHaveBeenCalled()
  })
  it('em demonstração não faz nada', async () => {
    mocks.demo = true
    expect((await finalizarCompraStore(link, compra)).ok).toBe(false); expect(mocks.rpcPublico).not.toHaveBeenCalled()
  })
})
