import { Cormorant_Garamond, Fraunces, Great_Vibes, Lato, Montserrat, Playfair_Display } from 'next/font/google'
import type { FonteChave } from '@/lib/album/documento'

/**
 * Fontes de CONTEÚDO do álbum (textos nas lâminas), carregadas só nas páginas
 * do editor. O nome de família gerado pelo `next/font` vai para o canvas e
 * para o JPG final (ver `lib/album/fontes`).
 */
const fraunces = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--album-fraunces', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--album-playfair', display: 'swap' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--album-cormorant', display: 'swap' })
const montserrat = Montserrat({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--album-montserrat', display: 'swap' })
const lato = Lato({ subsets: ['latin'], weight: ['300', '400', '700'], style: ['normal', 'italic'], variable: '--album-lato', display: 'swap' })
const greatVibes = Great_Vibes({ subsets: ['latin'], weight: '400', variable: '--album-great-vibes', display: 'swap' })

export const FAMILIAS_ALBUM: Record<FonteChave, string> = {
  editorial: fraunces.style.fontFamily,
  serifa: playfair.style.fontFamily,
  classica: cormorant.style.fontFamily,
  sans: montserrat.style.fontFamily,
  'sans-leve': lato.style.fontFamily,
  manuscrita: greatVibes.style.fontFamily,
}

/** Classes que trazem as @font-face para a página. */
export const CLASSES_FONTES_ALBUM = [fraunces, playfair, cormorant, montserrat, lato, greatVibes].map((f) => f.variable).join(' ')
