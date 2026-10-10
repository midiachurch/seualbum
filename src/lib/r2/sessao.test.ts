import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/r2/cliente', () => ({ r2Configurado: () => true, r2PublicoConfigurado: () => true }))

const { rascunhoJaEnviado } = await import('./sessao')

const USER = '11111111-1111-4111-8111-111111111111'
const CHAVE = '22222222-2222-4222-8222-222222222222'

/** Supabase falso: `orders` acha (ou não) o pedido; `fotos` devolve as linhas que usam a pasta. */
function supabaseFalso(p: { pedido: boolean; fotos: unknown[] }) {
  const filtros: [string, string, unknown][] = []
  const cliente = {
    filtros,
    from(tabela: string) {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (c: string, v: unknown) => (filtros.push([tabela, c, v]), q),
        like: (c: string, v: unknown) => (filtros.push([tabela, `like:${c}`, v]), q),
        maybeSingle: async () => ({ data: p.pedido ? { id: 'o1' } : null, error: null }),
        limit: async () => ({ data: p.fotos, error: null }),
      }
      return q
    },
  }
  return cliente
}

describe('rascunhoJaEnviado', () => {
  it('rascunho sem pedido e sem projeto continua editável', async () => {
    const s = supabaseFalso({ pedido: false, fotos: [] })
    expect(await rascunhoJaEnviado(s as never, CHAVE, USER)).toBe(false)
    expect(s.filtros).toContainEqual(['fotos', `like:storage_path`, `pedidos/${USER}/${CHAVE}/%`])
  })

  it('com pedido, travado', async () => {
    expect(await rascunhoJaEnviado(supabaseFalso({ pedido: true, fotos: [] }) as never, CHAVE, USER)).toBe(true)
  })

  it('pedido apagado depois da conversão: as fotos do projeto seguram a trava', async () => {
    expect(await rascunhoJaEnviado(supabaseFalso({ pedido: false, fotos: [{ id: 'f1' }] }) as never, CHAVE, USER)).toBe(true)
  })
})
