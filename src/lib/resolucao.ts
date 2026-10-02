import type { AlbumOrientationValue } from '@/types/platform'

/** Resolução de impressão exigida pela gráfica. Abaixo disso o upload avisa (não bloqueia). */
export const DPI_MINIMO = 300

const CM_POR_POLEGADA = 2.54

export type FormatoAlbum = { formato: string | null | undefined; orientacao: AlbumOrientationValue | null | undefined }

/**
 * Tamanho da lâmina ABERTA (duas páginas lado a lado) em cm, a partir do
 * formato do álbum ("30x40") e da orientação. Null se o formato não for
 * reconhecido — aí não há como validar a resolução.
 */
export function laminaEmCm({ formato, orientacao }: FormatoAlbum): { largura: number; altura: number } | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(formato ?? '')
  if (!m) return null
  const a = Number(m[1].replace(',', '.'))
  const b = Number(m[2].replace(',', '.'))
  if (!(a > 0 && b > 0)) return null
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
