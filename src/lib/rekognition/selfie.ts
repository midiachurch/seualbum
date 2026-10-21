'use client'

/** Lado maior da selfie enviada: rosto bem legível e bem abaixo do limite de corpo da Vercel. */
const LADO_MAXIMO = 1280

async function paraJpeg(origem: CanvasImageSource, largura: number, altura: number, espelhar: boolean): Promise<Blob> {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(largura, altura))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(largura * escala)
  canvas.height = Math.round(altura * escala)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Seu navegador não conseguiu preparar a selfie.')
  if (espelhar) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(origem, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.9))
  if (!blob) throw new Error('Seu navegador não conseguiu preparar a selfie.')
  return blob
}

/**
 * Quadro atual da câmera frontal como JPEG. Espelhado como a pessoa se vê na
 * tela — para o Rekognition tanto faz.
 */
export function selfieDaCamera(video: HTMLVideoElement): Promise<Blob> {
  return paraJpeg(video, video.videoWidth, video.videoHeight, true)
}

/**
 * Foto escolhida (desktop sem câmera, ou quem prefere a galeria) reduzida para
 * JPEG — o Rekognition não lê WebP nem HEIC; o navegador decodifica o que
 * souber abrir. Respeita a orientação do EXIF.
 */
export async function selfieDoArquivo(arquivo: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Não conseguimos abrir essa imagem. Tente uma foto JPG ou PNG.')
  }
  try {
    return await paraJpeg(bitmap, bitmap.width, bitmap.height, false)
  } finally {
    bitmap.close()
  }
}
