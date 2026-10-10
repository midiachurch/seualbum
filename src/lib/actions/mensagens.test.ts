import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server Actions das mensagens (0037) com o Supabase simulado: validação no
 * servidor antes de qualquer chamada ao banco, o que vai para o banco e como
 * os erros voltam. O acesso de verdade (RLS) é coberto pelo pgTAP
 * `supabase/tests/mensagens.test.sql`.
 */

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Chamada = { tabela: string; operacao: string; dados?: unknown; filtros: [string, string, unknown][] }
type Resposta = { data?: unknown; error?: { message: string; code?: string } | null }

const banco = vi.hoisted(() => ({
  chamadas: [] as Chamada[],
  rpcs: [] as { nome: string; args: unknown }[],
  responder: (() => ({ data: null, error: null })) as (c: Chamada) => Resposta,
  responderRpc: (() => ({ data: null, error: null })) as (nome: string, args: unknown) => Resposta,
  papel: 'fotografo' as string,
}))

function consulta(tabela: string) {
  const c: Chamada = { tabela, operacao: 'select', filtros: [] }
  const resolver = () => {
    banco.chamadas.push(c)
    return Promise.resolve({ error: null, ...banco.responder(c) })
  }
  const q: Record<string, unknown> = {
    select: () => q,
    insert: (dados: unknown) => ((c.operacao = 'insert'), (c.dados = dados), q),
    update: (dados: unknown) => ((c.operacao = 'update'), (c.dados = dados), q),
    eq: (col: string, v: unknown) => (c.filtros.push(['eq', col, v]), q),
    neq: (col: string, v: unknown) => (c.filtros.push(['neq', col, v]), q),
    lt: (col: string, v: unknown) => (c.filtros.push(['lt', col, v]), q),
    is: (col: string, v: unknown) => (c.filtros.push(['is', col, v]), q),
    order: () => q,
    limit: (n: number) => (c.filtros.push(['limit', '', n]), q),
    maybeSingle: resolver,
    single: resolver,
    then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => resolver().then(ok, erro),
  }
  return q
}

const supabase = {
  from: (tabela: string) => consulta(tabela),
  rpc: async (nome: string, args: unknown) => {
    banco.rpcs.push({ nome, args })
    return { error: null, ...banco.responderRpc(nome, args) }
  },
}

vi.mock('@/lib/supabase/queries', () => ({
  requireUser: async () => ({ supabase, user: { id: 'u-eu' }, profile: { role: banco.papel } }),
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://teste.supabase.co'

const { abrirConversa, apagarMensagem, contarNaoLidas, enviarMensagem, listarConversas, listarMensagens, marcarComoLida } =
  await import('./mensagens')

const CONVERSA = '11111111-1111-4111-8111-111111111111'
const PROJETO = '22222222-2222-4222-8222-222222222222'
const LAMINA = '33333333-3333-4333-8333-333333333333'

function linha(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    conversa_id: CONVERSA,
    autor_id: 'u-outro',
    autor_nome: 'Estúdio Um',
    autor_papel: 'fotografo',
    tipo: 'texto',
    corpo: `mensagem ${n}`,
    lamina_id: null,
    versao_id: null,
    created_at: `2026-10-09T10:0${n}:00+00:00`,
    apagada_em: null,
    apagada_por: null,
    ...extra,
  }
}

beforeEach(() => {
  banco.chamadas = []
  banco.rpcs = []
  banco.responder = () => ({ data: null })
  banco.responderRpc = () => ({ data: null })
  banco.papel = 'fotografo'
})

describe('enviarMensagem', () => {
  it('manda só conversa, texto aparado, lâmina e o próprio id (o banco força o resto)', async () => {
    banco.responder = (c) => (c.operacao === 'insert' ? { data: linha(1, { autor_id: 'u-eu', corpo: 'Oi' }) } : { data: null })
    const r = await enviarMensagem({ conversaId: CONVERSA, corpo: '  Oi  ', laminaId: LAMINA })
    expect(r).toMatchObject({ ok: true, mensagem: { corpo: 'Oi', autorId: 'u-eu', apagada: false } })
    expect(banco.chamadas[0]).toMatchObject({
      tabela: 'mensagens',
      operacao: 'insert',
      dados: { conversa_id: CONVERSA, corpo: 'Oi', autor_id: 'u-eu', lamina_id: LAMINA },
    })
  })

  it.each([
    [{ conversaId: 'x', corpo: 'oi' }, 'Conversa inválida.'],
    [{ conversaId: CONVERSA, corpo: '   ' }, 'Escreva uma mensagem.'],
    [{ conversaId: CONVERSA, corpo: 'a'.repeat(4001) }, /passa de 4000/],
    [{ conversaId: CONVERSA, corpo: 42 as unknown as string }, 'Mensagem inválida.'],
    [{ conversaId: CONVERSA, corpo: 'oi', laminaId: '../x' }, 'Lâmina inválida.'],
  ])('recusa entrada inválida sem tocar no banco (%#)', async (entrada, erro) => {
    const r = await enviarMensagem(entrada)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(erro)
    expect(banco.chamadas).toEqual([])
  })

  it('RLS recusou: mensagem de acesso, sem vazar o erro do banco', async () => {
    banco.responder = () => ({ error: { message: 'new row violates row-level security policy', code: '42501' } })
    expect(await enviarMensagem({ conversaId: CONVERSA, corpo: 'oi' })).toEqual({ ok: false, erro: 'Você não tem acesso a esta conversa.' })
  })

  it('erro de regra do banco (check) volta com o texto dele', async () => {
    banco.responder = () => ({ error: { message: 'Lâmina fora deste projeto', code: '23514' } })
    expect(await enviarMensagem({ conversaId: CONVERSA, corpo: 'oi', laminaId: LAMINA })).toEqual({ ok: false, erro: 'Lâmina fora deste projeto' })
  })

  it('erro inesperado vira mensagem genérica', async () => {
    banco.responder = () => ({ error: { message: 'connection reset', code: '08006' } })
    const r = await enviarMensagem({ conversaId: CONVERSA, corpo: 'oi' })
    expect(r).toEqual({ ok: false, erro: 'Não foi possível concluir agora. Tente de novo.' })
  })
})

describe('abrirConversa', () => {
  it('chama abrir_conversa com o canal e o projeto', async () => {
    banco.responderRpc = () => ({ data: CONVERSA })
    expect(await abrirConversa({ canal: 'cliente_estudio', projetoId: PROJETO })).toEqual({ ok: true, conversaId: CONVERSA })
    expect(banco.rpcs).toEqual([
      { nome: 'abrir_conversa', args: { p_canal: 'cliente_estudio', p_fotografo_id: null, p_projeto_id: PROJETO } },
    ])
  })

  it('valida canal, ids e exige projeto no fio do cliente', async () => {
    expect((await abrirConversa({ canal: 'outro' as never })).ok).toBe(false)
    expect((await abrirConversa({ canal: 'estudio_equipe', fotografoId: 'x' })).ok).toBe(false)
    expect((await abrirConversa({ canal: 'estudio_equipe', projetoId: 'x' })).ok).toBe(false)
    expect(await abrirConversa({ canal: 'cliente_estudio' })).toEqual({ ok: false, erro: 'A conversa com o cliente é sempre de um projeto.' })
    expect(banco.rpcs).toEqual([])
  })

  it('sem acesso (outro estúdio): erro de acesso', async () => {
    banco.responderRpc = () => ({ error: { message: 'Sem acesso a esta conversa', code: '42501' } })
    expect(await abrirConversa({ canal: 'estudio_equipe', projetoId: PROJETO })).toEqual({
      ok: false,
      erro: 'Você não tem acesso a esta conversa.',
    })
  })
})

describe('listarMensagens', () => {
  it('pagina do mais novo para o mais antigo e devolve em ordem cronológica', async () => {
    const linhas = Array.from({ length: 31 }, (_, i) => linha(9, { id: `m-${String(i).padStart(2, '0')}`, created_at: `2026-10-09T10:${String(59 - i).padStart(2, '0')}:00+00:00` }))
    banco.responder = (c) =>
      c.tabela === 'mensagens'
        ? { data: linhas }
        : { data: [{ usuario_id: 'u-outro', lida_ate: '2026-10-09T11:00:00+00:00' }, { usuario_id: 'u-2', lida_ate: '2026-10-09T09:00:00+00:00' }] }
    const r = await listarMensagens(CONVERSA, '2026-10-09T12:00:00.000Z')
    if (!r.ok) throw new Error(r.erro)
    expect(r.temMais).toBe(true)
    expect(r.mensagens).toHaveLength(30)
    expect(r.mensagens[0].criadaEm < r.mensagens[29].criadaEm).toBe(true)
    expect(r.vistoAte).toBe('2026-10-09T11:00:00+00:00')
    const msgs = banco.chamadas.find((c) => c.tabela === 'mensagens')!
    expect(msgs.filtros).toContainEqual(['eq', 'conversa_id', CONVERSA])
    expect(msgs.filtros).toContainEqual(['lt', 'created_at', '2026-10-09T12:00:00.000Z'])
    expect(msgs.filtros).toContainEqual(['limit', '', 31])
    // A leitura do próprio usuário não conta como "visto".
    expect(banco.chamadas.find((c) => c.tabela === 'conversa_leituras')!.filtros).toContainEqual(['neq', 'usuario_id', 'u-eu'])
  })

  it('mensagem apagada chega sem corpo', async () => {
    banco.responder = (c) => (c.tabela === 'mensagens' ? { data: [linha(1, { corpo: 'segredo', apagada_em: '2026-10-09T10:05:00+00:00' })] } : { data: [] })
    const r = await listarMensagens(CONVERSA)
    if (!r.ok) throw new Error(r.erro)
    expect(r.mensagens[0]).toMatchObject({ corpo: '', apagada: true })
  })

  it('recusa conversa e cursor inválidos', async () => {
    expect((await listarMensagens('nada')).ok).toBe(false)
    expect((await listarMensagens(CONVERSA, 'ontem')).ok).toBe(false)
    expect(banco.chamadas).toEqual([])
  })
})

describe('listarConversas', () => {
  const fio = (extra: Record<string, unknown>) => ({
    id: CONVERSA,
    canal: 'estudio_equipe',
    fotografo_id: 'f1',
    estudio: 'Estúdio Um',
    estudio_logo_url: null,
    projeto_id: null,
    projeto_nome: null,
    projeto_numero: null,
    cliente_nome: null,
    ultima_mensagem_em: '2026-10-09T10:00:00+00:00',
    ultima_mensagem_previa: 'oi',
    nao_lidas: 2,
    created_at: '2026-10-09T09:00:00+00:00',
    ...extra,
  })

  it('passa os filtros para listar_conversas e esconde fios vazios', async () => {
    banco.responderRpc = () => ({ data: [fio({}), fio({ id: 'vazio', ultima_mensagem_em: null })] })
    const r = await listarConversas({ canal: 'estudio_equipe', fotografoId: PROJETO, somenteNaoLidas: true, limite: 999 })
    if (!r.ok) throw new Error(r.erro)
    expect(r.conversas.map((c) => c.id)).toEqual([CONVERSA])
    expect(r.conversas[0]).toMatchObject({ estudio: 'Estúdio Um', naoLidas: 2 })
    expect(banco.rpcs[0]).toEqual({
      nome: 'listar_conversas',
      args: { p_canal: 'estudio_equipe', p_fotografo_id: PROJETO, p_projeto_id: null, p_somente_nao_lidas: true, p_limite: 200 },
    })
  })

  it('incluirVazias traz os fios ainda sem mensagem', async () => {
    banco.responderRpc = () => ({ data: [fio({ ultima_mensagem_em: null })] })
    const r = await listarConversas({ incluirVazias: true })
    expect(r.ok && r.conversas).toHaveLength(1)
  })

  it('recusa filtros inválidos', async () => {
    expect((await listarConversas({ fotografoId: "1' or 1=1" })).ok).toBe(false)
    expect((await listarConversas({ canal: 'x' as never })).ok).toBe(false)
    expect(banco.rpcs).toEqual([])
  })
})

describe('leitura e contador', () => {
  it('marcarComoLida chama marcar_conversa_lida', async () => {
    expect(await marcarComoLida(CONVERSA)).toEqual({ ok: true })
    expect(banco.rpcs).toEqual([{ nome: 'marcar_conversa_lida', args: { p_conversa_id: CONVERSA } }])
    expect((await marcarComoLida('x')).ok).toBe(false)
  })

  it('contarNaoLidas devolve o total ou 0 em erro', async () => {
    banco.responderRpc = () => ({ data: 7 })
    expect(await contarNaoLidas()).toBe(7)
    banco.responderRpc = () => ({ error: { message: 'falhou' } })
    expect(await contarNaoLidas()).toBe(0)
  })
})

describe('apagarMensagem', () => {
  it('só a própria mensagem ainda não apagada', async () => {
    banco.responder = () => ({ data: linha(1, { autor_id: 'u-eu', corpo: '', apagada_em: '2026-10-09T10:09:00+00:00' }) })
    const r = await apagarMensagem('00000000-0000-4000-8000-000000000001')
    expect(r).toMatchObject({ ok: true, mensagem: { apagada: true, corpo: '' } })
    const c = banco.chamadas[0]
    expect(c.operacao).toBe('update')
    expect(Object.keys(c.dados as object)).toEqual(['apagada_em'])
    expect(c.filtros).toContainEqual(['eq', 'autor_id', 'u-eu'])
    expect(c.filtros).toContainEqual(['is', 'apagada_em', null])
  })

  it('mensagem de outra pessoa: não encontrada', async () => {
    banco.responder = () => ({ data: null })
    expect(await apagarMensagem('00000000-0000-4000-8000-000000000001')).toEqual({ ok: false, erro: 'Mensagem não encontrada.' })
  })
})

describe('modo de demonstração', () => {
  it('sem Supabase configurado, nada vai ao banco', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    try {
      expect((await enviarMensagem({ conversaId: CONVERSA, corpo: 'oi' })).ok).toBe(false)
      expect(await contarNaoLidas()).toBe(0)
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url
    }
    expect(banco.chamadas).toEqual([])
    expect(banco.rpcs).toEqual([])
  })
})
