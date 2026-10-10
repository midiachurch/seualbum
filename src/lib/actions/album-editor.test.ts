import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server Actions do editor de álbum com os arquivos no Cloudflare R2
 * (migration 0034), com o Supabase e o R2 simulados: só registra chave que
 * está na pasta certa E existe no R2, e os caminhos antigos (bucket
 * `albuns_fotos`) continuam sendo apagados e copiados de lá.
 */

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Chamada = { tabela: string; operacao: string; dados?: unknown; filtros: [string, unknown][] }

const banco = vi.hoisted(() => ({
  chamadas: [] as Chamada[],
  responder: (() => ({ data: null, error: null })) as (c: Chamada) => { data?: unknown; error?: unknown },
  storage: [] as { bucket: string; op: string; args: unknown }[],
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
    delete: () => ((c.operacao = 'delete'), q),
    eq: (col: string, v: unknown) => (c.filtros.push([col, v]), q),
    neq: () => q,
    is: () => q,
    order: () => q,
    limit: () => q,
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
      download: async (path: string) => (
        banco.storage.push({ bucket, op: 'download', args: path }), { data: new Blob([new Uint8Array([1, 2, 3])], { type: r2.tipoBaixado }), error: null }
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

const r2 = vi.hoisted(() => ({
  existentes: new Set<string>(),
  removidos: [] as string[],
  copias: [] as [string, string][],
  enviados: [] as string[],
  tiposEnviados: [] as string[],
  tipoBaixado: 'image/jpeg',
}))
vi.mock('@/lib/r2/cliente', () => ({
  r2Configurado: () => true,
  metadadosDoObjeto: async (key: string) => (r2.existentes.has(key) ? { tamanho: 10, contentType: 'image/jpeg' } : null),
  removerObjetos: async (keys: string[]) => void r2.removidos.push(...keys),
  copiarObjeto: async (de: string, para: string) => void r2.copias.push([de, para]),
  enviarObjeto: async (key: string, _bytes: Uint8Array, tipo: string) => void (r2.enviados.push(key), r2.tiposEnviados.push(tipo)),
  assinarLeituras: async (keys: string[]) => new Map(keys.map((k) => [k, `https://r2/get/${k}`])),
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://teste.supabase.co'

const { registrarFotosAlbum, criarAprovacao, salvarDerivados, excluirAlbumAvulso, duplicarAlbum } = await import('./album-editor')

const ALBUM = '11111111-1111-4111-8111-111111111111'
const FOTO = '22222222-2222-4222-8222-222222222222'
const APROV = '33333333-3333-4333-8333-333333333333'
const NOVO = '44444444-4444-4444-8444-444444444444'
const KEY = `albuns/${ALBUM}/${FOTO}-a.jpg`

const updates = (tabela: string) => banco.chamadas.filter((c) => c.tabela === tabela && c.operacao === 'update').map((c) => c.dados)

beforeEach(() => {
  banco.chamadas = []
  banco.storage = []
  banco.responder = () => ({ data: null })
  r2.existentes = new Set()
  r2.removidos = []
  r2.copias = []
  r2.enviados = []
  r2.tiposEnviados = []
  r2.tipoBaixado = 'image/jpeg'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('registrarFotosAlbum', () => {
  const foto = { id: FOTO, path: KEY, nome: 'a.jpg', largura: 100, altura: 80 }

  it('recusa caminho do bucket antigo ou de outro álbum, sem tocar no banco', async () => {
    expect(await registrarFotosAlbum(ALBUM, [{ ...foto, path: `${ALBUM}/${FOTO}-a.jpg` }])).toMatchObject({ ok: false })
    expect(await registrarFotosAlbum(ALBUM, [{ ...foto, path: `albuns/${NOVO}/${FOTO}-a.jpg` }])).toMatchObject({ ok: false })
    expect(banco.chamadas).toEqual([])
  })

  it('recusa foto que não chegou ao R2', async () => {
    const r = await registrarFotosAlbum(ALBUM, [foto])
    expect(r).toEqual({ ok: false, erro: '1 foto(s) não chegaram ao armazenamento. Envie de novo.' })
    expect(updates('album_layouts')).toEqual([])
  })

  it('registra a chave e devolve o link assinado', async () => {
    r2.existentes.add(KEY)
    banco.responder = (c) => (c.operacao === 'select' ? { data: { fotos: [], projeto_id: null } } : { data: null })
    const r = await registrarFotosAlbum(ALBUM, [foto])
    expect(r).toEqual({ ok: true, urls: { [KEY]: `https://r2/get/${KEY}` } })
    expect(updates('album_layouts')).toEqual([{ fotos: [foto] }])
  })
})

describe('criarAprovacao', () => {
  const lamina = (n: number) => ({ path: `albuns/${ALBUM}/aprovacoes/${APROV}/00${n}.jpg`, largura: 10, altura: 10, rotulo: `L${n}` })

  beforeEach(() => {
    banco.responder = (c) => {
      if (c.tabela === 'album_layouts' && c.operacao === 'select') return { data: { projeto_id: null, documento: {}, status: 'em_edicao' } }
      if (c.tabela === 'album_aprovacoes' && c.operacao === 'insert') return { data: { token: 'tok' } }
      return { data: null }
    }
  })

  it('lâmina fora da pasta desta aprovação é recusada', async () => {
    const r = await criarAprovacao(ALBUM, APROV, [{ ...lamina(1), path: `${ALBUM}/aprovacoes/${APROV}/001.jpg` }])
    expect(r).toEqual({ ok: false, erro: 'Lâmina fora da pasta desta aprovação.' })
  })

  it('lâmina que não está no R2 barra o link', async () => {
    r2.existentes.add(lamina(1).path)
    const r = await criarAprovacao(ALBUM, APROV, [lamina(1), lamina(2)])
    expect(r).toMatchObject({ ok: false, erro: expect.stringMatching(/não chegou ao armazenamento/) })
  })

  it('com tudo no R2, cria o link', async () => {
    r2.existentes.add(lamina(1).path)
    expect(await criarAprovacao(ALBUM, APROV, [lamina(1)])).toEqual({ ok: true, token: 'tok', numero: 1 })
  })
})

describe('salvarDerivados', () => {
  const mini = `albuns/${ALBUM}/derivados/${FOTO}-mini.jpg`
  const preview = `albuns/${ALBUM}/derivados/${FOTO}-preview.jpg`
  const d = { mini, preview, largura: 100, altura: 80, estouro: 0, fx: 0.5, fy: 0.5 }

  it('só grava a versão leve que está no R2, na pasta do álbum', async () => {
    r2.existentes = new Set([mini, preview])
    banco.responder = (c) => (c.operacao === 'select' ? { data: { derivados: {} } } : { data: null })
    const outra = '55555555-5555-4555-8555-555555555555'
    const r = await salvarDerivados(ALBUM, {
      [FOTO]: d,
      // Chave de outro álbum e versão que não subiu: ficam de fora.
      [outra]: { ...d, mini: `albuns/${NOVO}/derivados/${outra}-mini.jpg`, preview: `albuns/${NOVO}/derivados/${outra}-preview.jpg` },
    })
    expect(r).toEqual({ ok: true })
    expect(Object.keys((updates('album_layouts')[0] as { derivados: object }).derivados)).toEqual([FOTO])
  })

  it('nada no R2: erro, sem gravar', async () => {
    expect(await salvarDerivados(ALBUM, { [FOTO]: d })).toMatchObject({ ok: false })
    expect(updates('album_layouts')).toEqual([])
  })
})

describe('excluirAlbumAvulso', () => {
  it('apaga do R2 as chaves albuns/ e do bucket antigo os caminhos antigos', async () => {
    const antiga = `${ALBUM}/${FOTO}-velha.jpg`
    banco.responder = (c) => {
      if (c.tabela === 'album_layouts' && c.operacao === 'select') {
        return {
          data: {
            projeto_id: null,
            fotos: [{ id: FOTO, path: KEY }, { id: NOVO, path: antiga }],
            derivados: { [FOTO]: { mini: `${ALBUM}/derivados/${FOTO}-mini.jpg`, preview: `albuns/${ALBUM}/derivados/${FOTO}-preview.jpg` } },
          },
        }
      }
      if (c.tabela === 'album_aprovacoes') return { data: [{ id: APROV, laminas: [{ path: `albuns/${ALBUM}/aprovacoes/${APROV}/001.jpg` }] }] }
      return { data: null }
    }
    expect(await excluirAlbumAvulso(ALBUM)).toEqual({ ok: true })
    expect(r2.removidos).toEqual([KEY, `albuns/${ALBUM}/derivados/${FOTO}-preview.jpg`, `albuns/${ALBUM}/aprovacoes/${APROV}/001.jpg`])
    expect(banco.storage).toEqual([{ bucket: 'albuns_fotos', op: 'remove', args: [antiga, `${ALBUM}/derivados/${FOTO}-mini.jpg`] }])
  })
})

describe('duplicarAlbum', () => {
  it('copia para o R2: no próprio R2 o que já está lá, baixando do Supabase o que é antigo', async () => {
    const antiga = `${ALBUM}/${NOVO}-velha.jpg`
    banco.responder = (c) => {
      if (c.tabela === 'album_layouts' && c.operacao === 'select') {
        return {
          data: {
            nome: 'Casamento',
            projeto_id: null,
            documento: {},
            fotos: [
              { id: FOTO, path: KEY, nome: 'a.jpg', largura: 1, altura: 1 },
              { id: NOVO, path: antiga, nome: 'velha.jpg', largura: 1, altura: 1 },
            ],
            derivados: {},
          },
        }
      }
      if (c.tabela === 'album_layouts' && c.operacao === 'insert') return { data: { id: APROV } }
      return { data: null }
    }
    expect(await duplicarAlbum(ALBUM)).toEqual({ ok: true, id: APROV })
    expect(r2.copias).toEqual([[KEY, `albuns/${APROV}/${FOTO}-${FOTO}-a.jpg`]])
    expect(banco.storage).toEqual([{ bucket: 'albuns_fotos', op: 'download', args: antiga }])
    expect(r2.enviados).toEqual([`albuns/${APROV}/${NOVO}-${NOVO}-velha.jpg`])
    const fotos = (updates('album_layouts')[0] as { fotos: { path: string }[] }).fotos.map((f) => f.path)
    expect(fotos.every((p) => p.startsWith(`albuns/${APROV}/`))).toBe(true)
    expect(r2.tiposEnviados).toEqual(['image/jpeg'])
  })

  it('cópia do Supabase: o Content-Type do arquivo antigo não vai para o bucket privado se não for imagem da lista', async () => {
    const antigas = [`${ALBUM}/${NOVO}-pagina.jpg`, `${ALBUM}/${FOTO}-sem-extensao`, `${ALBUM}/${APROV}-foto.PNG`]
    banco.responder = (c) => {
      if (c.tabela === 'album_layouts' && c.operacao === 'select') {
        return {
          data: {
            nome: 'Casamento',
            projeto_id: null,
            documento: {},
            fotos: antigas.map((path, i) => ({ id: [NOVO, FOTO, APROV][i], path, nome: 'x', largura: 1, altura: 1 })),
            derivados: {},
          },
        }
      }
      if (c.tabela === 'album_layouts' && c.operacao === 'insert') return { data: { id: APROV } }
      return { data: null }
    }
    r2.tipoBaixado = 'text/html'
    expect(await duplicarAlbum(ALBUM)).toEqual({ ok: true, id: APROV })
    // pelo nome quando dá; senão, octet-stream (o navegador baixa, não interpreta)
    expect(r2.tiposEnviados).toEqual(['image/jpeg', 'application/octet-stream', 'image/png'])
  })
})
