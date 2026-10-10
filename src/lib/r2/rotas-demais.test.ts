import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Rotas de upload dos demais buckets no R2 (migration 0034): fotos do
 * projeto, editor de álbum, biblioteca de mídia e logo do estúdio — com o
 * Supabase, a sessão e o SDK do R2 simulados. Confere o contrato HTTP e o que
 * vai para o banco (só a chave e a marca `r2`).
 */

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const USER = '11111111-1111-4111-8111-111111111111'
const PROJETO = '22222222-2222-4222-8222-222222222222'
const ARQ = '33333333-3333-4333-8333-333333333333'
const ALBUM = '44444444-4444-4444-8444-444444444444'

const r2 = vi.hoisted(() => ({
  urlDeEnvio: vi.fn(),
  metadadosDoObjeto: vi.fn(),
  removerObjetos: vi.fn(),
}))
vi.mock('@/lib/r2/cliente', () => ({
  urlDeEnvio: r2.urlDeEnvio,
  metadadosDoObjeto: r2.metadadosDoObjeto,
  removerObjetos: r2.removerObjetos,
  urlDeLeitura: async (key: string) => `https://r2/get/${key}`,
  urlPublica: (key: string) => `https://midia.exemplo/${key}`,
}))

type Chamada = { tabela: string; operacao: string; dados?: unknown; filtros: [string, unknown][] }

/** Banco falso: query builder encadeável; `responder` decide cada resposta. */
const banco = vi.hoisted(() => ({
  chamadas: [] as Chamada[],
  responder: (() => ({ data: null, error: null })) as (c: Chamada) => { data?: unknown; error?: unknown },
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
    gt: (col: string, v: unknown) => (c.filtros.push([col, v]), q),
    maybeSingle: resolver,
    single: resolver,
    then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => resolver().then(ok, erro),
  }
  return q
}

/** RPCs: pela sessão do usuário (`supabase`) e pelo servidor (`admin`, service_role). */
const rpcs = vi.hoisted(() => ({
  chamadas: [] as { quem: 'usuario' | 'servidor'; nome: string; args: unknown }[],
  reservada: true as boolean,
  emUso: false as boolean,
}))
const supabase = {
  from: (t: string) => consulta(t),
  rpc: async (nome: string, args: unknown) => (rpcs.chamadas.push({ quem: 'usuario', nome, args }), { data: rpcs.emUso, error: null }),
}
const admin = {
  rpc: async (nome: string, args: unknown) => (rpcs.chamadas.push({ quem: 'servidor', nome, args }), { data: rpcs.reservada, error: null }),
}
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => admin }))

const sessao = vi.hoisted(() => ({ ok: true, status: 403, deProjeto: false }))
vi.mock('@/lib/r2/sessao', async () => {
  const { NextResponse } = await import('next/server')
  const porta = async () =>
    sessao.ok ? { ok: true, supabase, userId: USER, deProjeto: sessao.deProjeto } : { ok: false, resposta: NextResponse.json({ erro: 'negado' }, { status: sessao.status }) }
  return {
    projetoParaUpload: vi.fn(porta),
    albumParaUpload: vi.fn(porta),
    midiaParaUpload: vi.fn(porta),
    estudioParaUploadDeLogo: vi.fn(porta),
    lerJson: async (r: Request) => r.json().catch(() => null),
  }
})

const { POST: assinarFoto, DELETE: apagarFoto } = await import('@/app/api/uploads/projeto-foto/route')
const { POST: confirmarFoto } = await import('@/app/api/uploads/projeto-foto/confirmar/route')
const { POST: assinarAlbum } = await import('@/app/api/uploads/album/route')
const { POST: assinarMidia } = await import('@/app/api/uploads/midia/route')
const { POST: confirmarMidia } = await import('@/app/api/uploads/midia/confirmar/route')
const { POST: assinarLogo } = await import('@/app/api/uploads/logo/route')
const { POST: confirmarLogo } = await import('@/app/api/uploads/logo/confirmar/route')

function req(corpo: unknown, method = 'POST') {
  return new NextRequest('http://localhost/api/x', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}
const operacoes = (tabela: string, operacao: string) => banco.chamadas.filter((c) => c.tabela === tabela && c.operacao === operacao)

beforeEach(() => {
  Object.assign(sessao, { ok: true, status: 403, deProjeto: false })
  banco.chamadas = []
  // Por padrão quem confirma tem a reserva da chave (0040).
  banco.responder = (c) =>
    c.operacao === 'select' ? { data: c.tabela === 'r2_uploads_pendentes' ? { r2_key: 'k' } : null } : { data: { id: 'nova' } }
  Object.assign(rpcs, { chamadas: [], reservada: true, emUso: false })
  r2.urlDeEnvio.mockReset().mockResolvedValue({ url: 'https://r2/put', expiraEm: 'x' })
  r2.metadadosDoObjeto.mockReset().mockResolvedValue({ tamanho: 2048, contentType: 'image/jpeg' })
  r2.removerObjetos.mockReset().mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('fotos do projeto (/api/uploads/projeto-foto)', () => {
  const KEY = `projetos/${PROJETO}/fotos/${ARQ}-a.jpg`
  const corpo = { projetoId: PROJETO, idArquivo: ARQ, nome: 'a.jpg', tipo: 'image/jpeg', tamanho: 2048 }

  it('assina o PUT na pasta de fotos do projeto, no bucket privado', async () => {
    r2.metadadosDoObjeto.mockResolvedValueOnce(null)
    const r = await assinarFoto(req(corpo))
    expect(r.status).toBe(200)
    expect((await r.json()).key).toBe(KEY)
    expect(r2.metadadosDoObjeto).toHaveBeenCalledWith(KEY)
    expect(r2.urlDeEnvio).toHaveBeenCalledWith(KEY, 'image/jpeg', 2048)
    // A chave fica reservada para quem pediu, pelo servidor (não pela sessão do usuário).
    expect(rpcs.chamadas).toEqual([{ quem: 'servidor', nome: 'reservar_upload_r2', args: { p_key: KEY, p_user_id: USER } }])
  })

  it('409 quando a chave já está reservada para outra pessoa (corrida antes do PUT)', async () => {
    r2.metadadosDoObjeto.mockResolvedValueOnce(null)
    rpcs.reservada = false
    expect((await assinarFoto(req(corpo))).status).toBe(409)
    expect(r2.urlDeEnvio).not.toHaveBeenCalled()
  })

  it('409 para chave que já existe no R2: ninguém sobrescreve a foto de outra pessoa', async () => {
    // O cliente final enxerga as chaves das fotos do projeto e escolhe o idArquivo.
    r2.metadadosDoObjeto.mockResolvedValueOnce({ tamanho: 10, contentType: 'image/jpeg' })
    expect((await assinarFoto(req(corpo))).status).toBe(409)
    expect(r2.urlDeEnvio).not.toHaveBeenCalled()
    expect(rpcs.chamadas).toEqual([])
  })

  it('404 para quem não enxerga o projeto, sem assinar', async () => {
    Object.assign(sessao, { ok: false, status: 404 })
    expect((await assinarFoto(req(corpo))).status).toBe(404)
    expect(r2.urlDeEnvio).not.toHaveBeenCalled()
  })

  it('confirmar grava em `fotos` só a chave, com bucket r2 e o tamanho do R2', async () => {
    const r = await confirmarFoto(req({ key: KEY, grupo: 'Novas fotos', capturadaEm: '2026-05-01T18:30:00', camera: 'R5' }))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ ok: true, key: KEY, id: 'nova', url: `https://r2/get/${KEY}` })
    expect(operacoes('fotos', 'insert').map((c) => c.dados)).toEqual([
      {
        projeto_id: PROJETO,
        storage_path: KEY,
        bucket: 'r2',
        url: null,
        grupo: 'Novas fotos',
        enviado_por: USER,
        capturada_em: '2026-05-01T18:30:00',
        camera: 'R5',
      },
    ])
  })

  it('403 para quem não pediu o envio: não confirma, não mexe no R2 nem no banco', async () => {
    // Outra pessoa do projeto conhece a chave (lista de fotos) e tenta confirmar primeiro.
    banco.responder = () => ({ data: null })
    const r = await confirmarFoto(req({ key: KEY }))
    expect(r.status).toBe(403)
    expect(r2.metadadosDoObjeto).not.toHaveBeenCalled()
    expect(r2.removerObjetos).not.toHaveBeenCalled()
    expect(operacoes('fotos', 'insert')).toEqual([])
    const reserva = operacoes('r2_uploads_pendentes', 'select')[0]
    expect(reserva.filtros[0]).toEqual(['r2_key', KEY])
    expect(reserva.filtros[1][0]).toBe('expira_em')
  })

  it('confirmar duas vezes devolve a mesma foto', async () => {
    banco.responder = (c) => (c.operacao === 'select' ? { data: { id: 'ja-existe' } } : { data: { id: 'nova' } })
    const r = await confirmarFoto(req({ key: KEY }))
    expect(await r.json()).toMatchObject({ id: 'ja-existe', jaRegistrada: true })
    expect(operacoes('fotos', 'insert')).toEqual([])
  })

  it('404 quando o PUT não chegou; 400 e apaga quando passou do limite', async () => {
    r2.metadadosDoObjeto.mockResolvedValueOnce(null)
    expect((await confirmarFoto(req({ key: KEY }))).status).toBe(404)
    r2.metadadosDoObjeto.mockResolvedValueOnce({ tamanho: 10, contentType: 'application/pdf' })
    expect((await confirmarFoto(req({ key: KEY }))).status).toBe(400)
    expect(r2.removerObjetos).toHaveBeenCalledWith([KEY])
  })

  it('400 para chave fora da pasta de fotos (ex.: lâmina)', async () => {
    expect((await confirmarFoto(req({ key: `projetos/${PROJETO}/versoes/${ARQ}/${ARQ}-a.jpg` }))).status).toBe(400)
    expect(r2.metadadosDoObjeto).not.toHaveBeenCalled()
  })

  describe('DELETE (apagar a foto)', () => {
    const apagada = (storage_path: string, bucket = 'r2') => (c: Chamada) =>
      c.tabela === 'fotos' && c.operacao === 'delete' ? { data: [{ storage_path, bucket }] } : { data: null }

    it('apaga a linha pela sessão do usuário e o objeto do R2', async () => {
      banco.responder = apagada(KEY)
      const r = await apagarFoto(req({ id: ARQ, projetoId: PROJETO }, 'DELETE'))
      expect(r.status).toBe(200)
      expect(operacoes('fotos', 'delete')[0].filtros).toEqual([
        ['id', ARQ],
        ['projeto_id', PROJETO],
      ])
      expect(rpcs.chamadas).toEqual([{ quem: 'usuario', nome: 'chave_r2_em_uso_por_projeto', args: { p_key: KEY } }])
      expect(r2.removerObjetos).toHaveBeenCalledWith([KEY])
    })

    it('o objeto fica se outra linha de `fotos` ainda usa a chave', async () => {
      banco.responder = apagada(KEY)
      rpcs.emUso = true
      expect((await apagarFoto(req({ id: ARQ, projetoId: PROJETO }, 'DELETE'))).status).toBe(200)
      expect(r2.removerObjetos).not.toHaveBeenCalled()
    })

    it('foto de pedido convertida e arquivo antigo do Supabase ficam onde estão', async () => {
      banco.responder = apagada(`pedidos/${USER}/${PROJETO}/${ARQ}-a.jpg`)
      expect((await apagarFoto(req({ id: ARQ, projetoId: PROJETO }, 'DELETE'))).status).toBe(200)
      banco.responder = apagada(`${PROJETO}/a.jpg`, 'projetos_fotos')
      expect((await apagarFoto(req({ id: ARQ, projetoId: PROJETO }, 'DELETE'))).status).toBe(200)
      expect(r2.removerObjetos).not.toHaveBeenCalled()
    })

    it('404 quando a RLS não deixa apagar (nada sai do R2)', async () => {
      banco.responder = () => ({ data: [] })
      expect((await apagarFoto(req({ id: ARQ, projetoId: PROJETO }, 'DELETE'))).status).toBe(404)
      expect(r2.removerObjetos).not.toHaveBeenCalled()
    })

    it('400 sem id válido', async () => {
      expect((await apagarFoto(req({ id: 'x', projetoId: PROJETO }, 'DELETE'))).status).toBe(400)
    })
  })
})

describe('editor de álbum (/api/uploads/album)', () => {
  it('assina a foto do avulso em albuns/{album}/', async () => {
    const r = await assinarAlbum(req({ albumId: ALBUM, destino: 'foto', idArquivo: ARQ, nome: 'a.png', tipo: 'image/png', tamanho: 10 }))
    expect(r.status).toBe(200)
    expect((await r.json()).key).toBe(`albuns/${ALBUM}/${ARQ}-a.png`)
  })

  it('álbum de projeto só recebe versões leves', async () => {
    sessao.deProjeto = true
    const foto = await assinarAlbum(req({ albumId: ALBUM, destino: 'foto', idArquivo: ARQ, nome: 'a.png', tipo: 'image/png', tamanho: 10 }))
    expect(foto.status).toBe(400)
    const mini = await assinarAlbum(req({ albumId: ALBUM, destino: 'derivado', fotoId: ARQ, variante: 'mini', tipo: 'image/jpeg', tamanho: 10 }))
    expect((await mini.json()).key).toBe(`albuns/${ALBUM}/derivados/${ARQ}-mini.jpg`)
  })

  it('403 fora da equipe de produção', async () => {
    sessao.ok = false
    const r = await assinarAlbum(req({ albumId: ALBUM, destino: 'aprovacao', aprovacaoId: ARQ, ordem: 1, tipo: 'image/jpeg', tamanho: 10 }))
    expect(r.status).toBe(403)
    expect(r2.urlDeEnvio).not.toHaveBeenCalled()
  })
})

describe('biblioteca de mídia (/api/uploads/midia)', () => {
  const KEY = `vitrine/${ARQ}-banner.webp`

  it('assina no bucket público', async () => {
    const r = await assinarMidia(req({ idArquivo: ARQ, nome: 'banner.webp', tipo: 'image/webp', tamanho: 10 }))
    expect((await r.json()).key).toBe(KEY)
    expect(r2.urlDeEnvio).toHaveBeenCalledWith(KEY, 'image/webp', 10, 'publico')
  })

  it('recusa SVG', async () => {
    expect((await assinarMidia(req({ idArquivo: ARQ, nome: 'a.svg', tipo: 'image/svg+xml', tamanho: 10 }))).status).toBe(400)
  })

  it('confirmar grava a chave com bucket r2 e o endereço público', async () => {
    r2.metadadosDoObjeto.mockResolvedValue({ tamanho: 5000, contentType: 'image/webp' })
    const r = await confirmarMidia(req({ key: KEY, nome: 'banner.webp', tags: ['Geral', 'inventada'], larguraPx: 1600, alturaPx: 900 }))
    expect(r.status).toBe(200)
    expect(r2.metadadosDoObjeto).toHaveBeenCalledWith(KEY, 'publico')
    expect(operacoes('media_assets', 'insert')[0].dados).toEqual({
      storage_path: KEY,
      bucket: 'r2',
      url: `https://midia.exemplo/${KEY}`,
      nome: 'banner.webp',
      tags: ['Geral'],
      largura_px: 1600,
      altura_px: 900,
      tamanho_kb: 5,
      criado_por: USER,
    })
  })

  it('503 sem o bucket público configurado', async () => {
    Object.assign(sessao, { ok: false, status: 503 })
    expect((await assinarMidia(req({ idArquivo: ARQ, nome: 'a.png', tipo: 'image/png', tamanho: 10 }))).status).toBe(503)
  })
})

describe('logo do estúdio (/api/uploads/logo)', () => {
  const KEY = `logos/${USER}/${ARQ}-logo.png`

  it('a chave sai sempre na pasta de quem está logado', async () => {
    const r = await assinarLogo(req({ idArquivo: ARQ, nome: 'logo.png', tipo: 'image/png', tamanho: 10 }))
    expect((await r.json()).key).toBe(KEY)
    expect(r2.urlDeEnvio).toHaveBeenCalledWith(KEY, 'image/png', 10, 'publico')
  })

  it('400 para logo na pasta de outro fotógrafo', async () => {
    expect((await confirmarLogo(req({ key: `logos/${PROJETO}/${ARQ}-logo.png` }))).status).toBe(400)
    expect(r2.metadadosDoObjeto).not.toHaveBeenCalled()
  })

  it('grava chave, marca e endereço público; apaga o logo anterior do R2', async () => {
    const ANTERIOR = `logos/${USER}/${PROJETO}-velho.png`
    r2.metadadosDoObjeto.mockResolvedValue({ tamanho: 100, contentType: 'image/png' })
    banco.responder = (c) =>
      c.operacao === 'select' ? { data: { logo_path: ANTERIOR, logo_bucket: 'r2' } } : { data: { id: USER } }
    const r = await confirmarLogo(req({ key: KEY }))
    expect(r.status).toBe(200)
    expect(operacoes('fotografos', 'update')[0].dados).toEqual({ logo_path: KEY, logo_bucket: 'r2', logo_url: `https://midia.exemplo/${KEY}` })
    expect(r2.removerObjetos).toHaveBeenCalledWith([ANTERIOR], 'publico')
  })

  it('logo antigo do Supabase não é apagado', async () => {
    r2.metadadosDoObjeto.mockResolvedValue({ tamanho: 100, contentType: 'image/png' })
    banco.responder = (c) => (c.operacao === 'select' ? { data: { logo_path: null, logo_bucket: null } } : { data: { id: USER } })
    expect((await confirmarLogo(req({ key: KEY }))).status).toBe(200)
    expect(r2.removerObjetos).not.toHaveBeenCalled()
  })
})
