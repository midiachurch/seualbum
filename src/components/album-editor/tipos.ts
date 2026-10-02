/**
 * Tipos e constantes do editor que NÃO dependem do Konva — o canvas só roda
 * no navegador (`ssr: false`), então o resto do editor importa daqui.
 */
export type FotoNoCanvas = {
  /** Original (exportação). */
  url: string
  /** Versões leves para a tela; sem elas, usa o original. */
  urlMini?: string | null
  urlPreview?: string | null
  /** Dimensões do ORIGINAL (DPI e proporção). */
  largura: number | null
  altura: number | null
}

/** Elemento selecionado na lâmina. */
export type Selecao = { tipo: 'quadro' | 'texto' | 'forma'; id: string }

/** Tipo do dado no arrastar-e-soltar da biblioteca para a lâmina. */
export const MIME_FOTO = 'application/x-seualbum-foto'

/** Melhor imagem para mostrar numa lista/miniatura. */
export function urlParaMiniatura(f: Pick<FotoNoCanvas, 'url' | 'urlMini' | 'urlPreview'> | undefined) {
  return f ? (f.urlMini ?? f.urlPreview ?? f.url) : undefined
}
