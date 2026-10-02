import type { AlbumOrientationValue } from '@/types/platform'

/** Resolução de impressão exigida pela gráfica. Abaixo disso o upload avisa (não bloqueia). */
export const DPI_MINIMO = 300

const CM_POR_POLEGADA = 2.54

export type FormatoAlbum = { formato: string | null | undefined; orientacao: AlbumOrientationValue | string | null | undefined }

/** Lado de página aceito, em cm (abaixo/acima disso é erro de digitação). */
export const LADO_MIN_CM = 5
export const LADO_MAX_CM = 100

/**
 * Formato canônico "LxA" em cm ("30x40", "20.5x30"), aceitando como as
 * pessoas escrevem: "30 x 40", "30X40", "30×40", "30x40cm", "30 x 40 cm",
 * "20,5x30". Vazio se não der para entender ou se fugir de 5–100 cm.
 */
export function normalizarFormato(v: unknown): string {
  const texto = String(v ?? '')
    .toLowerCase()
    .replace(/cm/g, '')
    .replace(/[×*]/g, 'x')
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*$/.exec(texto)
  if (!m) return ''
  const a = Number(m[1].replace(',', '.'))
  const b = Number(m[2].replace(',', '.'))
  if (![a, b].every((n) => Number.isFinite(n) && n >= LADO_MIN_CM && n <= LADO_MAX_CM)) return ''
  return `${a}x${b}`
}

/**
 * Orientação canônica. Aceita os nomes do produto e de outras origens
 * ("retrato", "Paisagem", "portrait", "landscape"…); sem valor, deduz do
 * formato (quadrado se os lados são iguais; senão, pelo maior lado).
 */
export function normalizarOrientacao(v: unknown, formato?: string): AlbumOrientationValue {
  const t = String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  if (['horizontal', 'paisagem', 'landscape', 'deitado'].includes(t)) return 'horizontal'
  if (['vertical', 'retrato', 'portrait', 'em pe'].includes(t)) return 'vertical'
  if (['quadrado', 'square', 'quadrada'].includes(t)) return 'quadrado'
  const f = normalizarFormato(formato)
  if (!f) return 'quadrado'
  const [a, b] = f.split('x').map(Number)
  return a === b ? 'quadrado' : a > b ? 'horizontal' : 'vertical'
}

/**
 * Tamanho da lâmina ABERTA (duas páginas lado a lado) em cm, a partir do
 * formato do álbum ("30x40") e da orientação. Null se o formato não for
 * reconhecido — aí não há como validar a resolução.
 */
export function laminaEmCm({ formato, orientacao }: FormatoAlbum): { largura: number; altura: number } | null {
  const canonico = normalizarFormato(formato)
  if (!canonico) return null
  const [a, b] = canonico.split('x').map(Number)
  orientacao = orientacao ? normalizarOrientacao(orientacao) : orientacao
  const [menor, maior] = a <= b ? [a, b] : [b, a]
  const pagina =
    orientacao === 'horizontal'
      ? { largura: maior, altura: menor }
      : orientacao === 'vertical'
        ? { largura: menor, altura: maior }
        : { largura: a, altura: b }
  return { largura: pagina.largura * 2, altura: pagina.altura }
}

/** Pixels mínimos da lâmina aberta para `DPI_MINIMO`. */
export function pixelsMinimos(album: FormatoAlbum): { largura: number; altura: number } | null {
  const cm = laminaEmCm(album)
  if (!cm) return null
  return {
    largura: Math.ceil((cm.largura / CM_POR_POLEGADA) * DPI_MINIMO),
    altura: Math.ceil((cm.altura / CM_POR_POLEGADA) * DPI_MINIMO),
  }
}

/**
 * DPI efetivo de uma imagem impressa na lâmina aberta: o pior dos dois eixos
 * (a imagem é esticada até cobrir a lâmina inteira).
 */
export function dpiEfetivo(larguraPx: number, alturaPx: number, album: FormatoAlbum): number | null {
  const cm = laminaEmCm(album)
  if (!cm || !(larguraPx > 0 && alturaPx > 0)) return null
  return Math.floor(Math.min(larguraPx / (cm.largura / CM_POR_POLEGADA), alturaPx / (cm.altura / CM_POR_POLEGADA)))
}
