import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient as criarCliente, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Painel de aprovação do cliente (migration 0039) ponta a ponta contra o
 * Supabase LOCAL (nunca o remoto): Server Actions e queries de verdade,
 * PostgREST (upsert com on_conflict), RLS e triggers. Mesmo esquema de
 * `adicionais.e2e.test.ts`.
 *
 *   supabase start
 *   SUPABASE_E2E_URL=http://127.0.0.1:54321 npx vitest run src/lib/actions/painel-cliente.e2e.test.ts
 *
 * Sem SUPABASE_E2E_URL o arquivo é pulado.
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

describe.skipIf(!URL_LOCAL)('painel de aprovação do cliente (Supabase local)', () => {
  const servico = URL_LOCAL
    ? criarCliente(URL_LOCAL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
    : (null as unknown as SupabaseClient)
  const sufixo = Date.now().toString(36)
  type Papel = 'fotografo' | 'cliente' | 'outroCliente'
  const usuarios: Record<Papel, { id: string; cliente: SupabaseClient }> = {} as never
  const clientes: string[] = []

  async function criarUsuario(papel: Papel) {
    const email = `${papel.toLowerCase()}-painel-${sufixo}@e2e.local`
    const senha = 'senha-e2e-123'
    const { data, error } = await servico.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      app_metadata: { role: papel === 'fotografo' ? 'fotografo' : 'cliente' },
      user_metadata: { nome_completo: `E2E ${papel}`, estudio: 'Estúdio Painel' },
    })
    if (error) throw error
    const cliente = criarCliente(URL_LOCAL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: e2 } = await cliente.auth.signInWithPassword({ email, password: senha })
    if (e2) throw e2
    usuarios[papel] = { id: data.user.id, cliente }
  }

  const como = (papel: Papel) => {
    sessao.atual = usuarios[papel].cliente
  }

  let projeto = ''
  const laminas: string[] = []
  let acoes: {
    marcarLaminaRevisada: typeof import('./painel-cliente').marcarLaminaRevisada
    clientRequestChanges: typeof import('./projetos').clientRequestChanges
    addProofComment: typeof import('./projetos').addProofComment
  }
  let consultas: typeof import('@/lib/supabase/queries')
  let painel: typeof import('@/lib/prova/painel')

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_LOCAL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON
    for (const papel of ['fotografo', 'cliente', 'outroCliente'] as const) await criarUsuario(papel)
    for (const papel of ['cliente', 'outroCliente'] as const) {
      const { data, error } = await servico
        .from('clientes')
        .insert({ user_id: usuarios[papel].id, fotografo_id: usuarios.fotografo.id, nome: `Casal ${papel}` })
        .select('id')
        .single()
      if (error) throw error
      clientes.push(data.id)
    }
    const { data: p, error } = await servico
      .from('projetos')
      .insert({ nome: `Painel ${sufixo}`, cliente_id: clientes[0], fotografo_id: usuarios.fotografo.id, status: 'aguardando_aprovacao_cliente' })
      .select('id')
      .single()
    if (error) throw error
    projeto = p.id
    const { data: v, error: e2 } = await servico
      .from('design_versions')
      .insert({ projeto_id: projeto, numero: 1, status: 'aprovada' })
      .select('id')
      .single()
    if (e2) throw e2
    const { data: ls, error: e3 } = await servico
      .from('versoes_laminas')
      .insert([1, 2, 3].map((ordem) => ({ versao_id: v.id, ordem, storage_path: `e2e/${projeto}/${ordem}.jpg` })))
      .select('id, ordem')
    if (e3) throw e3
    laminas.push(...ls.sort((a, b) => a.ordem - b.ordem).map((l) => l.id as string))

    const painelCliente = await import('./painel-cliente')
    const projetos = await import('./projetos')
    acoes = {
      marcarLaminaRevisada: painelCliente.marcarLaminaRevisada,
      clientRequestChanges: projetos.clientRequestChanges,
      addProofComment: projetos.addProofComment,
    }
    consultas = await import('@/lib/supabase/queries')
    painel = await import('@/lib/prova/painel')
  }, 30_000)

  afterAll(async () => {
    if (!usuarios.fotografo) return
    await servico.from('projetos').delete().eq('fotografo_id', usuarios.fotografo.id)
    await servico.from('clientes').delete().in('id', clientes)
    for (const u of Object.values(usuarios)) await servico.auth.admin.deleteUser(u.id)
  })

  it('checklist: vista, ok, vista não rebaixa o ok, desfazer; outro casal não mexe', async () => {
    como('cliente')
    expect(await acoes.marcarLaminaRevisada(projeto, laminas[0], 'vista')).toEqual({ ok: true, estado: 'vista' })
    expect(await acoes.marcarLaminaRevisada(projeto, laminas[1], 'aprovada')).toEqual({ ok: true, estado: 'aprovada' })
    // Reabrir a lâmina aprovada não a rebaixa para "vista".
    expect((await acoes.marcarLaminaRevisada(projeto, laminas[1], 'vista')).ok).toBe(true)
    expect(await acoes.marcarLaminaRevisada(projeto, laminas[0], 'aprovada')).toEqual({ ok: true, estado: 'aprovada' })
    expect(await acoes.marcarLaminaRevisada(projeto, laminas[0], 'desfazer')).toEqual({ ok: true, estado: 'vista' })

    const revisoes = (await consultas.getRevisoesDasProvas([projeto]))?.get(projeto) ?? []
    expect(revisoes.map((r) => [laminas.indexOf(r.laminaId), r.estado, r.versao]).sort()).toEqual([
      [0, 'vista', 1],
      [1, 'aprovada', 1],
    ])

    como('outroCliente')
    expect(await acoes.marcarLaminaRevisada(projeto, laminas[2], 'aprovada')).toEqual({
      ok: false,
      erro: 'Esta prova não está mais aberta para revisão.',
    })
    expect((await consultas.getRevisoesDasProvas([projeto]))?.get(projeto)).toBeUndefined()

    como('fotografo')
    expect((await consultas.getRevisoesDasProvas([projeto]))?.get(projeto)).toBeUndefined()
  })

  it('marca do estúdio no portal do casal', async () => {
    como('cliente')
    expect(await consultas.getMarcasDoCliente()).toEqual([
      { fotografoId: usuarios.fotografo.id, estudio: 'Estúdio Painel', logoUrl: null },
    ])
  })

  it('"Pedir ajustes" do painel envia o resumo de todos os comentários e fecha o checklist', async () => {
    como('cliente')
    await acoes.addProofComment(projeto, 2, 1, 'Trocar esta foto', { laminaId: laminas[2], x: 10, y: 10, largura: 20, altura: 20 })
    await acoes.addProofComment(projeto, 0, 1, 'Capa mais clara', { laminaId: laminas[0], x: null, y: null })
    const comentarios = await consultas.getProofComments(projeto)
    const resumo = painel.resumoDosAjustes(comentarios, 1)
    expect(resumo).toBe('Lâmina 3 (área 1): Trocar esta foto | Lâmina 1: Capa mais clara')

    await acoes.clientRequestChanges(projeto, 1, resumo)
    const { data } = await servico.from('aprovacoes').select('status, comentario').eq('projeto_id', projeto)
    expect(data).toEqual([{ status: 'alteracao_solicitada', comentario: resumo }])
    const { data: p } = await servico.from('projetos').select('status').eq('id', projeto).single()
    expect(p?.status).toBe('alteracoes_solicitadas')

    // Prova fechada: o checklist congela.
    expect((await acoes.marcarLaminaRevisada(projeto, laminas[2], 'aprovada')).ok).toBe(false)
  })
})
