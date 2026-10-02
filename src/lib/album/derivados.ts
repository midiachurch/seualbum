'use client'

import { createClient } from '@/lib/supabase/client'
import { LADO_MINI, LADO_PREVIEW, medirEstouro, medirFoco, medirMonocromia, reduzirParaJpg } from '@/lib/album/ajustes'
import { salvarDerivados } from '@/lib/actions/album-editor'
import type { DerivadoFoto } from '@/types/database'

/**
 * Versões leves de uma foto, geradas no navegador: miniatura (biblioteca,
 * fita, listas) e prévia (canvas e visualização), mais as medidas que o
 * editor precisa (dimensões, estouro, ponto de interesse). O original fica
 * intocado no Storage e só é usado na exportação.
 */

export type DerivadoGerado = DerivadoFoto & { urlMini: string; urlPreview: string }

let filaDeRegistro: Promise<unknown> = Promise.resolve()

/**
 * `salvarDerivados` lê o JSON, junta e grava: duas chamadas ao mesmo tempo
 * (os dois trabalhadores em segundo plano, ou eles e o upload do painel)
 * perderiam as entradas uma da outra. Aqui elas saem uma de cada vez.
 */
export function registrarDerivados(albumId: string, novos: Record<string, DerivadoFoto>) {
  const tarefa = filaDeRegistro.then(() => salvarDerivados(albumId, novos))
  filaDeRegistro = tarefa.catch(() => undefined)
  return tarefa
}

async function medir(fonte: HTMLImageElement | ImageBitmap) {
  const largura = 'naturalWidth' in fonte ? fonte.naturalWidth : fonte.width
  const altura = 'naturalHeight' in fonte ? fonte.naturalHeight : fonte.height
  const [mini, preview] = await Promise.all([reduzirParaJpg(fonte, LADO_MINI, 0.78), reduzirParaJpg(fonte, LADO_PREVIEW, 0.85)])
  // `medirEstouro` aceita só <img>; para bitmap, mede na miniatura.
  let estouro: number | null = null
  if ('naturalWidth' in fonte) estouro = medirEstouro(fonte)
  else {
    const img = await blobParaImagem(mini)
    estouro = medirEstouro(img)
  }
  const { fx, fy } = medirFoco(fonte)
  const pb = medirMonocromia(fonte)
  return { mini, preview, largura, altura, estouro, fx, fy, pb }
}

function blobParaImagem(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('imagem inválida'))
    img.src = URL.createObjectURL(blob)
  })
}

/** Gera e sobe as versões leves; devolve o registro (paths) e URLs locais para uso imediato. */
export async function gerarDerivados(albumId: string, fotoId: string, fonte: HTMLImageElement | ImageBitmap): Promise<DerivadoGerado> {
  const m = await medir(fonte)
  const supabase = createClient()
  const base = `${albumId}/derivados/${fotoId}`
  const [a, b] = await Promise.all([
    supabase.storage.from('albuns_fotos').upload(`${base}-mini.jpg`, m.mini, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' }),
    supabase.storage.from('albuns_fotos').upload(`${base}-preview.jpg`, m.preview, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' }),
  ])
  if (a.error || b.error) throw new Error('Não foi possível enviar as versões leves.')
  return {
    mini: `${base}-mini.jpg`,
    preview: `${base}-preview.jpg`,
    largura: m.largura,
    altura: m.altura,
    estouro: m.estouro,
    fx: m.fx,
    fy: m.fy,
    pb: m.pb,
    urlMini: URL.createObjectURL(m.mini),
    urlPreview: URL.createObjectURL(m.preview),
  }
}

export function carregarOriginal(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a foto.'))
    img.src = url
  })
}
