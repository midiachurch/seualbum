import { ajustesNeutros, posicaoDaFoto, type FormaDoc, type Geometria, type LaminaDoc, type Quadro, type TextoDoc } from '@/lib/album/documento'
import { aplicarAjustes } from '@/lib/album/ajustes'
import { carregarFontes, fonteCanvas } from '@/lib/album/fontes'
import { quebrarLinhas, tamanhoEmMm } from '@/lib/album/texto'
import { DPI_MINIMO } from '@/lib/resolucao'
import { ornamentoPorId } from '@/lib/album/ornamentos'
import { LADO_TEXTURA_MM, ladrilhoDeTextura } from '@/lib/album/texturas'

/**
 * Desenha uma lâmina num <canvas> 2D no navegador — o JPG de impressão
 * (lâmina aberta + sangria, 300 DPI), as lâminas da visualização/aprovação
 * (resolução de tela) e a capa em miniatura. Sem as guias do editor. Ordem:
 * fundo → imagem de fundo → formas de trás → fotos → formas da frente → textos.
 * As fotos vêm com CORS (`crossOrigin`) — senão o canvas não exporta.
 */

export const PX_POR_MM_IMPRESSAO = DPI_MINIMO / 25.4

export type CarregarImagem = (fotoId: string) => Promise<HTMLImageElement>

export function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar uma das fotos.'))
    img.src = url
  })
}

function novoCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/** Foto recortada (e espelhada/ajustada) no tamanho do quadro, em px. */
function fotoNoQuadro(q: Quadro, img: HTMLImageElement, k: number) {
  const W = q.w * k
  const H = q.h * k
  const c = novoCanvas(W, H)
  const ctx = c.getContext('2d', { willReadFrequently: !ajustesNeutros(q.ajustes) })!
  ctx.imageSmoothingQuality = 'high'
  const p = posicaoDaFoto(q, img.naturalWidth, img.naturalHeight)
  ctx.translate(c.width / 2, c.height / 2)
  ctx.scale(q.espelharH ? -1 : 1, q.espelharV ? -1 : 1)
  ctx.translate(-c.width / 2, -c.height / 2)
  ctx.drawImage(img, p.x * k, p.y * k, p.w * k, p.h * k)
  if (!ajustesNeutros(q.ajustes)) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const dados = ctx.getImageData(0, 0, c.width, c.height)
    aplicarAjustes(dados, q.ajustes)
    ctx.putImageData(dados, 0, 0)
  }
  return c
}

function noCentro(ctx: CanvasRenderingContext2D, e: { x: number; y: number; w: number; h: number; rotacao: number }, s: number, k: number) {
  ctx.translate((e.x + s + e.w / 2) * k, (e.y + s + e.h / 2) * k)
  if (e.rotacao) ctx.rotate((e.rotacao * Math.PI) / 180)
}

function desenharForma(ctx: CanvasRenderingContext2D, f: FormaDoc, s: number, k: number) {
  ctx.save()
  noCentro(ctx, f, s, k)
  ctx.globalAlpha = f.opacidade
  const W = f.w * k
  const H = f.h * k
  if (f.forma === 'ornamento') {
    // Ornamento: o desenho de 100 × 100 escalado para o elemento.
    const o = ornamentoPorId(f.ornamento)
    const caminho = new Path2D(o.d)
    ctx.translate(-W / 2, -H / 2)
    ctx.scale(W / 100, H / 100)
    if (o.preenchido && f.preenchimento) {
      ctx.fillStyle = f.preenchimento
      ctx.fill(caminho)
    }
    if (f.contorno && f.espessura > 0) {
      ctx.strokeStyle = f.contorno
      ctx.lineWidth = (f.espessura * k * 100) / Math.max(W, H)
      ctx.stroke(caminho)
    }
    ctx.restore()
    return
  }
  ctx.beginPath()
  if (f.forma === 'elipse') ctx.ellipse(0, 0, W / 2, H / 2, 0, 0, Math.PI * 2)
  else if (f.forma === 'linha') {
    ctx.moveTo(-W / 2, 0)
    ctx.lineTo(W / 2, 0)
  } else ctx.rect(-W / 2, -H / 2, W, H)
  if (f.preenchimento && f.forma !== 'linha') {
    ctx.fillStyle = f.preenchimento
    ctx.fill()
  }
  if (f.contorno && f.espessura > 0) {
    ctx.strokeStyle = f.contorno
    ctx.lineWidth = f.espessura * k
    ctx.stroke()
  }
  ctx.restore()
}

function desenharTexto(ctx: CanvasRenderingContext2D, t: TextoDoc, s: number, k: number) {
  const linhas = quebrarLinhas(t)
  const tamanhoPx = tamanhoEmMm(t) * k
  const lh = tamanhoPx * t.entreLinhas
  const alturaMm = (linhas.length * lh) / k
  ctx.save()
  noCentro(ctx, { ...t, h: alturaMm }, s, k)
  ctx.globalAlpha = t.opacidade
  ctx.font = fonteCanvas(t, tamanhoPx)
  ctx.fillStyle = t.cor
  ctx.textBaseline = 'middle'
  const espaco = (t.entreLetras / 1000) * tamanhoPx
  const larguraPx = t.w * k
  const topo = -(linhas.length * lh) / 2
  linhas.forEach((linha, i) => {
    const largura = ctx.measureText(linha).width + Math.max(0, linha.length - 1) * espaco
    const x0 = t.alinhamento === 'left' ? -larguraPx / 2 : t.alinhamento === 'right' ? larguraPx / 2 - largura : -largura / 2
    const y = topo + i * lh + lh / 2
    if (espaco === 0) {
      ctx.fillText(linha, x0, y)
      return
    }
    // Espaçamento entre letras desenhado letra a letra (o mesmo que o Konva faz).
    let x = x0
    for (const letra of linha) {
      ctx.fillText(letra, x, y)
      x += ctx.measureText(letra).width + espaco
    }
  })
  ctx.restore()
}

export async function desenharLamina(
  lamina: LaminaDoc,
  g: Geometria,
  imagem: CarregarImagem,
  pxPorMm: number,
  comSangria = true,
): Promise<HTMLCanvasElement> {
  const s = g.sangria
  const k = pxPorMm
  const margem = comSangria ? s : 0
  const canvas = novoCanvas((g.laminaW + 2 * margem) * k, (g.laminaH + 2 * margem) * k)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('O navegador não conseguiu criar a imagem da lâmina.')
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = lamina.fundo
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (lamina.fundoGradiente) {
    const { de, para, angulo } = lamina.fundoGradiente
    const rad = (angulo * Math.PI) / 180
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const r = Math.abs(cx * Math.cos(rad)) + Math.abs(cy * Math.sin(rad))
    const grad = ctx.createLinearGradient(cx - Math.cos(rad) * r, cy - Math.sin(rad) * r, cx + Math.cos(rad) * r, cy + Math.sin(rad) * r)
    grad.addColorStop(0, de)
    grad.addColorStop(1, para)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  if (lamina.textura) {
    const ladrilho = ladrilhoDeTextura(lamina.textura.tipo)
    const padrao = ctx.createPattern(ladrilho, 'repeat')
    if (padrao) {
      padrao.setTransform(new DOMMatrix().scale((LADO_TEXTURA_MM * k) / ladrilho.width))
      ctx.save()
      ctx.globalAlpha = lamina.textura.opacidade
      ctx.fillStyle = padrao
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
  }
  // Sem sangria (visualização/aprovação): a lâmina começa na linha de corte.
  if (!comSangria) ctx.translate(-s * k, -s * k)
  await carregarFontes(lamina.textos)

  if (lamina.fundoImagem) {
    const img = await imagem(lamina.fundoImagem.fotoId)
    const total = { w: g.laminaW + 2 * s, h: g.laminaH + 2 * s, recorte: { zoom: 1, cx: 0.5, cy: 0.5 } }
    const p = posicaoDaFoto(total, img.naturalWidth, img.naturalHeight)
    ctx.save()
    ctx.globalAlpha = lamina.fundoImagem.opacidade
    ctx.drawImage(img, p.x * k, p.y * k, p.w * k, p.h * k)
    ctx.restore()
  }

  for (const f of lamina.formas) if (f.camada === 'tras' && !f.oculto) desenharForma(ctx, f, s, k)

  for (const q of lamina.quadros) {
    if (!q.fotoId || q.oculto) continue
    const img = await imagem(q.fotoId)
    const recortada = fotoNoQuadro(q, img, k)
    const W = q.w * k
    const H = q.h * k
    ctx.save()
    noCentro(ctx, q, s, k)
    ctx.globalAlpha = q.opacidade
    if (q.sombra) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = 3 * k
      ctx.shadowOffsetY = 1.2 * k
      ctx.fillStyle = lamina.fundo
      ctx.fillRect(-W / 2, -H / 2, W, H)
      ctx.restore()
    }
    ctx.drawImage(recortada, -W / 2, -H / 2, W, H)
    if (q.borda) {
      const lw = q.borda.espessura * k
      ctx.strokeStyle = q.borda.cor
      ctx.lineWidth = lw
      ctx.strokeRect(-W / 2 + lw / 2, -H / 2 + lw / 2, W - lw, H - lw)
    }
    ctx.restore()
    recortada.width = 0
    recortada.height = 0
  }

  for (const f of lamina.formas) if (f.camada === 'frente' && !f.oculto) desenharForma(ctx, f, s, k)
  for (const t of lamina.textos) if (t.texto.trim() && !t.oculto) desenharTexto(ctx, t, s, k)
  return canvas
}

async function paraBlob(canvas: HTMLCanvasElement, qualidade: number) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualidade))
  const dims = { largura: canvas.width, altura: canvas.height }
  // Libera a memória do canvas (até ~25 megapixels por lâmina).
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error('O navegador não conseguiu gerar o JPG — a lâmina pode ser grande demais para este aparelho.')
  return { blob, ...dims }
}

/** JPG de impressão (300 DPI, com sangria). */
export async function renderizarLamina(lamina: LaminaDoc, g: Geometria, imagem: CarregarImagem, qualidade = 0.92) {
  return paraBlob(await desenharLamina(lamina, g, imagem, PX_POR_MM_IMPRESSAO), qualidade)
}

/** JPG da lâmina como o cliente vai ver (sem sangria), numa largura em px — visualização e aprovação. */
export async function renderizarLaminaParaTela(lamina: LaminaDoc, g: Geometria, imagem: CarregarImagem, larguraPx: number, qualidade = 0.85) {
  return paraBlob(await desenharLamina(lamina, g, imagem, larguraPx / g.laminaW, false), qualidade)
}

/** Capa da listagem: JPG pequeno em data URL. */
export async function miniaturaDataUrl(lamina: LaminaDoc, g: Geometria, imagem: CarregarImagem, larguraPx = 360) {
  const canvas = await desenharLamina(lamina, g, imagem, larguraPx / (g.laminaW + 2 * g.sangria))
  const url = canvas.toDataURL('image/jpeg', 0.72)
  canvas.width = 0
  canvas.height = 0
  return url
}
