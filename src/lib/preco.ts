/** "350", "350,5", "1.350,00", "350.00" → número; vazio → null. */
export function lerPreco(texto: string): number | null | 'invalido' {
  const t = texto.trim()
  if (t === '') return null
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return 'invalido'
  return Number(normal)
}

export function precoParaTexto(v: number | null) {
  return v === null ? '' : v.toFixed(2).replace('.', ',')
}
