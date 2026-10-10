import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Rotas do R2 de ponta a ponta, com o Supabase e o SDK do R2 simulados:
 * confere o contrato HTTP (status e corpo) e a ordem das operações.
 */

vi.mock('server-only', () => ({}))

const USER = '11111111-1111-4111-8111-111111111111'
const CHAVE = '22222222-2222-4222-8222-222222222222'
const ARQ = '33333333-3333-4333-8333-333333333333'
const KEY = `pedidos/${USER}/${CHAVE}/${ARQ}-a.jpg`

const r2 = vi.hoisted(() => ({
  configurado: true,
  urlDeEnvio: vi.fn(),
  metadadosDoObjeto: vi.fn(),
  removerObjetos: vi.fn(),
}))
vi.mock('@/lib/r2/cliente', () => ({
  r2Configurado: () => r2.configurado,
  urlDeEnvio: r2.urlDeEnvio,
  metadadosDoObjeto: r2.metadadosDoObjeto,
  removerObjetos: r2.removerObjetos,
}))

/** Banco falso: só o que as rotas usam. */
const banco = vi.hoisted(() => ({
  pedidoExiste: false,
  insertErro: null as null | { code: string; message: string },
  inseridos: [] as Record<string, unknown>[],
  apagados: [] as string[],
  expiradas: [] as string[],
  ordem: [] as string[],
}))

function supabaseFalso() {
  return {
    from(tabela: string) {
      if (tabela === 'orders') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: banco.pedidoExiste ? { id: 'x' } : null, error: null }) }) }),
        }
      }
      return {
        insert: (linha: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              if (banco.insertErro) return { data: null, error: banco.insertErro }
              banco.inseridos.push(linha)
              return { data: { id: 'nova' }, error: null }
            },
          }),
        }),
        delete: () => ({
          eq: async (_c: string, key: string) => (banco.apagados.push(key), banco.ordem.push('banco'), { error: null }),
          in: async (_c: string, keys: string[]) => (banco.apagados.push(...keys), banco.ordem.push('banco'), { error: null }),
        }),
      }
    },
    rpc: async () => ({ data: banco.expiradas.map((r2_key) => ({ r2_key })), error: null }),
  }
}

const sessao = vi.hoisted(() => ({ logado: true, equipe: true }))
vi.mock('@/lib/r2/sessao', async () => {
  const { NextResponse } = await import('next/server')
  return {
    fotografoParaUpload: async () =>
      sessao.logado
        ? { ok: true, supabase: supabaseFalso(), userId: USER }
        : { ok: false, resposta: NextResponse.json({ erro: 'Faça login de novo.' }, { status: 401 }) },
    producaoParaUpload: async () =>
      sessao.equipe
        ? { ok: true, supabase: supabaseFalso(), userId: USER }
        : { ok: false, resposta: NextResponse.json({ erro: 'Sem permissão para enviar lâminas.' }, { status: 403 }) },
    rascunhoJaEnviado: async () => banco.pedidoExiste,
    lerJson: async (r: Request) => r.json().catch(() => null),
  }
})
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => supabaseFalso() }))

const { POST: assinar, DELETE: remover } = await import('@/app/api/uploads/pedido-foto/route')
const { POST: confirmar } = await import('@/app/api/uploads/pedido-foto/confirmar/route')
const { GET: limpar } = await import('@/app/api/cron/limpar-fotos-r2/route')
const { POST: assinarLamina } = await import('@/app/api/uploads/lamina/route')

function req(metodo: string, corpo?: unknown, url = 'http://localhost/api/x', headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...headers },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

beforeEach(() => {
  r2.configurado = true
  sessao.logado = true
  sessao.equipe = true
  Object.assign(banco, { pedidoExiste: false, insertErro: null, inseridos: [], apagados: [], expiradas: [], ordem: [] })
  r2.urlDeEnvio.mockReset().mockResolvedValue({ url: 'https://r2/put', expiraEm: 'x' })
  r2.metadadosDoObjeto.mockReset().mockResolvedValue({ tamanho: 1234, contentType: 'image/jpeg' })
  r2.removerObjetos.mockReset().mockImplementation(async () => banco.ordem.push('r2'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('POST /api/uploads/pedido-foto (assinar)', () => {
  const corpo = { chave: CHAVE, idArquivo: ARQ, nome: 'a.jpg', tipo: 'image/jpeg', tamanho: 1234 }

  it('devolve a URL de PUT e a chave na pasta do rascunho', async () => {
    const r = await assinar(req('POST', corpo))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ key: KEY, url: 'https://r2/put', metodo: 'PUT', headers: { 'Content-Type': 'image/jpeg' } })
    expect(r2.urlDeEnvio).toHaveBeenCalledWith(KEY, 'image/jpeg', 1234)
  })

  it('401 sem sessão', async () => {
    sessao.logado = false
    expect((await assinar(req('POST', corpo))).status).toBe(401)
  })

  it('400 com formato inválido, sem assinar nada', async () => {
    const r = await assinar(req('POST', { ...corpo, tipo: 'application/pdf' }))
    expect(r.status).toBe(400)
    expect(r2.urlDeEnvio).not.toHaveBeenCalled()
  })

  it('409 quando o rascunho já virou pedido', async () => {
    banco.pedidoExiste = true
    expect((await assinar(req('POST', corpo))).status).toBe(409)
  })

  it('500 com mensagem clara se o R2 falhar ao assinar', async () => {
    r2.urlDeEnvio.mockRejectedValue(new Error('token inválido'))
    const r = await assinar(req('POST', corpo))
    expect(r.status).toBe(500)
    expect((await r.json()).erro).toMatch(/Não foi possível preparar o envio/)
  })
})

describe('POST /api/uploads/pedido-foto/confirmar', () => {
  it('grava só a chave e os metadados vindos do R2', async () => {
    const r = await confirmar(req('POST', { key: KEY, nome: 'Noiva.jpg', capturadaEm: '2026-05-01T18:30:00', camera: 'R5' }))
    expect(r.status).toBe(200)
    expect(banco.inseridos).toEqual([
      {
        client_id: USER,
        chave_idempotencia: CHAVE,
        r2_key: KEY,
        nome_original: 'Noiva.jpg',
        tamanho: 1234,
        content_type: 'image/jpeg',
        capturada_em: '2026-05-01T18:30:00',
        camera: 'R5',
      },
    ])
  })

  it('400 para chave de outro usuário', async () => {
    const r = await confirmar(req('POST', { key: `pedidos/${CHAVE}/${CHAVE}/${ARQ}-a.jpg` }))
    expect(r.status).toBe(400)
    expect(r2.metadadosDoObjeto).not.toHaveBeenCalled()
  })

  it('404 quando o PUT não chegou ao R2', async () => {
    r2.metadadosDoObjeto.mockResolvedValue(null)
    expect((await confirmar(req('POST', { key: KEY }))).status).toBe(404)
  })

  it('apaga do R2 e recusa o que passou do limite', async () => {
    r2.metadadosDoObjeto.mockResolvedValue({ tamanho: 60 * 1024 * 1024, contentType: 'image/jpeg' })
    expect((await confirmar(req('POST', { key: KEY }))).status).toBe(400)
    expect(r2.removerObjetos).toHaveBeenCalledWith([KEY])
    expect(banco.inseridos).toEqual([])
  })

  it('confirmar duas vezes é sucesso (idempotente)', async () => {
    banco.insertErro = { code: '23505', message: 'duplicate' }
    const r = await confirmar(req('POST', { key: KEY }))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ jaRegistrada: true })
  })
})

describe('DELETE /api/uploads/pedido-foto', () => {
  it('tira do índice e do R2', async () => {
    expect((await remover(req('DELETE', { key: KEY }))).status).toBe(200)
    expect(banco.apagados).toEqual([KEY])
    expect(r2.removerObjetos).toHaveBeenCalledWith([KEY])
  })

  it('409 depois que o pedido foi enviado', async () => {
    banco.pedidoExiste = true
    expect((await remover(req('DELETE', { key: KEY }))).status).toBe(409)
    expect(r2.removerObjetos).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/limpar-fotos-r2', () => {
  const url = 'http://localhost/api/cron/limpar-fotos-r2'
  const auth = { authorization: 'Bearer segredo-cron' }
  beforeEach(() => {
    process.env.CRON_SECRET = 'segredo-cron'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'
  })

  it('401 sem o segredo do cron', async () => {
    expect((await limpar(req('GET', undefined, url))).status).toBe(401)
    expect((await limpar(req('GET', undefined, url, { authorization: 'Bearer outro' }))).status).toBe(401)
  })

  it('401 com CRON_SECRET ausente ou vazio, mesmo com cabeçalho (falha fechada)', async () => {
    for (const valor of [undefined, '']) {
      if (valor === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = valor
      for (const authorization of ['Bearer undefined', 'Bearer ', 'Bearer']) {
        expect((await limpar(req('GET', undefined, url, { authorization }))).status).toBe(401)
      }
    }
    expect(r2.removerObjetos).not.toHaveBeenCalled()
  })

  it('apaga primeiro no R2, depois no índice', async () => {
    banco.expiradas = [KEY]
    const r = await limpar(req('GET', undefined, url, auth))
    expect(await r.json()).toEqual({ ok: true, apagadas: 1 })
    expect(banco.ordem).toEqual(['r2', 'banco'])
  })

  it('se o R2 falhar, o índice fica intacto para a próxima execução', async () => {
    banco.expiradas = [KEY]
    r2.removerObjetos.mockRejectedValue(new Error('403'))
    expect((await limpar(req('GET', undefined, url, auth))).status).toBe(502)
    expect(banco.apagados).toEqual([])
  })

  it('dry_run só conta', async () => {
    banco.expiradas = [KEY, KEY]
    const r = await limpar(req('GET', undefined, `${url}?dry_run=1`, auth))
    expect(await r.json()).toEqual({ ok: true, dryRun: true, encontradas: 2 })
    expect(r2.removerObjetos).not.toHaveBeenCalled()
  })

  it('503 sem R2 configurado', async () => {
    r2.configurado = false
    expect((await limpar(req('GET', undefined, url, auth))).status).toBe(503)
  })
})

describe('POST /api/uploads/lamina', () => {
  const corpo = { projetoId: USER, lote: CHAVE, idArquivo: ARQ, nome: 'l1.jpg', tipo: 'image/jpeg', tamanho: 999 }

  it('assina o PUT na pasta do lote', async () => {
    const r = await assinarLamina(req('POST', corpo))
    expect(r.status).toBe(200)
    expect((await r.json()).key).toBe(`projetos/${USER}/versoes/${CHAVE}/${ARQ}-l1.jpg`)
  })

  it('403 fora da equipe de produção', async () => {
    sessao.equipe = false
    expect((await assinarLamina(req('POST', corpo))).status).toBe(403)
    expect(r2.urlDeEnvio).not.toHaveBeenCalled()
  })

  it('400 para PNG', async () => {
    expect((await assinarLamina(req('POST', { ...corpo, tipo: 'image/png' }))).status).toBe(400)
  })
})
