import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient as criarCliente, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Fluxo de adicionais ponta a ponta contra o Supabase LOCAL (nunca o remoto):
 * Server Actions e queries de verdade, PostgREST, RLS e funções do banco.
 * Só `createClient` de `@/lib/supabase/server` é trocado pelo cliente do
 * usuário "logado" no passo (sessão de verdade, por e-mail e senha).
 *
 *   supabase start
 *   SUPABASE_E2E_URL=http://127.0.0.1:54321 npx vitest run src/lib/actions/adicionais.e2e.test.ts
 *
 * Sem SUPABASE_E2E_URL o arquivo é pulado (o `npx vitest run` normal não
 * precisa de banco). As chaves padrão são as públicas do `supabase start`;
 * outras podem vir de SUPABASE_E2E_ANON_KEY / SUPABASE_E2E_SERVICE_KEY.
 */

const URL_LOCAL = process.env.SUPABASE_E2E_URL ?? ''
const ANON =
  process.env.SUPABASE_E2E_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE =
  process.env.SUPABASE_E2E_SERVICE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

if (URL_LOCAL && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_LOCAL)) {
  throw new Error(`SUPABASE_E2E_URL precisa ser o Supabase local (recebido: ${URL_LOCAL}).`)
}

const sessao = vi.hoisted(() => ({ atual: null as unknown }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, getAll: () => [] }) }))
vi.mock('next/navigation', () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect(${destino})`)
  },
  notFound: () => {
    throw new Error('notFound()')
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => sessao.atual,
  createPublicClient: () => sessao.atual,
  createAdminClient: () => {
    throw new Error('service role não é usada neste fluxo')
  },
}))

describe.skipIf(!URL_LOCAL)('fluxo de adicionais (Supabase local)', () => {
  // Pulado ou não, o corpo do describe roda na coleta: nada de cliente sem URL.
  const servico = URL_LOCAL
    ? criarCliente(URL_LOCAL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
    : (null as unknown as SupabaseClient)
  const sufixo = Date.now().toString(36)
  const usuarios: Record<'admin' | 'operador' | 'fotografo' | 'cliente', { id: string; cliente: SupabaseClient }> =
    {} as never
  let clienteId = ''
  let copia = ''
  let caixa = ''

  async function criarUsuario(papel: keyof typeof usuarios) {
    const email = `${papel}-${sufixo}@e2e.local`
    const senha = 'senha-e2e-123'
    const { data, error } = await servico.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      app_metadata: { role: papel },
      user_metadata: { nome_completo: `E2E ${papel}`, estudio: 'Estúdio E2E' },
    })
    if (error) throw error
    const cliente = criarCliente(URL_LOCAL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: e2 } = await cliente.auth.signInWithPassword({ email, password: senha })
    if (e2) throw e2
    usuarios[papel] = { id: data.user.id, cliente }
  }

  const como = (papel: keyof typeof usuarios) => {
    sessao.atual = usuarios[papel].cliente
  }

  /** Projeto com a prova liberada: versão 1 aprovada, `laminas` lâminas + capa. */
  async function projetoComProva(nome: string, laminas: number) {
    const { data: p, error } = await servico
      .from('projetos')
      .insert({
        nome: `${nome} ${sufixo}`,
        cliente_id: clienteId,
        fotografo_id: usuarios.fotografo.id,
        status: 'aguardando_aprovacao_cliente',
        laminas_inclusas: 15,
        preco_lamina_extra: 12,
      })
      .select('id')
      .single()
    if (error) throw error
    const { data: v, error: e2 } = await servico
      .from('design_versions')
      .insert({ projeto_id: p.id, numero: 1, status: 'aprovada' })
      .select('id')
      .single()
    if (e2) throw e2
    const { error: e3 } = await servico.from('versoes_laminas').insert(
      Array.from({ length: laminas + 1 }, (_, i) => ({
        versao_id: v.id,
        ordem: i + 1,
        storage_path: `e2e/${p.id}/${i + 1}.jpg`,
        eh_capa: i === 0,
      })),
    )
    if (e3) throw e3
    return p.id as string
  }

  async function statusDoProjeto(id: string) {
    const { data } = await servico.from('projetos').select('status').eq('id', id).single()
    return data?.status
  }

  let acoes: {
    clientApprove: typeof import('./projetos').clientApprove
    fotografoAprovar: typeof import('./prova-fotografo').fotografoAprovar
    decidirAdicional: typeof import('./prova-fotografo').decidirAdicional
    pagarLaminasExtras: typeof import('./faturamento').pagarLaminasExtras
    dispensarCobranca: typeof import('./faturamento').dispensarCobranca
  }
  let consultas: typeof import('@/lib/supabase/queries')

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_LOCAL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON
    for (const papel of ['admin', 'operador', 'fotografo', 'cliente'] as const) await criarUsuario(papel)
    const { data: c, error } = await servico
      .from('clientes')
      .insert({ user_id: usuarios.cliente.id, fotografo_id: usuarios.fotografo.id, nome: 'Casal E2E' })
      .select('id')
      .single()
    if (error) throw error
    clienteId = c.id
    const { data: catalogo } = await servico.from('adicionais').select('id, slug')
    copia = catalogo!.find((a) => a.slug === 'copia-pais-20x20')!.id
    caixa = catalogo!.find((a) => a.slug === 'caixa-acrilica-premium')!.id

    const projetos = await import('./projetos')
    const prova = await import('./prova-fotografo')
    const faturamento = await import('./faturamento')
    acoes = {
      clientApprove: projetos.clientApprove,
      fotografoAprovar: prova.fotografoAprovar,
      decidirAdicional: prova.decidirAdicional,
      pagarLaminasExtras: faturamento.pagarLaminasExtras,
      dispensarCobranca: faturamento.dispensarCobranca,
    }
    consultas = await import('@/lib/supabase/queries')
  }, 30_000)

  afterAll(async () => {
    if (!usuarios.fotografo) return
    // Projetos (e em cascata versões, faturas, itens) e usuários desta rodada.
    await servico.from('projetos').delete().eq('fotografo_id', usuarios.fotografo.id)
    await servico.from('clientes').delete().eq('id', clienteId)
    for (const u of Object.values(usuarios)) await servico.auth.admin.deleteUser(u.id)
  })

  it('casal pede adicional + 2 lâminas extras → estúdio aceita → paga → gráfica vê', async () => {
    const projeto = await projetoComProva('Casamento', 17)

    // 1. O casal vê as ofertas pela revenda (sem custo).
    como('cliente')
    const ofertas = await consultas.getOfertasDaProva(projeto)
    expect(ofertas.map((o) => [o.nome, o.preco])).toEqual([
      ['Cópia para os pais (20×20)', 350],
      ['Caixa acrílica premium', 190],
    ])

    // 2. Aprova com a cópia (×2). Preço enviado pelo navegador é ignorado.
    await acoes.clientApprove(projeto, 1, [{ adicionalId: copia, quantidade: 2, preco: 0.01 } as never])
    expect(await statusDoProjeto(projeto)).toBe('aprovado_aguardando_pagamento')
    await expect(acoes.clientApprove(projeto, 1, [])).rejects.toThrow(/não está aguardando aprovação/)

    // 3. O estúdio vê o fechamento: 2×R$ 12 + 2×R$ 150 (custo).
    como('fotografo')
    const [cobranca] = (await consultas.getCobrancasPendentes()).filter((c) => c.projetoId === projeto)
    expect(cobranca.valorTotal).toBe(324)
    expect(cobranca.laminasVersao).toBe(17)
    const adicional = cobranca.detalhes!.find((i) => i.tipo === 'adicional')!
    expect(adicional).toMatchObject({
      quantidade: 2,
      valorUnitario: 150,
      precoRevendaUnitario: 350,
      origem: 'cliente',
      situacao: 'aguardando_estudio',
    })

    // 4. Pagar antes de decidir é recusado com a mensagem do banco.
    expect(await acoes.pagarLaminasExtras(cobranca.id, 'pix')).toEqual({
      ok: false,
      erro: 'Confirme ou recuse os adicionais pedidos pelo cliente antes de pagar.',
    })

    // 5. Aceita e paga (simulado).
    expect(await acoes.decidirAdicional(adicional.id, true)).toEqual({ ok: true, liberado: false })
    expect(await acoes.decidirAdicional(adicional.id, true)).toEqual({ ok: false, erro: 'Este adicional já foi decidido.' })
    expect(await acoes.pagarLaminasExtras(cobranca.id, 'pix')).toEqual({ ok: true })
    expect(await statusDoProjeto(projeto)).toBe('aprovado')
    expect((await consultas.getCobrancasPendentes()).some((c) => c.projetoId === projeto)).toBe(false)

    // 6. A gráfica (operação) recebe o adicional junto com o álbum.
    como('operador')
    const producao = await consultas.getAdicionaisDeProducao([projeto])
    expect(producao.get(projeto)).toEqual([{ descricao: 'Cópia para os pais (20×20)', quantidade: 2 }])
    const [fatura] = await consultas.getFaturasDoProjeto(projeto)
    expect(fatura).toMatchObject({ statusPagamento: 'pago', formaPagamento: 'pix', valorTotal: 324 })

    // 7. O admin conta a venda no catálogo.
    como('admin')
    const catalogo = await consultas.getAdicionaisAdmin()
    expect(catalogo.find((a) => a.id === copia)!.vendidos).toBeGreaterThanOrEqual(2)
  })

  it('casal pede, estúdio recusa e não há lâmina extra → liberado sem cobrança', async () => {
    const projeto = await projetoComProva('Debutante', 10)
    como('cliente')
    await acoes.clientApprove(projeto, 1, [{ adicionalId: caixa, quantidade: 1 }])

    como('fotografo')
    const [cobranca] = (await consultas.getCobrancasPendentes()).filter((c) => c.projetoId === projeto)
    expect(cobranca.valorTotal).toBe(90)
    expect(await acoes.decidirAdicional(cobranca.detalhes![0].id, false)).toEqual({ ok: true, liberado: true })
    expect(await statusDoProjeto(projeto)).toBe('aprovado')

    como('operador')
    const [fatura] = await consultas.getFaturasDoProjeto(projeto)
    expect(fatura).toMatchObject({ statusPagamento: 'cancelado', valorTotal: 0 })
    expect((await consultas.getAdicionaisDeProducao([projeto])).has(projeto)).toBe(false)
  })

  it('estúdio aprova com adicional próprio → gestão dá cortesia → gráfica produz', async () => {
    const projeto = await projetoComProva('Ensaio', 12)
    como('fotografo')
    const ofertas = await consultas.getOfertasDaProva(projeto)
    expect(ofertas.find((o) => o.id === caixa)).toMatchObject({ preco: 90, precoRevenda: 190 })
    await acoes.fotografoAprovar(projeto, 1, [{ adicionalId: caixa, quantidade: 1 }])
    expect(await statusDoProjeto(projeto)).toBe('aprovado_aguardando_pagamento')
    const [cobranca] = (await consultas.getCobrancasPendentes()).filter((c) => c.projetoId === projeto)
    expect(cobranca.detalhes).toEqual([expect.objectContaining({ origem: 'fotografo', situacao: 'confirmado', valorTotal: 90 })])

    como('admin')
    expect(await acoes.dispensarCobranca(cobranca.id, projeto, 'ok')).toEqual({ ok: false, erro: 'Informe o motivo da cortesia.' })
    expect(await acoes.dispensarCobranca(cobranca.id, projeto, 'Cliente fiel')).toEqual({ ok: true })
    expect(await statusDoProjeto(projeto)).toBe('aprovado')
    expect((await consultas.getAdicionaisDeProducao([projeto])).get(projeto)).toEqual([
      { descricao: 'Caixa acrílica premium', quantidade: 1 },
    ])
  })

  it('outro papel não paga nem decide', async () => {
    const projeto = await projetoComProva('Bodas', 16)
    como('cliente')
    await acoes.clientApprove(projeto, 1, [])
    como('fotografo')
    const [cobranca] = (await consultas.getCobrancasPendentes()).filter((c) => c.projetoId === projeto)
    expect(cobranca.valorTotal).toBe(12)

    como('cliente')
    expect(await acoes.pagarLaminasExtras(cobranca.id, 'pix')).toEqual({
      ok: false,
      erro: 'Só o estúdio dono do projeto paga esta fatura.',
    })
    expect((await acoes.decidirAdicional(cobranca.id, true)).ok).toBe(false)
    expect(await statusDoProjeto(projeto)).toBe('aprovado_aguardando_pagamento')
  })
})
