// R2 falso para os testes de navegador do editor: um S3 mínimo, em memória,
// só com o que o app usa (PUT, HEAD, GET, DELETE em lote e cópia). Não confere
// assinatura. Nunca roda em produção: só o Playwright o sobe (webServer).
//
//   R2_FALSO_PORTA=56490 node e2e/editor/r2-falso/servidor.mjs
//
// Extras para os testes: GET /__objetos lista as chaves (JSON) e
// DELETE /__objetos esvazia tudo.
import { createServer } from 'node:http'

const porta = Number(process.env.R2_FALSO_PORTA ?? 56490)
/** `${bucket}/${key}` → { corpo, tipo } */
const objetos = new Map()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, POST, DELETE',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'ETag',
}

function ler(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    req.on('data', (p) => partes.push(p))
    req.on('end', () => resolve(Buffer.concat(partes)))
    req.on('error', reject)
  })
}

function responder(res, status, corpo = '', cabecalhos = {}) {
  res.writeHead(status, { ...CORS, ...cabecalhos })
  res.end(corpo)
}

const naoExiste = (chave) =>
  `<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>Not found</Message><Key>${chave}</Key></Error>`

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://r2-falso')
    if (url.pathname === '/__objetos') {
      if (req.method === 'DELETE') objetos.clear()
      return responder(res, 200, JSON.stringify([...objetos.keys()]), { 'Content-Type': 'application/json' })
    }
    if (req.method === 'OPTIONS') return responder(res, 204)

    // Path-style: /{bucket}/{key...}
    const [, bucket, ...resto] = url.pathname.split('/')
    const chave = resto.map(decodeURIComponent).join('/')
    const id = `${bucket}/${chave}`

    if (req.method === 'POST' && url.searchParams.has('delete')) {
      const xml = (await ler(req)).toString('utf8')
      for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) objetos.delete(`${bucket}/${m[1].replace(/&amp;/g, '&')}`)
      return responder(res, 200, '<?xml version="1.0" encoding="UTF-8"?><DeleteResult></DeleteResult>', { 'Content-Type': 'application/xml' })
    }
    if (req.method === 'PUT') {
      const origem = req.headers['x-amz-copy-source']
      if (typeof origem === 'string') {
        await ler(req)
        const o = objetos.get(decodeURIComponent(origem.replace(/^\//, '')))
        if (!o) return responder(res, 404, naoExiste(origem), { 'Content-Type': 'application/xml' })
        objetos.set(id, o)
        return responder(
          res,
          200,
          `<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult><ETag>"falso"</ETag><LastModified>${new Date().toISOString()}</LastModified></CopyObjectResult>`,
          { 'Content-Type': 'application/xml' },
        )
      }
      const corpo = await ler(req)
      objetos.set(id, { corpo, tipo: req.headers['content-type'] ?? 'application/octet-stream' })
      return responder(res, 200, '', { ETag: '"falso"' })
    }
    const o = objetos.get(id)
    if (req.method === 'HEAD') {
      if (!o) return responder(res, 404)
      return responder(res, 200, '', { 'Content-Length': String(o.corpo.length), 'Content-Type': o.tipo, ETag: '"falso"' })
    }
    if (req.method === 'GET') {
      if (!o) return responder(res, 404, naoExiste(chave), { 'Content-Type': 'application/xml' })
      return responder(res, 200, o.corpo, { 'Content-Length': String(o.corpo.length), 'Content-Type': o.tipo, ETag: '"falso"' })
    }
    responder(res, 405)
  } catch (e) {
    responder(res, 500, String(e))
  }
})
// Conexões reaproveitadas (keep-alive) pelo Playwright e pelo SDK: não fecha por ociosidade no meio de um teste.
servidor.keepAliveTimeout = 120_000
servidor.headersTimeout = 125_000
servidor.listen(porta, '127.0.0.1', () => console.log(`[r2-falso] ouvindo em http://127.0.0.1:${porta}`))
