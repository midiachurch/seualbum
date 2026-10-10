import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server Actions do centro de controle da diagramação (migration 0038), com o
 * Supabase simulado: só admin/gestor mexem, a atribuição em massa separa
 * projetos de avulsos, a timeline do projeto ganha rastro e a falta da
 * migration vira uma mensagem clara.
 */

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Chamada = { tabela: string; operacao: string; dados?: unknown; filtros: [string, string, unknown][] }

const banco = vi.hoisted(() => ({
  chamadas: [] as Chamada[],
  responder: (() => ({ data: null, error: null })) as (c: Chamada) => { data?: unknown; error?: unknown },
  papel: 'gestor' as string | null,
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
    in: (col: string, v: unknown) => (c.filtros.push(['in', col, v]), q),
    is: (col: string, v: unknown) => (c.filtros.push(['is', col, v]), q),
    maybeSingle: resolver,
    single: resolver,
    then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => resolver().then(ok, erro),
  }
  return q
}

const supabase = { from: (t: string) => consulta(t) }

vi.mock('@/lib/supabase/queries', () => ({
  requireAdmin: async () => ({ supabase, user: { id: 'u-gestor' }, profile: null }),
  getPlatformRole: async () => banco.papel,
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://teste.supabase.co'

const {
  atribuirDiagramacao,
  definirPrazoDiagramacao,
  definirPrioridadeDiagramacao,
  definirEsperaDiagramacao,
  renomearTemplateAlbum,
  definirTemplateAtivo,
} = await import('./diagramacao')

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const A1 = '33333333-3333-4333-8333-333333333333'
const D1 = '44444444-4444-4444-8444-444444444444'
const T1 = '55555555-5555-4555-8555-555555555555'

/** Responde o UPDATE com as linhas pedidas no `.in('id', …)` (como o PostgREST com `.select('id')`). */
function respostaPadrao(perfil: Record<string, unknown> | null = { id: D1, nome_completo: 'Diana', role: 'designer', status: 'ativo' }) {
  return (c: Chamada) => {
    if (c.tabela === 'profiles') return { data: perfil }
    if (c.operacao === 'update') {
      const ids = (c.filtros.find(([op, col]) => op === 'in' && col === 'id')?.[2] as string[] | undefined) ?? [
        c.filtros.find(([op, col]) => op === 'eq' && col === 'id')?.[2] as string,
      ]
      return { data: ids.map((id) => ({ id })) }
    }
    return { data: null }
  }
}

beforeEach(() => {
  banco.chamadas = []
  banco.papel = 'gestor'
  banco.responder = respostaPadrao()
})

const updates = (tabela: string) => banco.chamadas.filter((c) => c.tabela === tabela && c.operacao === 'update')
const atividades = () => banco.chamadas.filter((c) => c.tabela === 'projeto_atividades' && c.operacao === 'insert')

describe('atribuirDiagramacao', () => {
  it('atribui em massa projetos e avulsos e registra na timeline só dos projetos', async () => {
    const r = await atribuirDiagramacao(
      [
        { tipo: 'projeto', id: P1 },
        { tipo: 'projeto', id: P2 },
        { tipo: 'avulso', id: A1 },
      ],
      D1,
    )
    expect(r).toEqual({ ok: true, atualizados: 3 })
    const [proj] = updates('projetos')
    expect(proj.dados).toEqual({ responsavel_id: D1 })
    expect(proj.filtros).toContainEqual(['in', 'id', [P1, P2]])
    const [avulso] = updates('album_layouts')
    expect(avulso.dados).toEqual({ responsavel_id: D1 })
    // Nunca mexe num layout de projeto pela via do avulso.
    expect(avulso.filtros).toContainEqual(['is', 'projeto_id', null])
    expect(atividades()[0].dados).toEqual([
      { projeto_id: P1, autor_id: 'u-gestor', mensagem: 'Diagramação atribuída a Diana.' },
      { projeto_id: P2, autor_id: 'u-gestor', mensagem: 'Diagramação atribuída a Diana.' },
    ])
  })

  it('tira o responsável', async () => {
    const r = await atribuirDiagramacao([{ tipo: 'projeto', id: P1 }], null)
    expect(r.ok).toBe(true)
    expect(updates('projetos')[0].dados).toEqual({ responsavel_id: null })
    expect((atividades()[0].dados as { mensagem: string }[])[0].mensagem).toBe('Atribuição da diagramação removida.')
  })

  it('só aceita membro ativo da equipe', async () => {
    banco.responder = respostaPadrao({ id: D1, nome_completo: 'Foto', role: 'fotografo', status: 'ativo' })
    expect(await atribuirDiagramacao([{ tipo: 'projeto', id: P1 }], D1)).toEqual({ ok: false, erro: 'Escolha um membro ativo da equipe.' })
    banco.responder = respostaPadrao({ id: D1, nome_completo: 'Diana', role: 'designer', status: 'inativo' })
    expect((await atribuirDiagramacao([{ tipo: 'projeto', id: P1 }], D1)).ok).toBe(false)
    expect(updates('projetos')).toHaveLength(0)
  })

  it('operador e designer não atribuem (nem chegam ao banco)', async () => {
    for (const papel of ['operador', 'designer']) {
      banco.papel = papel
      const r = await atribuirDiagramacao([{ tipo: 'projeto', id: P1 }], D1)
      expect(r.ok).toBe(false)
    }
    expect(banco.chamadas).toHaveLength(0)
  })

  it('recusa seleção adulterada', async () => {
    expect(await atribuirDiagramacao([{ tipo: 'projeto', id: 'x' }], D1)).toEqual({ ok: false, erro: 'Seleção inválida.' })
    expect(await atribuirDiagramacao([{ tipo: 'projeto', id: P1 }], 'x')).toEqual({ ok: false, erro: 'Responsável inválido.' })
    expect(banco.chamadas).toHaveLength(0)
  })

  it('nada atualizado (RLS) = erro', async () => {
    banco.responder = (c) => (c.tabela === 'profiles' ? respostaPadrao()(c) : { data: [] })
    expect(await atribuirDiagramacao([{ tipo: 'projeto', id: P1 }], D1)).toEqual({ ok: false, erro: 'Nenhum álbum encontrado (ou sem permissão).' })
  })
})

describe('prazo, prioridade e espera', () => {
  it('prazo do projeto vai para data_limite_producao (fim do dia em Brasília)', async () => {
    const r = await definirPrazoDiagramacao({ tipo: 'projeto', id: P1 }, '2026-10-20')
    expect(r.ok).toBe(true)
    expect(updates('projetos')[0].dados).toEqual({ data_limite_producao: '2026-10-21T02:59:00.000Z' })
    expect((atividades()[0].dados as { mensagem: string }[])[0].mensagem).toBe('Prazo da diagramação alterado para 20/10/2026.')
  })

  it('projeto não fica sem prazo; avulso pode', async () => {
    expect(await definirPrazoDiagramacao({ tipo: 'projeto', id: P1 }, null)).toEqual({ ok: false, erro: 'Projeto precisa de prazo.' })
    expect(await definirPrazoDiagramacao({ tipo: 'projeto', id: P1 }, '2026-13-01')).toEqual({ ok: false, erro: 'Data inválida.' })
    const r = await definirPrazoDiagramacao({ tipo: 'avulso', id: A1 }, null)
    expect(r.ok).toBe(true)
    expect(updates('album_layouts')[0].dados).toEqual({ prazo: null })
  })

  it('prioridade em massa, com valor validado', async () => {
    const r = await definirPrioridadeDiagramacao(
      [
        { tipo: 'projeto', id: P1 },
        { tipo: 'avulso', id: A1 },
      ],
      'urgente',
    )
    expect(r).toEqual({ ok: true, atualizados: 2 })
    expect(updates('projetos')[0].dados).toEqual({ prioridade: 'urgente' })
    expect(updates('album_layouts')[0].dados).toEqual({ prioridade: 'urgente' })
    // @ts-expect-error valor fora da lista
    expect(await definirPrioridadeDiagramacao([{ tipo: 'projeto', id: P1 }], 'maxima')).toEqual({ ok: false, erro: 'Prioridade inválida.' })
  })

  it('pausa com motivo e retoma limpando o motivo', async () => {
    await definirEsperaDiagramacao({ tipo: 'projeto', id: P1 }, true, '  Aguardando fotos extras  ')
    expect(updates('projetos')[0].dados).toEqual({ em_espera: true, em_espera_motivo: 'Aguardando fotos extras' })
    expect((atividades()[0].dados as { mensagem: string }[])[0].mensagem).toBe('Diagramação em espera: Aguardando fotos extras')
    banco.chamadas = []
    await definirEsperaDiagramacao({ tipo: 'projeto', id: P1 }, false, 'ignorado')
    expect(updates('projetos')[0].dados).toEqual({ em_espera: false, em_espera_motivo: null })
  })

  it('sem a migration 0038, explica o que falta', async () => {
    banco.responder = () => ({ data: null, error: { message: "Could not find the 'prioridade' column of 'projetos' in the schema cache" } })
    const r = await definirPrioridadeDiagramacao([{ tipo: 'projeto', id: P1 }], 'alta')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/migration 0038/)
  })

  it('trava do banco (42501) vira mensagem de permissão', async () => {
    banco.responder = () => ({ data: null, error: { message: 'Só admin ou gestor…', code: '42501' } })
    const r = await definirEsperaDiagramacao({ tipo: 'avulso', id: A1 }, true)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/Só admin ou gestor/)
  })
})

describe('templates', () => {
  it('renomeia com nome aparado e valida tamanho', async () => {
    expect((await renomearTemplateAlbum(T1, '  Abertura 3 fotos ')).ok).toBe(true)
    expect(updates('album_templates')[0].dados).toEqual({ nome: 'Abertura 3 fotos' })
    expect(await renomearTemplateAlbum(T1, '   ')).toEqual({ ok: false, erro: 'O nome precisa ter de 1 a 80 caracteres.' })
    expect(await renomearTemplateAlbum('x', 'Nome')).toEqual({ ok: false, erro: 'Template inválido.' })
  })

  it('desativa e reativa; só a gestão', async () => {
    expect((await definirTemplateAtivo(T1, false)).ok).toBe(true)
    expect(updates('album_templates')[0].dados).toEqual({ ativo: false })
    banco.papel = 'designer'
    expect((await definirTemplateAtivo(T1, true)).ok).toBe(false)
    expect(updates('album_templates')).toHaveLength(1)
  })
})
