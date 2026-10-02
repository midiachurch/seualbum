import type { Ajustes } from '@/lib/album/documento'

/**
 * Ajustes de cor aplicados pixel a pixel — a MESMA função roda no canvas do
 * editor (filtro do Konva) e no JPG final, então o que se vê é o que sai.
 */
export function aplicarAjustes(dados: ImageData, a: Ajustes) {
  const d = dados.data
  const brilho = (a.brilho / 100) * 80
  const c = (a.contraste / 100) * 255 * 0.6
  const fatorContraste = (259 * (c + 255)) / (255 * (259 - c))
  const sat = 1 + a.saturacao / 100
  const temp = (a.temperatura / 100) * 40
  // Exposição em "pontos": ±100 ≈ ±2 EV (multiplica a luz, ao contrário do brilho que soma).
  const exposicao = Math.pow(2, (a.exposicao ?? 0) / 50)
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * exposicao
    let g = d[i + 1] * exposicao
    let b = d[i + 2] * exposicao
    r += brilho
    g += brilho
    b += brilho
    r = fatorContraste * (r - 128) + 128
    g = fatorContraste * (g - 128) + 128
    b = fatorContraste * (b - 128) + 128
    r += temp
    g += temp * 0.15
    b -= temp
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (a.pb) {
      r = g = b = lum
    } else if (sat !== 1) {
      r = lum + (r - lum) * sat
      g = lum + (g - lum) * sat
      b = lum + (b - lum) * sat
    }
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b
  }
}

/** CSS equivalente (aproximado) para as miniaturas em HTML. */
export function filtroCss(a: Ajustes) {
  const partes = [`brightness(${(1 + a.brilho / 200) * Math.pow(2, (a.exposicao ?? 0) / 50)})`, `contrast(${1 + a.contraste / 150})`]
  if (a.pb) partes.push('grayscale(1)')
  else partes.push(`saturate(${1 + a.saturacao / 100})`)
  if (a.temperatura > 0) partes.push(`sepia(${a.temperatura / 250})`)
  if (a.temperatura < 0) partes.push(`hue-rotate(${a.temperatura / 10}deg)`)
  return partes.join(' ')
}

/**
 * Fração da foto "estourada" (altas luzes sem detalhe), numa amostra de
 * 192 px. Exige a imagem carregada com CORS (`crossOrigin = 'anonymous'`).
 */
export function medirEstouro(img: HTMLImageElement): number | null {
  try {
    const lado = 192
    const k = lado / Math.max(img.naturalWidth, img.naturalHeight)
    const w = Math.max(1, Math.round(img.naturalWidth * k))
    const h = Math.max(1, Math.round(img.naturalHeight * k))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    const d = ctx.getImageData(0, 0, w, h).data
    let estourados = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] >= 252 && d[i + 1] >= 252 && d[i + 2] >= 252) estourados++
    return estourados / (w * h)
  } catch {
    return null
  }
}

/** Acima disso a foto vira aviso na verificação. */
export const LIMITE_ESTOURO = 0.12

/**
 * Ponto de interesse da foto (0–1), para o recorte inteligente: o centro de
 * massa do "detalhe" (bordas/contraste) numa amostra pequena, puxado um pouco
 * para o meio. Rostos e objetos costumam ter mais detalhe que céu e parede.
 */
export function medirFoco(img: HTMLImageElement | ImageBitmap): { fx: number; fy: number } {
  try {
    const W0 = 'naturalWidth' in img ? img.naturalWidth : img.width
    const H0 = 'naturalHeight' in img ? img.naturalHeight : img.height
    const lado = 96
    const k = lado / Math.max(W0, H0)
    const w = Math.max(2, Math.round(W0 * k))
    const h = Math.max(2, Math.round(H0 * k))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { fx: 0.5, fy: 0.5 }
    ctx.drawImage(img, 0, 0, w, h)
    const d = ctx.getImageData(0, 0, w, h).data
    const lum = (x: number, y: number) => {
      const i = (y * w + x) * 4
      return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    }
    let soma = 0
    let sx = 0
    let sy = 0
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx = lum(x + 1, y) - lum(x - 1, y)
        const gy = lum(x, y + 1) - lum(x, y - 1)
        const e = gx * gx + gy * gy
        soma += e
        sx += e * x
        sy += e * y
      }
    }
    if (soma === 0) return { fx: 0.5, fy: 0.5 }
    const puxar = (v: number) => 0.5 + (v - 0.5) * 0.7
    return { fx: puxar(sx / soma / (w - 1)), fy: puxar(sy / soma / (h - 1)) }
  } catch {
    return { fx: 0.5, fy: 0.5 }
  }
}

/** Reduz uma imagem para um JPG com o lado maior em `lado` px. */
export async function reduzirParaJpg(img: HTMLImageElement | ImageBitmap, lado: number, qualidade = 0.82): Promise<Blob> {
  const W0 = 'naturalWidth' in img ? img.naturalWidth : img.width
  const H0 = 'naturalHeight' in img ? img.naturalHeight : img.height
  const k = Math.min(1, lado / Math.max(W0, H0))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(W0 * k))
  c.height = Math.max(1, Math.round(H0 * k))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', qualidade))
  c.width = 0
  c.height = 0
  if (!blob) throw new Error('Não foi possível gerar a versão leve da foto.')
  return blob
}

/** Lados das versões leves: miniatura (biblioteca, fita) e prévia (canvas, visualização). */
export const LADO_MINI = 480
export const LADO_PREVIEW = 2048
