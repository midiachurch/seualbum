import 'server-only'

import decodificarHeic from 'heic-decode'
import sharp, { type Sharp } from 'sharp'
import { lerObjeto, metadadosDoObjeto } from '@/lib/r2/cliente'
import { indexarRostos, removerRostos } from '@/lib/rekognition/cliente'
import { ehHeic, extensaoIndexavel, LADO_MAXIMO_ANALISE, TAMANHO_MAXIMO_ORIGINAL } from '@/lib/rekognition/regras'
import type { createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>
type Status = 'indexada' | 'sem_rosto' | 'nao_suportada' | 'erro'

export type FotoNaFila = { foto_id: string; projeto_id: string; storage_path: string; tentativas: number }
export type ResumoIndexacao = { processadas: number; rostos: number; erros: number }

// São Paulo (sa-east-1) aceita 5 IndexFaces por segundo por conta; a busca
// do cliente e os uploads disputam a mesma cota.
const PARALELO = 3

/**
 * Cópia JPEG para o Rekognition (até 1920 px, no máximo 5 MB pela API). HEIC/HEIF
 * (iPhone) passa antes pelo libheif em WebAssembly — o sharp pré-compilado
 * não decodifica HEVC — e chega ao sharp como pixels crus, já na orientação certa.
 */
async function copiaDeAnalise(bytes: Uint8Array, heic: boolean): Promise<Buffer> {
  let imagem: Sharp
  if (heic) {
    const { width, height, data } = await decodificarHeic({ buffer: bytes })
    imagem = sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels: 4 } })
  } else {
    imagem = sharp(bytes, { failOn: 'none' }).rotate()
  }
  return imagem
    .resize({ width: LADO_MAXIMO_ANALISE, height: LADO_MAXIMO_ANALISE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
}

/**
 * Indexação dos rostos de uma foto do projeto — o "pipeline da Lambda" do
 * caderno, rodando na Vercel:
 *
 *   1. só JPG/PNG/WebP/HEIC/HEIF;
 *   2. baixa o original do R2 e gera uma cópia JPEG de até 1920 px
 *      (`copiaDeAnalise`) — o original não muda;
 *   3. IndexFaces na coleção do projeto (até 15 rostos por foto);
 *   4. grava FaceId → foto em `reconhecimento_rostos` e o estado em
 *      `reconhecimento_fotos`.
 *
 * Erro do Rekognition/R2 fica `erro` e volta para a fila (até 3 tentativas).
 */
async function indexarUma(admin: Admin, foto: FotoNaFila): Promise<{ status: Status; rostos: number }> {
  if (!extensaoIndexavel(foto.storage_path)) return { status: 'nao_suportada', rostos: 0 }

  const meta = await metadadosDoObjeto(foto.storage_path)
  if (!meta) return { status: 'erro', rostos: 0 }
  if (meta.tamanho > TAMANHO_MAXIMO_ORIGINAL) return { status: 'nao_suportada', rostos: 0 }

  const { bytes } = await lerObjeto(foto.storage_path)
  let jpeg: Buffer
  try {
    jpeg = await copiaDeAnalise(bytes, ehHeic(foto.storage_path))
  } catch {
    return { status: 'nao_suportada', rostos: 0 }
  }

  const faceIds = await indexarRostos(foto.projeto_id, foto.foto_id, jpeg)
  if (faceIds.length === 0) return { status: 'sem_rosto', rostos: 0 }

  const { error } = await admin
    .from('reconhecimento_rostos')
    .insert(faceIds.map((face_id) => ({ face_id, foto_id: foto.foto_id, projeto_id: foto.projeto_id })))
  if (error) {
    // Foto apagada (ou busca desligada) no meio do caminho: não deixa rosto
    // sem dono na coleção.
    await removerRostos(foto.projeto_id, faceIds).catch(() => {})
    throw new Error(`índice de rostos: ${error.message}`)
  }
  return { status: 'indexada', rostos: faceIds.length }
}

async function processarUma(admin: Admin, foto: FotoNaFila, resumo: ResumoIndexacao) {
  let resultado: { status: Status; rostos: number }
  try {
    resultado = await indexarUma(admin, foto)
  } catch (e) {
    console.error('[reconhecimento:indexar]', foto.foto_id, e instanceof Error ? e.message : e)
    resultado = { status: 'erro', rostos: 0 }
  }
  const { error } = await admin.from('reconhecimento_fotos').upsert({
    foto_id: foto.foto_id,
    projeto_id: foto.projeto_id,
    status: resultado.status,
    rostos: resultado.rostos,
    tentativas: resultado.status === 'erro' ? foto.tentativas + 1 : Math.max(1, foto.tentativas),
    atualizado_em: new Date().toISOString(),
  })
  // FK: a foto saiu de `fotos` enquanto era lida — nada a registrar.
  if (error && error.code !== '23503') console.error('[reconhecimento:indexar] estado', foto.foto_id, error.message)
  resumo.processadas += 1
  resumo.rostos += resultado.rostos
  if (resultado.status === 'erro') resumo.erros += 1
}

/**
 * Esvazia a fila (`fotos_para_indexar`) até o prazo: 4 fotos em paralelo,
 * sem começar foto nova depois de `prazo` (epoch ms). `projetoId` null = todos
 * os projetos ligados (Cron).
 */
export async function processarFila(admin: Admin, opcoes: { projetoId?: string | null; prazo: number }): Promise<ResumoIndexacao & { restantes: boolean }> {
  const resumo: ResumoIndexacao = { processadas: 0, rostos: 0, erros: 0 }
  const vistas = new Set<string>()

  while (Date.now() < opcoes.prazo) {
    const { data, error } = await admin.rpc('fotos_para_indexar', { p_projeto_id: opcoes.projetoId ?? null, p_limite: 40 })
    if (error) throw new Error(`fila: ${error.message}`)
    // Erro que ainda tem tentativa volta na mesma consulta: cada foto uma vez por chamada.
    const fila = (data ?? []).filter((f) => !vistas.has(f.foto_id))
    if (fila.length === 0) return { ...resumo, restantes: false }

    for (let i = 0; i < fila.length && Date.now() < opcoes.prazo; i += PARALELO) {
      const lote = fila.slice(i, i + PARALELO)
      lote.forEach((f) => vistas.add(f.foto_id))
      await Promise.all(lote.map((f) => processarUma(admin, f, resumo)))
    }
  }
  return { ...resumo, restantes: true }
}

/** Foto recém-confirmada: indexa na hora se o projeto estiver com a busca ligada. */
export async function indexarFotoNova(admin: Admin, foto: { fotoId: string; projetoId: string; key: string }) {
  const { data: ativo } = await admin
    .from('reconhecimento_projetos')
    .select('projeto_id')
    .eq('projeto_id', foto.projetoId)
    .gt('expira_em', new Date().toISOString())
    .maybeSingle()
  if (!ativo) return
  await processarUma(
    admin,
    { foto_id: foto.fotoId, projeto_id: foto.projetoId, storage_path: foto.key, tentativas: 0 },
    { processadas: 0, rostos: 0, erros: 0 },
  )
}
