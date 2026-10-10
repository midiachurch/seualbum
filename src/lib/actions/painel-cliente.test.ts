import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Checklist de lâminas do painel do cliente (migration 0039), com o Supabase
 * simulado: cada upsert vira um registro { tabela, dados, opcoes }.
 */

vi.mock('server-only', () => ({}))
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }))
vi.mock('next/cache', () => cache)

type Upsert = { tabela: string; dados: unknown; opcoes: unknown }

const banco = vi.hoisted(() => ({
  upserts: [] as Upsert[],
  erro: null as { message: string; code?: string } | null,
}))

const supabase = {
  from: (tabela: string) => ({
    upsert: async (dados: unknown, opcoes: unknown) => {
      banco.upserts.push({ tabela, dados, opcoes })
      return { data: null, error: banco.erro }
    },
  }),
}

const portal = vi.hoisted(() => ({ chamadas: 0 }))
vi.mock('@/lib/supabase/queries', () => ({
  requireClientPortal: async () => {
    portal.chamadas++
    return { supabase, user: { id: 'u-cliente' } }
  },
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://teste.supabase.co'

const { marcarLaminaRevisada } = await import('./painel-cliente')

const PROJETO = '11111111-1111-4111-8111-111111111111'
const LAMINA = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  banco.upserts = []
  banco.erro = null
  portal.chamadas = 0
  cache.revalidatePath.mockClear()
})

describe('marcarLaminaRevisada', () => {
  it('"vista" é um upsert que nunca rebaixa uma lâmina já aprovada', async () => {
    await expect(marcarLaminaRevisada(PROJETO, LAMINA, 'vista')).resolves.toEqual({ ok: true, estado: 'vista' })
    expect(banco.upserts).toEqual([
      {
        tabela: 'prova_laminas_revisao',
        dados: { projeto_id: PROJETO, lamina_id: LAMINA, versao: 1, estado: 'vista' },
        opcoes: { onConflict: 'lamina_id,usuario_id', ignoreDuplicates: true },
      },
    ])
    // Abrir uma lâmina não invalida a página inteira.
    expect(cache.revalidatePath).not.toHaveBeenCalled()
  })

  it('"aprovada" sobrescreve o estado e atualiza o painel', async () => {
    await expect(marcarLaminaRevisada(PROJETO, LAMINA, 'aprovada')).resolves.toEqual({ ok: true, estado: 'aprovada' })
    expect(banco.upserts[0]).toMatchObject({
      dados: { estado: 'aprovada' },
      opcoes: { onConflict: 'lamina_id,usuario_id' },
    })
    expect((banco.upserts[0].opcoes as { ignoreDuplicates?: boolean }).ignoreDuplicates).toBeUndefined()
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/cliente/projetos/${PROJETO}`)
  })

  it('"desfazer" volta a lâmina para vista', async () => {
    await expect(marcarLaminaRevisada(PROJETO, LAMINA, 'desfazer')).resolves.toEqual({ ok: true, estado: 'vista' })
    expect(banco.upserts[0]).toMatchObject({ dados: { estado: 'vista' }, opcoes: { onConflict: 'lamina_id,usuario_id' } })
  })

  it('recusa ids que não são UUID sem tocar no banco', async () => {
    await expect(marcarLaminaRevisada('proj-1', LAMINA, 'aprovada')).resolves.toEqual({ ok: false, erro: 'Lâmina inválida.' })
    await expect(marcarLaminaRevisada(PROJETO, "x' or 1=1", 'aprovada')).resolves.toMatchObject({ ok: false })
    expect(portal.chamadas).toBe(0)
    expect(banco.upserts).toEqual([])
  })

  it('RLS recusou (prova fechada ou projeto de outro cliente): mensagem clara', async () => {
    banco.erro = { message: 'new row violates row-level security policy', code: '42501' }
    await expect(marcarLaminaRevisada(PROJETO, LAMINA, 'aprovada')).resolves.toEqual({
      ok: false,
      erro: 'Esta prova não está mais aberta para revisão.',
    })
    expect(cache.revalidatePath).not.toHaveBeenCalled()
  })

  it('outro erro do banco: pede para tentar de novo', async () => {
    banco.erro = { message: 'timeout' }
    await expect(marcarLaminaRevisada(PROJETO, LAMINA, 'vista')).resolves.toEqual({
      ok: false,
      erro: 'Não foi possível salvar. Tente de novo.',
    })
  })
})
