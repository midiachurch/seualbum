import 'server-only'

import {
  CreateCollectionCommand,
  DeleteCollectionCommand,
  DeleteFacesCommand,
  IndexFacesCommand,
  ListCollectionsCommand,
  RekognitionClient,
  RekognitionServiceException,
  SearchFacesByImageCommand,
} from '@aws-sdk/client-rekognition'
import { LIMIAR_SIMILARIDADE, MAX_ROSTOS_POR_FOTO, nomeDaColecao, prefixoColecoes } from '@/lib/rekognition/regras'

/**
 * AWS Rekognition para o "Encontrar minhas fotos" (migration 0042). As fotos
 * continuam no R2: o Rekognition recebe só os bytes de uma cópia reduzida
 * (`indexacao.ts`) ou da selfie — nada vai para o S3.
 *
 * Uma coleção por projeto (`seualbum-{ref do Supabase}-{projetoId}`): a busca
 * nunca cruza projetos e desligar/vencer apaga tudo de uma vez.
 *
 * Variáveis: AWS_REKOGNITION_REGION, AWS_REKOGNITION_ACCESS_KEY_ID,
 * AWS_REKOGNITION_SECRET_ACCESS_KEY (usuário IAM só com rekognition:*Collection*,
 * IndexFaces, SearchFacesByImage, DeleteFaces). Criado sob demanda, como o R2:
 * sem as variáveis o build não quebra e a feature some da tela.
 */

let client: RekognitionClient | null = null

export function rekognitionConfigurado() {
  return Boolean(
    process.env.AWS_REKOGNITION_REGION &&
      process.env.AWS_REKOGNITION_ACCESS_KEY_ID &&
      process.env.AWS_REKOGNITION_SECRET_ACCESS_KEY,
  )
}

function getRekognition() {
  if (!rekognitionConfigurado()) throw new Error('AWS Rekognition não configurado (AWS_REKOGNITION_*)')
  client ??= new RekognitionClient({
    region: process.env.AWS_REKOGNITION_REGION,
    // Cota baixa por região (5 TPS em sa-east-1): ThrottlingException volta
    // com espera crescente antes de virar erro.
    maxAttempts: 6,
    credentials: {
      accessKeyId: process.env.AWS_REKOGNITION_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_REKOGNITION_SECRET_ACCESS_KEY!,
    },
  })
  return client
}

export const PREFIXO_COLECOES = prefixoColecoes(process.env.NEXT_PUBLIC_SUPABASE_URL)

export function colecaoDoProjeto(projetoId: string) {
  return nomeDaColecao(PREFIXO_COLECOES, projetoId)
}

export function nomeDoErro(e: unknown): string | undefined {
  return e instanceof RekognitionServiceException ? e.name : undefined
}

async function garantirColecao(colecao: string) {
  try {
    await getRekognition().send(new CreateCollectionCommand({ CollectionId: colecao }))
  } catch (e) {
    if (nomeDoErro(e) !== 'ResourceAlreadyExistsException') throw e
  }
}

/**
 * Indexa os rostos de uma foto. `ExternalImageId` = id da foto, para depurar
 * pelo console da AWS. Acima de 15 rostos o Rekognition guarda só os maiores
 * (`MaxFaces`) — foto de multidão não suja o índice.
 */
export async function indexarRostos(projetoId: string, fotoId: string, jpeg: Uint8Array): Promise<string[]> {
  const colecao = colecaoDoProjeto(projetoId)
  const comando = () =>
    getRekognition().send(
      new IndexFacesCommand({
        CollectionId: colecao,
        Image: { Bytes: jpeg },
        ExternalImageId: fotoId,
        MaxFaces: MAX_ROSTOS_POR_FOTO,
        QualityFilter: 'AUTO',
        DetectionAttributes: [],
      }),
    )
  let r
  try {
    r = await comando()
  } catch (e) {
    if (nomeDoErro(e) !== 'ResourceNotFoundException') throw e
    await garantirColecao(colecao)
    r = await comando()
  }
  return (r.FaceRecords ?? []).map((f) => f.Face?.FaceId).filter((id): id is string => typeof id === 'string')
}

/** Rostos da coleção parecidos com o maior rosto da selfie. Lança o erro do Rekognition (ver `classificarErroBusca`). */
export async function buscarPorSelfie(projetoId: string, imagem: Uint8Array) {
  const r = await getRekognition().send(
    new SearchFacesByImageCommand({
      CollectionId: colecaoDoProjeto(projetoId),
      Image: { Bytes: imagem },
      MaxFaces: 1000,
      FaceMatchThreshold: LIMIAR_SIMILARIDADE,
      QualityFilter: 'AUTO',
    }),
  )
  return (r.FaceMatches ?? [])
    .map((m) => ({ faceId: m.Face?.FaceId ?? '', similaridade: m.Similarity ?? 0 }))
    .filter((m) => m.faceId)
}

/** Apaga FaceIds (lotes de 4096, o limite da API). Coleção inexistente = nada a apagar. */
export async function removerRostos(projetoId: string, faceIds: string[]) {
  for (let i = 0; i < faceIds.length; i += 4096) {
    try {
      await getRekognition().send(
        new DeleteFacesCommand({ CollectionId: colecaoDoProjeto(projetoId), FaceIds: faceIds.slice(i, i + 4096) }),
      )
    } catch (e) {
      if (nomeDoErro(e) === 'ResourceNotFoundException') return
      throw e
    }
  }
}

export async function removerColecao(colecao: string) {
  try {
    await getRekognition().send(new DeleteCollectionCommand({ CollectionId: colecao }))
  } catch (e) {
    if (nomeDoErro(e) !== 'ResourceNotFoundException') throw e
  }
}

/** Todas as coleções da conta/região (paginado). */
export async function listarColecoes(): Promise<string[]> {
  const colecoes: string[] = []
  let token: string | undefined
  do {
    const r = await getRekognition().send(new ListCollectionsCommand({ NextToken: token, MaxResults: 1000 }))
    colecoes.push(...(r.CollectionIds ?? []))
    token = r.NextToken
  } while (token)
  return colecoes
}
