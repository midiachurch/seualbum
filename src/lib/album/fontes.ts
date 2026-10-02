import type { FonteChave, TextoDoc } from '@/lib/album/documento'

/**
 * Fontes de CONTEÚDO do álbum. As famílias reais vêm do `next/font` da página
 * do editor (nomes gerados no build) e são registradas aqui ao montar — o
 * canvas do Konva e o JPG final usam o mesmo nome de família.
 */
export const FONTES_ALBUM: { chave: FonteChave; nome: string; pesos: TextoDoc['peso'][] }[] = [
  { chave: 'editorial', nome: 'Fraunces', pesos: [300, 400, 500, 600, 700] },
  { chave: 'serifa', nome: 'Playfair Display', pesos: [400, 500, 600, 700] },
  { chave: 'classica', nome: 'Cormorant Garamond', pesos: [300, 400, 500, 600, 700] },
  { chave: 'sans', nome: 'Montserrat', pesos: [300, 400, 500, 600, 700] },
  { chave: 'sans-leve', nome: 'Lato', pesos: [300, 400, 700] },
  { chave: 'manuscrita', nome: 'Great Vibes', pesos: [400] },
]

const familias = new Map<FonteChave, string>()

export function registrarFamilias(mapa: Partial<Record<FonteChave, string>>) {
  for (const [k, v] of Object.entries(mapa)) if (v) familias.set(k as FonteChave, v)
}

export function familiaDe(chave: FonteChave) {
  return familias.get(chave) ?? 'Georgia, serif'
}

/** `font` do canvas 2D para um texto num tamanho em px. */
export function fonteCanvas(t: Pick<TextoDoc, 'fonte' | 'peso' | 'italico'>, tamanhoPx: number) {
  return `${t.italico ? 'italic ' : ''}${t.peso} ${tamanhoPx}px ${familiaDe(t.fonte)}`
}

/** Garante as fontes baixadas antes de desenhar no canvas (o canvas não espera sozinho). */
export async function carregarFontes(textos: Pick<TextoDoc, 'fonte' | 'peso' | 'italico'>[]) {
  if (typeof document === 'undefined' || !document.fonts) return
  const vistas = new Set<string>()
  await Promise.all(
    textos.map((t) => {
      const f = fonteCanvas(t, 32)
      if (vistas.has(f)) return null
      vistas.add(f)
      return document.fonts.load(f).catch(() => null)
    }),
  )
}
