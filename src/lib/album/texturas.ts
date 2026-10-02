import type { Textura } from '@/lib/album/documento'

/**
 * Texturas procedurais do fundo: um ladrilho gerado com ruído determinístico
 * (a mesma textura toda vez), repetido sobre a lâmina. Representa 40 mm.
 */
export const TEXTURAS: { tipo: Textura; nome: string }[] = [
  { tipo: 'papel', nome: 'Papel' },
  { tipo: 'linho', nome: 'Linho' },
  { tipo: 'granulado', nome: 'Granulado' },
  { tipo: 'pontos', nome: 'Pontos' },
  { tipo: 'listras', nome: 'Listras' },
]

export const LADO_TEXTURA_MM = 40
const LADO_PX = 256
const cache = new Map<Textura, HTMLCanvasElement>()

function aleatorio(semente: number) {
  let s = semente
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Ladrilho em tons de cinza com alfa: escurece/clareia o fundo por baixo. */
export function ladrilhoDeTextura(tipo: Textura): HTMLCanvasElement {
  const pronto = cache.get(tipo)
  if (pronto) return pronto
  const c = document.createElement('canvas')
  c.width = LADO_PX
  c.height = LADO_PX
  const ctx = c.getContext('2d')!
  const rnd = aleatorio(tipo.length * 7919)
  if (tipo === 'papel' || tipo === 'granulado') {
    const img = ctx.createImageData(LADO_PX, LADO_PX)
    const forca = tipo === 'papel' ? 40 : 90
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rnd() < 0.5 ? 0 : 255
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = Math.round(rnd() * forca)
    }
    ctx.putImageData(img, 0, 0)
    if (tipo === 'papel') {
      // Fibras longas e suaves.
      ctx.globalAlpha = 0.06
      ctx.strokeStyle = '#000'
      for (let i = 0; i < 60; i++) {
        ctx.beginPath()
        const x = rnd() * LADO_PX
        const y = rnd() * LADO_PX
        ctx.moveTo(x, y)
        ctx.quadraticCurveTo(x + rnd() * 40 - 20, y + rnd() * 40 - 20, x + rnd() * 80 - 40, y + rnd() * 80 - 40)
        ctx.stroke()
      }
    }
  } else if (tipo === 'linho') {
    ctx.globalAlpha = 0.18
    for (let i = 0; i < LADO_PX; i += 2) {
      ctx.fillStyle = rnd() < 0.5 ? '#000' : '#fff'
      ctx.fillRect(0, i, LADO_PX, 1)
      ctx.fillStyle = rnd() < 0.5 ? '#000' : '#fff'
      ctx.fillRect(i, 0, 1, LADO_PX)
    }
  } else if (tipo === 'pontos') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    const passo = LADO_PX / 8
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      ctx.beginPath()
      ctx.arc(x * passo + passo / 2, y * passo + passo / 2, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    const passo = LADO_PX / 8
    for (let i = 0; i < 8; i++) ctx.fillRect(i * passo, 0, passo / 2, LADO_PX)
  }
  cache.set(tipo, c)
  return c
}
