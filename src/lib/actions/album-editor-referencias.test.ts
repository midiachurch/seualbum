import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Álbum avulso nascido de uma seleção (0090) guarda REFERÊNCIAS aos originais do
 * projeto. Estas regras garantem que o editor nunca apaga o original do projeto
 * ao remover a foto ou excluir o álbum, e que o álbum comum (arquivos próprios em
 * `albuns/{id}/`) continua sendo limpo como sempre (regressão do editor).
 */

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Chamada = { tabela: string; operacao: string; dados?: unknown }
const banco = vi.hoisted(() => ({
  chamadas: [] as Chamada[],
  responder: (() => ({ data: null })) as (c: Chamada) => { data?: unknown },
  storage: [] as { bucket: string; op: string; args: unknown }[],
}))

function consulta(tabela: string) {
  const c: Chamada = { tabela, operacao: 'select' }
  const resolver = () => (banco.chamadas.push(c), Promise.resolve({ error: null, ...banco.responder(c) }))
  const q: Record<string, unknown> = {
    select: () => q,
    update: (dados: unknown) => ((c.operacao = 'update'), (c.dados = dados), q),
    delete: () => ((c.operacao = 'delete'), q),
    eq: () => q,
    is: () => q,
    order: () => q,
    range: () => q,
    maybeSingle: resolver,
    single: resolver,
    then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => resolver().then(ok, erro),
  }
  return q
}

const supabase = {
  from: (t: string) => consulta(t),
  storage: {
    from: (bucket: string) => ({
      remove: async (paths: string[]) => (banco.storage.push({ bucket, op: 'remove', args: paths }), { error: null }),
      createSignedUrls: async (paths: string[]) => (
        banco.storage.push({ bucket, op: 'sign', args: paths }), { data: paths.map((path) => ({ path, signedUrl: `https://sb/${bucket}/${path}` })) }
      ),
    }),
  },
}

vi.mock('@/lib/supabase/queries', () => ({
  requireEdicaoDeProducao: async () => ({ supabase, user: { id: 'u-equipe' }, role: 'designer' }),
  lerTodasAsLinhas: async () => ({ data: [], error: null }),
  getAlbumParaEditor: vi.fn(),
  getAprovacoesDoAlbum: vi.fn(),
  getFotosDoEditor: vi.fn(),
  getTemplatesDaEquipe: vi.fn(),
  getVersoesDoAlbum: vi.fn(),
}))

const r2 = vi.hoisted(() => ({ removidos: [] as string[], assinados: [] as string[][] }))
vi.mock('@/lib/r2/cliente', () => ({
  r2Configurado: () => true,
  metadadosDoObjeto: async () => null,
  removerObjetos: async (keys: string[]) => void r2.removidos.push(...keys),
  copiarObjeto: async () => {},
  enviarObjeto: async () => {},
  assinarLeituras: async (keys: string[]) => (r2.assinados.push(keys), new Map(keys.map((k) => [k, `https://r2/get/${k}`]))),
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://teste.supabase.co'
const { excluirAlbumAvulso, removerFotoAlbum, renovarLinksDasFotos } = await import('./album-editor')

const ALBUM = '11111111-1111-4111-8111-111111111111'
const F_REF = '22222222-2222-4222-8222-222222222222'
const F_PROPRIA = '33333333-3333-4333-8333-333333333333'
const F_LEGADA = '44444444-4444-4444-8444-444444444444'
const CHAVE_PROJETO = 'projetos/55555555-5555-4555-8555-555555555555/fotos/original.jpg'
const CHAVE_PROPRIA = `albuns/${ALBUM}/${F_PROPRIA}-a.jpg`

const fotos = [
  { id: F_REF, path: CHAVE_PROJETO, nome: 'IMG_1.jpg', largura: null, altura: null, bucket: 'r2', referencia: true },
  { id: F_PROPRIA, path: CHAVE_PROPRIA, nome: 'a.jpg', largura: 1, altura: 1 },
  { id: F_LEGADA, path: `${ALBUM}/${F_LEGADA}-velha.jpg`, nome: 'velha.jpg', largura: 1, altura: 1 },
]
const updates = () => banco.chamadas.filter((c) => c.tabela === 'album_layouts' && c.operacao === 'update').map((c) => c.dados)

beforeEach(() => {
  banco.chamadas = []
  banco.storage = []
  r2.removidos = []
  r2.assinados = []
  banco.responder = (c) => {
    if (c.tabela === 'album_layouts' && c.operacao === 'select') return { data: { projeto_id: null, fotos, derivados: {} } }
    return { data: null }
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('álbum avulso com referências a originais de projeto', () => {
  it('excluir o álbum apaga só os arquivos próprios; o original do projeto fica', async () => {
    expect(await excluirAlbumAvulso(ALBUM)).toEqual({ ok: true })
    expect(r2.removidos).toEqual([CHAVE_PROPRIA])
    expect(r2.removidos).not.toContain(CHAVE_PROJETO)
    expect(banco.storage).toEqual([{ bucket: 'albuns_fotos', op: 'remove', args: [`${ALBUM}/${F_LEGADA}-velha.jpg`] }])
  })

  it('remover a foto-referência tira do álbum e NÃO apaga o original', async () => {
    expect(await removerFotoAlbum(ALBUM, F_REF)).toEqual({ ok: true })
    expect(updates()).toEqual([{ fotos: fotos.filter((f) => f.id !== F_REF) }])
    expect(r2.removidos).toEqual([])
    expect(banco.storage).toEqual([])
  })

  it('remover foto própria continua apagando o arquivo (comportamento de sempre)', async () => {
    expect(await removerFotoAlbum(ALBUM, F_PROPRIA)).toEqual({ ok: true })
    expect(r2.removidos).toEqual([CHAVE_PROPRIA])
    expect(await removerFotoAlbum(ALBUM, F_LEGADA)).toEqual({ ok: true })
    expect(banco.storage).toEqual([{ bucket: 'albuns_fotos', op: 'remove', args: [`${ALBUM}/${F_LEGADA}-velha.jpg`] }])
  })

  it('renovar links usa o bucket da referência (r2) e o de sempre para as demais', async () => {
    const r = await renovarLinksDasFotos(ALBUM)
    expect(r).toMatchObject({ ok: true })
    if (!r.ok) throw new Error('esperado ok')
    expect(r2.assinados).toEqual([[CHAVE_PROJETO, CHAVE_PROPRIA]])
    expect(r.urls[F_REF]).toBe(`https://r2/get/${CHAVE_PROJETO}`)
    expect(r.urls[F_PROPRIA]).toBe(`https://r2/get/${CHAVE_PROPRIA}`)
    expect(r.urls[F_LEGADA]).toBe(`https://sb/albuns_fotos/${ALBUM}/${F_LEGADA}-velha.jpg`)
  })

  it('referência a bucket legado do projeto é assinada nesse bucket, não no do álbum', async () => {
    const legado = { id: F_REF, path: 'x/y.jpg', nome: 'y.jpg', largura: null, altura: null, bucket: 'projetos_fotos', referencia: true }
    banco.responder = (c) => (c.operacao === 'select' ? { data: { projeto_id: null, fotos: [legado], derivados: {} } } : { data: null })
    const r = await renovarLinksDasFotos(ALBUM)
    expect(banco.storage).toEqual([{ bucket: 'projetos_fotos', op: 'sign', args: ['x/y.jpg'] }])
    expect(r).toMatchObject({ ok: true, urls: { [F_REF]: 'https://sb/projetos_fotos/x/y.jpg' } })
  })
})
