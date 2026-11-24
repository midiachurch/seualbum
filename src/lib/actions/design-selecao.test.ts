import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireUser: vi.fn(),
  requireEdicaoDeProducao: vi.fn(),
  revalidatePath: vi.fn(),
  demo: false,
  tabelas: {} as Record<string, unknown>,
  updates: [] as { tabela: string; dados: unknown }[],
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => mocks.demo }))
vi.mock('@/lib/supabase/queries', () => ({ requireUser: mocks.requireUser, requireEdicaoDeProducao: mocks.requireEdicaoDeProducao }))

const { consultarDesignSelecao, criarAlbumDaSelecao, restaurarVersaoDoAlbum, historicoDasVersoesDaProva } = await import('./design-selecao')

const SEL = 'a1000000-0000-4000-8000-000000000001'
const PROJ = 'a2000000-0000-4000-8000-000000000001'
const CHAVE = 'a3000000-0000-4000-8000-000000000001'
const LAYOUT = 'a4000000-0000-4000-8000-000000000001'
const VINC = 'a5000000-0000-4000-8000-000000000001'
const VERSAO = 'a6000000-0000-4000-8000-000000000001'

function banco() {
  const from = (tabela: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      update: (dados: unknown) => (mocks.updates.push({ tabela, dados }), q),
      maybeSingle: async () => ({ data: mocks.tabelas[tabela] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok),
    }
    return q
  }
  return { rpc: mocks.rpc, from }
}

const criacao = { layout_id: LAYOUT, vinculo_id: VINC, revisao: 2, total: 3, destino: 'projeto' as const, criado: true }
const entrada = { selecaoId: SEL, destino: 'projeto' as const, chave: CHAVE }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.demo = false
  mocks.updates = []
  mocks.tabelas = {
    selecoes_entregues: { id: SEL, projeto_id: PROJ, revisao: 2 },
    projetos: { nome: 'Casamento Ana', numero: 1041, album_config: { formato: '30x30', orientacao: 'quadrado' }, laminas_inclusas: 20, produto_id: null },
  }
  mocks.requireUser.mockResolvedValue({ supabase: banco() })
  mocks.requireEdicaoDeProducao.mockResolvedValue({ supabase: banco() })
  mocks.rpc.mockResolvedValue({ data: criacao, error: null })
})

describe('criarAlbumDaSelecao', () => {
  it.each([
    [{ ...entrada, selecaoId: 'x' }],
    [{ ...entrada, chave: 'x' }],
    [{ ...entrada, destino: 'outro' }],
    [{ ...entrada, orientacao: 'diagonal' }],
    [{ ...entrada, nome: 'a'.repeat(201) }],
  ])('entrada inválida não consulta o banco (%#)', async (e) => {
    expect((await criarAlbumDaSelecao(e as never)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })

  it('não cria em demonstração', async () => {
    mocks.demo = true
    expect((await criarAlbumDaSelecao(entrada)).ok).toBe(false)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })

  it('envia a seleção, a chave, o formato do projeto e um documento inicial com uma lâmina', async () => {
    const r = await criarAlbumDaSelecao(entrada)
    expect(r).toMatchObject({ ok: true, criacao, endereco: `/admin/projetos/${PROJ}/editor` })
    const [nome, args] = mocks.rpc.mock.calls[0]
    expect(nome).toBe('criar_album_da_selecao')
    expect(args).toMatchObject({ p_selecao_id: SEL, p_destino: 'projeto', p_chave: CHAVE, p_nome: 'Casamento Ana', p_formato: '30x30', p_orientacao: 'quadrado' })
    expect(args.p_documento.laminas).toHaveLength(1)
    expect(args.p_documento.laminas[0].quadros).toEqual([])
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/projetos/${PROJ}/editor`)
    // formato já estava no projeto: nada a gravar nele
    expect(mocks.updates).toEqual([])
  })

  it('avulso: nome padrão cita a revisão e o endereço é o do álbum', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...criacao, destino: 'avulso' }, error: null })
    const r = await criarAlbumDaSelecao({ ...entrada, destino: 'avulso' })
    expect(r).toMatchObject({ ok: true, endereco: `/admin/albuns/${LAYOUT}` })
    expect(mocks.rpc.mock.calls[0][1].p_nome).toBe('Casamento Ana — Seleção 2')
    const comNome = await criarAlbumDaSelecao({ ...entrada, destino: 'avulso', nome: '  Versão pais  ' })
    expect(comNome.ok).toBe(true)
    expect(mocks.rpc.mock.calls[1][1].p_nome).toBe('Versão pais')
  })

  it('projeto sem formato: pede o formato sem chamar a RPC; com a escolha, grava no projeto', async () => {
    mocks.tabelas.projetos = { nome: 'Sem formato', numero: 1, album_config: {}, laminas_inclusas: null, produto_id: null }
    const sem = await criarAlbumDaSelecao(entrada)
    expect(sem).toMatchObject({ ok: false, precisaFormato: true, sugestao: '30x30' })
    expect(mocks.rpc).not.toHaveBeenCalled()
    const com = await criarAlbumDaSelecao({ ...entrada, formato: '24x30', orientacao: 'vertical' })
    expect(com.ok).toBe(true)
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_formato: '24x30', p_orientacao: 'vertical' })
    expect(mocks.updates).toEqual([{ tabela: 'projetos', dados: { album_config: { formato: '24x30', orientacao: 'vertical' } } }])
  })

  it('repetição idempotente (criado=false) não regrava o formato do projeto', async () => {
    mocks.tabelas.projetos = { nome: 'Sem formato', numero: 1, album_config: {}, laminas_inclusas: null, produto_id: null }
    mocks.rpc.mockResolvedValue({ data: { ...criacao, criado: false }, error: null })
    const r = await criarAlbumDaSelecao({ ...entrada, formato: '24x30', orientacao: 'vertical' })
    expect(r).toMatchObject({ ok: true, criacao: { criado: false } })
    expect(mocks.updates).toEqual([])
  })

  it('seleção que a pessoa não enxerga tem a mesma resposta de "sem permissão", sem RPC', async () => {
    mocks.tabelas.selecoes_entregues = null
    const r = await criarAlbumDaSelecao(entrada)
    expect(r).toMatchObject({ ok: false, erro: expect.stringMatching(/permissão/) })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('traduz erros do banco sem vazar detalhe interno', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'detalhe interno rls' } })
    const negado = await criarAlbumDaSelecao(entrada)
    expect(negado).toMatchObject({ ok: false, erro: expect.stringMatching(/permissão/) })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Este projeto já tem um álbum.' } })
    expect(await criarAlbumDaSelecao(entrada)).toMatchObject({ ok: false, jaTemAlbum: true })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'detalhe interno sql' } })
    const generico = await criarAlbumDaSelecao(entrada)
    expect(JSON.stringify([negado, generico])).not.toContain('detalhe interno')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('não aceita sucesso malformado e permite retry após falha de rede com a mesma chave', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { layout_id: 'x' }, error: null })
    expect((await criarAlbumDaSelecao(entrada)).ok).toBe(false)
    mocks.rpc.mockRejectedValueOnce(new Error('rede'))
    expect((await criarAlbumDaSelecao(entrada)).ok).toBe(false)
    expect((await criarAlbumDaSelecao(entrada)).ok).toBe(true)
    expect(mocks.rpc.mock.calls.map((c) => c[1].p_chave)).toEqual([CHAVE, CHAVE, CHAVE])
  })
})

describe('consultarDesignSelecao', () => {
  const resumo = { papel: 'dono', pode_criar: true, pode_abrir_editor: false, tem_album_projeto: false, albuns: [] }
  it('devolve o resumo; sem papel no design (cliente) devolve indisponível, sem detalhe', async () => {
    mocks.rpc.mockResolvedValue({ data: resumo, error: null })
    expect(await consultarDesignSelecao(PROJ)).toEqual({ ok: true, resumo })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'interno' } })
    const negado = await consultarDesignSelecao(PROJ)
    expect(negado).toEqual({ ok: false, erro: 'Indisponível.' })
    expect((await consultarDesignSelecao('x')).ok).toBe(false)
  })
})

describe('restaurarVersaoDoAlbum', () => {
  const resultado = { versao_id: VERSAO, versao_anterior_id: SEL, revisao: 5, restaurada_de: VERSAO, repetida: false }
  it('envia ids e chave e confirma só com resposta válida', async () => {
    mocks.rpc.mockResolvedValue({ data: resultado, error: null })
    expect(await restaurarVersaoDoAlbum(LAYOUT, VERSAO, CHAVE)).toEqual({ ok: true, restauracao: resultado })
    expect(mocks.rpc).toHaveBeenCalledWith('restaurar_versao_album', { p_layout_id: LAYOUT, p_versao_id: VERSAO, p_chave: CHAVE })
    mocks.rpc.mockResolvedValue({ data: { revisao: 'x' }, error: null })
    expect((await restaurarVersaoDoAlbum(LAYOUT, VERSAO, CHAVE)).ok).toBe(false)
    expect((await restaurarVersaoDoAlbum('x', VERSAO, CHAVE)).ok).toBe(false)
  })
  it('álbum travado e falta de permissão têm mensagens próprias, sem vazar erro interno', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '55000', message: 'interno' } })
    expect(await restaurarVersaoDoAlbum(LAYOUT, VERSAO, CHAVE)).toMatchObject({ ok: false, travado: true })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'interno' } })
    expect(JSON.stringify(await restaurarVersaoDoAlbum(LAYOUT, VERSAO, CHAVE))).not.toContain('interno')
  })
})

describe('historicoDasVersoesDaProva', () => {
  it('lista versões com herdadas/alteradas e assinatura', async () => {
    const versoes = [{ versao_id: VERSAO, numero: 1, status: 'aprovada', base_versao_id: null, laminas: 8, herdadas: 0, alteradas: 8, assinatura: 'abc', criada_em: '2026-11-22T00:00:00Z' }]
    mocks.rpc.mockResolvedValue({ data: versoes, error: null })
    expect(await historicoDasVersoesDaProva(PROJ)).toEqual({ ok: true, versoes })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'interno' } })
    expect((await historicoDasVersoesDaProva(PROJ)).ok).toBe(false)
  })
})
