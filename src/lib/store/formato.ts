export function formatarMoeda(centavos: number): string {
  if (!Number.isFinite(centavos)) return '—'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "99,90" | "99.90" | "1.234,50" → centavos inteiros; nulo se inválido (sem arredondar em silêncio). */
export function reaisParaCentavos(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(t)) return null
  const normal = /,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t
  const [inteiro, frac = ''] = normal.split('.')
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(centavos) && centavos <= 100_000_000 ? centavos : null
}

/** Percentual (ex.: "10" ou "7,5") → pontos-base inteiros; nulo se fora de 0–50% ou inválido. */
export function percentualParaBps(texto: string): number | null {
  const t = texto.trim().replace('%', '').replace(',', '.')
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null
  const bps = Math.round(Number(t) * 100)
  return bps >= 0 && bps <= 5000 ? bps : null
}
