import 'server-only'

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Cloudflare R2 pela API compatível com S3. Bucket privado: o navegador só
 * fala com o R2 por URLs pré-assinadas de curta duração, geradas aqui depois
 * da checagem de sessão — as credenciais nunca saem do servidor.
 *
 * O upload vai direto do navegador para o R2 (PUT na URL assinada): passar
 * 50 MB pela função da Vercel estouraria o limite de corpo (~4,5 MB).
 *
 * Variáveis: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 * Criado sob demanda, como o Stripe: sem as variáveis o build não quebra.
 *
 * Arquivos públicos (vitrine e logos dos estúdios) ficam num SEGUNDO bucket,
 * com acesso público pelo domínio próprio do R2: R2_PUBLIC_BUCKET e
 * R2_PUBLIC_URL (ex.: https://midia.seualbum.com.br). Mesmo token de API — ele
 * precisa de Object Read & Write nos dois buckets. Ver `Alvo`.
 */

/** Em qual bucket do R2 a operação acontece. */
export type Alvo = 'privado' | 'publico'

const EXPIRACAO_ENVIO_S = 15 * 60
const EXPIRACAO_LEITURA_S = 60 * 60

let client: S3Client | null = null

export function r2Configurado() {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET,
  )
}

/** Bucket público configurado (vitrine e logos)? Exige também o R2 privado (mesmas credenciais). */
export function r2PublicoConfigurado() {
  return r2Configurado() && Boolean(process.env.R2_PUBLIC_BUCKET && process.env.R2_PUBLIC_URL)
}

function bucket(alvo: Alvo = 'privado') {
  const b = alvo === 'publico' ? process.env.R2_PUBLIC_BUCKET : process.env.R2_BUCKET
  if (!b) throw new Error(alvo === 'publico' ? 'R2_PUBLIC_BUCKET não configurado' : 'R2_BUCKET não configurado')
  return b
}

/**
 * Endereço permanente de um arquivo do bucket público (sem assinatura, com
 * cache do CDN da Cloudflare). `null` sem R2_PUBLIC_URL.
 */
export function urlPublica(key: string): string | null {
  const base = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, '')
  if (!base) return null
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
}

export function getR2() {
  if (!r2Configurado()) throw new Error('Cloudflare R2 não configurado (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET)')
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    // conta.r2.cloudflarestorage.com/{bucket}/... — o formato que o R2 garante.
    forcePathStyle: true,
    // O R2 não aceita os checksums CRC32 que o SDK v3 passou a mandar por
    // padrão em URLs assinadas; só calcula quando a operação exige.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return client
}

/**
 * URL para o navegador enviar UM arquivo com PUT. Tipo e tamanho entram na
 * assinatura: o R2 recusa um corpo diferente do que foi validado aqui.
 */
export async function urlDeEnvio(key: string, contentType: string, tamanho: number, alvo: Alvo = 'privado') {
  const url = await getSignedUrl(
    getR2(),
    new PutObjectCommand({ Bucket: bucket(alvo), Key: key, ContentType: contentType, ContentLength: tamanho }),
    { expiresIn: EXPIRACAO_ENVIO_S, signableHeaders: new Set(['content-type', 'content-length']) },
  )
  return { url, expiraEm: new Date(Date.now() + EXPIRACAO_ENVIO_S * 1000).toISOString() }
}

/** URL de leitura temporária. Com `nomeDownload`, o navegador baixa em vez de abrir. */
export async function urlDeLeitura(key: string, opcoes: { nomeDownload?: string; expiraEmS?: number } = {}) {
  const disposicao = opcoes.nomeDownload
    ? `attachment; filename="${opcoes.nomeDownload.replace(/["\\\r\n]/g, '_')}"`
    : undefined
  return getSignedUrl(getR2(), new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: disposicao }), {
    expiresIn: opcoes.expiraEmS ?? EXPIRACAO_LEITURA_S,
  })
}

/** Metadados do objeto no R2, ou `null` se ele não existe. */
export async function metadadosDoObjeto(key: string, alvo: Alvo = 'privado') {
  try {
    const head = await getR2().send(new HeadObjectCommand({ Bucket: bucket(alvo), Key: key }))
    return { tamanho: Number(head.ContentLength ?? 0), contentType: head.ContentType ?? 'application/octet-stream' }
  } catch (e) {
    if (e instanceof S3ServiceException && (e.$metadata.httpStatusCode === 404 || e.name === 'NotFound')) return null
    throw e
  }
}

/** Apaga em lotes de 1000 (limite do DeleteObjects). */
export async function removerObjetos(keys: string[], alvo: Alvo = 'privado') {
  for (let i = 0; i < keys.length; i += 1000) {
    const lote = keys.slice(i, i + 1000)
    await getR2().send(
      new DeleteObjectsCommand({ Bucket: bucket(alvo), Delete: { Objects: lote.map((Key) => ({ Key })), Quiet: true } }),
    )
  }
}

/**
 * Links de leitura para várias chaves (chave → url). Nunca lança: sem R2
 * configurado ou com o token recusado, devolve o que conseguiu e loga — a
 * página que mostra as fotos continua de pé, só sem a imagem.
 * Assinar é local (HMAC), sem ida ao R2: centenas de chaves custam pouco.
 */
export async function assinarLeituras(keys: string[], expiraEmS = EXPIRACAO_LEITURA_S): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  if (keys.length === 0) return urls
  if (!r2Configurado()) {
    console.error('[r2] assinarLeituras: R2 não configurado —', keys.length, 'arquivo(s) sem link')
    return urls
  }
  await Promise.all(
    [...new Set(keys)].map(async (key) => {
      try {
        urls.set(key, await urlDeLeitura(key, { expiraEmS }))
      } catch (e) {
        console.error('[r2] assinarLeituras', key, e instanceof Error ? e.message : e)
      }
    }),
  )
  return urls
}

/** Conteúdo do objeto (para copiar do R2 para outro armazenamento). */
export async function lerObjeto(key: string) {
  const r = await getR2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
  if (!r.Body) throw new Error(`Objeto vazio no R2: ${key}`)
  return { bytes: await r.Body.transformToByteArray(), contentType: r.ContentType ?? 'application/octet-stream' }
}

/** Grava um objeto a partir do servidor (cópia de arquivo antigo do Supabase Storage para o R2). */
export async function enviarObjeto(key: string, bytes: Uint8Array, contentType: string, alvo: Alvo = 'privado') {
  await getR2().send(new PutObjectCommand({ Bucket: bucket(alvo), Key: key, Body: bytes, ContentType: contentType }))
}

/** Cópia dentro do bucket privado, sem baixar o arquivo (duplicar álbum). */
export async function copiarObjeto(origem: string, destino: string) {
  const b = bucket()
  await getR2().send(
    new CopyObjectCommand({ Bucket: b, Key: destino, CopySource: `${b}/${origem.split('/').map(encodeURIComponent).join('/')}` }),
  )
}
