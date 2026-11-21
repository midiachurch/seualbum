/** Contraste WCAG para o tema do site: o estúdio escolhe a cor, o app garante a leitura. */

function canais(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '1f2937'
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

export type PaletaSite = { fundo: string; texto: string; acento: string; textoSobreAcento: string; acentoNoTexto: string }

/**
 * Paleta final. `acento` serve de fundo de botão com o texto (preto/branco) de
 * maior contraste; como COR DE TEXTO sobre o fundo só vale se passar 4,5:1 —
 * senão cai para a cor de texto.
 */
export function paletaDoSite(cor: string | undefined, modo: 'claro' | 'escuro' | undefined): PaletaSite {
  const escuro = modo === 'escuro'
  const fundo = escuro ? '#111111' : '#ffffff'
  const texto = escuro ? '#f5f5f5' : '#171717'
  const acento = cor && /^#[0-9a-f]{6}$/i.test(cor) ? cor : '#1f2937'
  const textoSobreAcento = contraste(acento, '#ffffff') >= contraste(acento, '#000000') ? '#ffffff' : '#000000'
  return { fundo, texto, acento, textoSobreAcento, acentoNoTexto: contraste(acento, fundo) >= 4.5 ? acento : texto }
}
