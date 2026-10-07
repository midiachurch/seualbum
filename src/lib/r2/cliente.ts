import 'server-only'

import {
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
 */

const EXPIRACAO_ENVIO_S = 15 * 60
const EXPIRACAO_LEITURA_S = 60 * 60

let client: S3Client | null = null

export function r2Configurado() {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET,
  )
}

function bucket() {
  const b = process.env.R2_BUCKET
  if (!b) throw new Error('R2_BUCKET não configurado')
  return b
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
export async function urlDeEnvio(key: string, contentType: string, tamanho: number) {
  const url = await getSignedUrl(
    getR2(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: tamanho }),
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
export async function metadadosDoObjeto(key: string) {
  try {
    const head = await getR2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return { tamanho: Number(head.ContentLength ?? 0), contentType: head.ContentType ?? 'application/octet-stream' }
  } catch (e) {
    if (e instanceof S3ServiceException && (e.$metadata.httpStatusCode === 404 || e.name === 'NotFound')) return null
    throw e
  }
}

/** Apaga em lotes de 1000 (limite do DeleteObjects). */
export async function removerObjetos(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const lote = keys.slice(i, i + 1000)
    await getR2().send(
      new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: lote.map((Key) => ({ Key })), Quiet: true } }),
    )
  }
}
