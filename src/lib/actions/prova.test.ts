import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server Actions da prova (aprovar, pedir ajustes, comentar com ponto/área e
 * nova versão completa ou parcial), com o Supabase e o R2 simulados. Cada
 * chamada ao banco vira um registro { tabela, operacao, filtros, dados } para
 * conferir o que a action gravou.
 */

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Chamada = { tabela: string; operacao: string; dados?: unknown; filtros: [string, string, unknown][] }
type Resposta = { data?: unknown; error?: { message: string; code?: string } | null; count?: number }

const banco = vi.hoisted(() => ({
  chamadas: [] as Chamada[],
  rpcs: [] as { nome: string; args: unknown }[],
  /** Decide o que cada chamada devolve. */
  responder: (() => ({ data: null, error: null })) as (c: Chamada) => Resposta,
}))

/** Query builder encadeável e "thenable", como o do supabase-js. */
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
    delete: () => ((c.operacao = 'delete'), q),
    eq: (col: string, v: unknown) => (c.filtros.push(['eq', col, v]), q),
    lt: (col: string, v: unknown) => (c.filtros.push(['lt', col, v]), q),
    in: (col: string, v: unknown) => (c.filtros.push(['in', col, v]), q),
    order: () => q,
    limit: () => q,
    maybeSingle: resolver,
    single: resolver,
    then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => resolver().then(ok, erro),
  }
  return q
}

const supabase = {
  from: (tabela: string) => consulta(tabela),
  rpc: async (nome: string, args: unknown) => (banco.rpcs.push({ nome, args }), { data: null, error: null }),
  auth: { getUser: async () => ({ data: { user: { id: 'u-equipe' } } }) },
}

vi.mock('@/lib/supabase/queries', () => ({
  requireClientPortal: async () => ({ supabase, user: { id: 'u-cliente' } }),
  requireEdicaoDeProducao: async () => ({ supabase, role: 'designer' }),
  requireModuleAction: async () => ({ supabase }),
  requireUser: async () => ({ supabase, user: { id: 'u-fotografo' }, profile: { role: 'fotografo' } }),
  getPlatformRole: async () => 'fotografo',
}))

const r2 = vi.hoisted(() => ({ existentes: new Set<string>() }))
vi.mock('@/lib/r2/cliente', () => ({
  r2Configurado: () => true,
  metadadosDoObjeto: async (key: string) => (r2.existentes.has(key) ? { tamanho: 10, contentType: 'image/jpeg' } : null),
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://teste.supabase.co'

const { addProofComment, clientApprove, clientRequestChanges, criarVersaoComLaminas } = await import('./projetos')
const { fotografoAprovar, fotografoPedirAjustes } = await import('./prova-fotografo')

const PROJETO = '11111111-1111-4111-8111-111111111111'
const LOTE = '22222222-2222-4222-8222-222222222222'
const BASE = '33333333-3333-4333-8333-333333333333'
const LAMINA = '44444444-4444-4444-8444-444444444444'
const chave = (n: string) => `projetos/${PROJETO}/versoes/${LOTE}/55555555-5555-4555-8555-55555555555${n}-l.jpg`

const inserts = (tabela: string) => banco.chamadas.filter((c) => c.tabela === tabela && c.operacao === 'insert').map((c) => c.dados)

/** Estado padrão: prova liberada para decisão. */
function provaLiberada(c: Chamada): Resposta {
  if (c.tabela === 'projetos' && c.operacao === 'select') return { data: { id: PROJETO, status: 'aguardando_aprovacao_cliente' } }
  return { data: null }
}

beforeEach(() => {
  banco.chamadas = []
  banco.rpcs = []
  banco.responder = provaLiberada
  r2.existentes = new Set()
})

describe('aprovação pelo cliente final', () => {
  it('aprova pela RPC aprovar_prova, com a versão e os adicionais normalizados', async () => {
    await clientApprove(PROJETO, 3, [{ adicionalId: LAMINA, quantidade: 2 }])
    expect(banco.rpcs).toEqual([
      { nome: 'aprovar_prova', args: { p_projeto_id: PROJETO, p_versao: 3, p_adicionais: [{ adicional_id: LAMINA, quantidade: 2 }] } },
    ])
  })

  it('não aprova com a prova fora de "aguardando aprovação"', async () => {
    banco.responder = (c) => (c.tabela === 'projetos' ? { data: { status: 'em_diagramacao' } } : { data: null })
    await expect(clientApprove(PROJETO, 3)).rejects.toThrow(/não está aguardando aprovação/)
    expect(banco.rpcs).toEqual([])
  })

  it('solicitar alterações grava a aprovação como alteracao_solicitada com o resumo', async () => {
    await clientRequestChanges(PROJETO, 2, 'Lâmina 3 (área 1): trocar a foto')
    expect(inserts('aprovacoes')).toEqual([
      { projeto_id: PROJETO, versao: 2, usuario_id: 'u-cliente', status: 'alteracao_solicitada', comentario: 'Lâmina 3 (área 1): trocar a foto' },
    ])
  })

  it('propaga o erro do banco ao solicitar alterações', async () => {
    banco.responder = (c) =>
      c.tabela === 'aprovacoes' ? { error: { message: 'violou RLS' } } : provaLiberada(c)
    await expect(clientRequestChanges(PROJETO, 2, 'x')).rejects.toThrow('violou RLS')
  })
})

describe('aprovação pelo fotógrafo', () => {
  it('aprova e pede ajustes só no projeto dele, com a prova liberada', async () => {
    await fotografoAprovar(PROJETO, 1)
    await fotografoPedirAjustes(PROJETO, 1, 'Ajustar capa')
    expect(banco.rpcs[0]).toMatchObject({ nome: 'aprovar_prova', args: { p_projeto_id: PROJETO, p_versao: 1 } })
    expect(inserts('aprovacoes')).toEqual([
      { projeto_id: PROJETO, versao: 1, usuario_id: 'u-fotografo', status: 'alteracao_solicitada', comentario: 'Ajustar capa' },
    ])
    // A busca do projeto filtra pelo dono.
    expect(banco.chamadas.find((c) => c.tabela === 'projetos')?.filtros).toContainEqual(['eq', 'fotografo_id', 'u-fotografo'])
  })

  it('recusa projeto de outro estúdio', async () => {
    banco.responder = () => ({ data: null })
    await expect(fotografoPedirAjustes(PROJETO, 1, 'x')).rejects.toThrow('Projeto não encontrado.')
  })
})

describe('orientações na lâmina', () => {
  it('grava a área marcada (canto + largura/altura, cortada na borda)', async () => {
    await addProofComment(PROJETO, 2, 1, 'Trocar esta foto', { laminaId: LAMINA, x: 80, y: 10, largura: 40, altura: 20 })
    expect(inserts('prova_comentarios')[0]).toMatchObject({
      lamina_id: LAMINA,
      posicao_x: 80,
      posicao_y: 10,
      area_largura: 20,
      area_altura: 20,
    })
  })

  it('ponto simples continua sem área', async () => {
    await addProofComment(PROJETO, 0, 1, 'Clarear', { laminaId: LAMINA, x: 50, y: 50 })
    expect(inserts('prova_comentarios')[0]).toMatchObject({ posicao_x: 50, posicao_y: 50, area_largura: null, area_altura: null })
  })
})

describe('nova versão de lâminas', () => {
  const baseLaminas = [1, 2, 3].map((ordem) => ({
    id: `b${ordem}`,
    ordem,
    bucket: 'r2',
    storage_path: `antiga/${ordem}.jpg`,
    largura: 6000,
    altura: 3000,
    eh_capa: false,
  }))

  function comBase(c: Chamada): Resposta {
    if (c.tabela === 'design_versions' && c.operacao === 'select') return { data: { id: BASE, numero: 4 } }
    if (c.tabela === 'design_versions' && c.operacao === 'insert') return { data: { id: 'nova', numero: 5 } }
    if (c.tabela === 'versoes_laminas' && c.operacao === 'select') return { data: baseLaminas }
    if (c.tabela === 'prova_comentarios' && c.operacao === 'update') return { data: [{ id: 'p1' }] }
    return { data: null }
  }

  it('parcial: registra só a lâmina trocada como alterada e herda as outras', async () => {
    banco.responder = comBase
    r2.existentes.add(chave('1'))
    const r = await criarVersaoComLaminas({
      projetoId: PROJETO,
      lote: LOTE,
      comentarios: 'Lâmina 2 refeita',
      parcial: { baseVersaoId: BASE, substituir: [{ ordem: 2, storagePath: chave('1'), largura: 6000, altura: 3000 }], remover: [], adicionar: [] },
    })
    expect(r).toEqual({ versaoId: 'nova', numero: 5, laminas: 3, alteradas: 1 })
    expect(inserts('design_versions')[0]).toMatchObject({ projeto_id: PROJETO, numero: 5, base_versao_id: BASE, status: 'enviada' })
    expect(inserts('versoes_laminas')[0]).toEqual([
      expect.objectContaining({ versao_id: 'nova', ordem: 1, storage_path: 'antiga/1.jpg', alterada: false, origem_lamina_id: 'b1' }),
      expect.objectContaining({ versao_id: 'nova', ordem: 2, storage_path: chave('1'), bucket: 'r2', alterada: true, origem_lamina_id: 'b2' }),
      expect.objectContaining({ versao_id: 'nova', ordem: 3, storage_path: 'antiga/3.jpg', alterada: false, origem_lamina_id: 'b3' }),
    ])
    // O projeto volta para a revisão interna.
    expect(banco.chamadas).toContainEqual(expect.objectContaining({ tabela: 'projetos', operacao: 'update', dados: { status: 'em_revisao_interna' } }))
  })

  it('parcial: recusa se a base não é a versão mais recente', async () => {
    banco.responder = (c) => (c.tabela === 'design_versions' ? { data: { id: 'outra', numero: 6 } } : { data: null })
    await expect(
      criarVersaoComLaminas({
        projetoId: PROJETO,
        lote: LOTE,
        comentarios: null,
        parcial: { baseVersaoId: BASE, substituir: [], remover: [1], adicionar: [] },
      }),
    ).rejects.toThrow(/mais recente/)
    expect(inserts('design_versions')).toEqual([])
  })

  it('recusa lâmina que não chegou ao R2, sem criar versão', async () => {
    banco.responder = comBase
    await expect(
      criarVersaoComLaminas({
        projetoId: PROJETO,
        lote: LOTE,
        comentarios: null,
        laminas: [{ ordem: 1, storagePath: chave('2'), largura: null, altura: null }],
      }),
    ).rejects.toThrow(/não chegaram ao armazenamento/)
    expect(inserts('design_versions')).toEqual([])
  })

  it('recusa chave fora da pasta do lote', async () => {
    await expect(
      criarVersaoComLaminas({
        projetoId: PROJETO,
        lote: LOTE,
        comentarios: null,
        laminas: [{ ordem: 1, storagePath: `projetos/${PROJETO}/versoes/outro-lote/x.jpg`, largura: null, altura: null }],
      }),
    ).rejects.toThrow('Arquivo fora da pasta deste envio.')
  })

  it('desfaz a versão se gravar as lâminas falhar', async () => {
    banco.responder = (c) =>
      c.tabela === 'versoes_laminas' && c.operacao === 'insert' ? { error: { message: 'falhou' } } : comBase(c)
    r2.existentes.add(chave('3'))
    await expect(
      criarVersaoComLaminas({
        projetoId: PROJETO,
        lote: LOTE,
        comentarios: null,
        laminas: [{ ordem: 1, storagePath: chave('3'), largura: null, altura: null }],
      }),
    ).rejects.toThrow(/registrar as lâminas/)
    expect(banco.chamadas).toContainEqual(expect.objectContaining({ tabela: 'design_versions', operacao: 'delete' }))
  })
})
