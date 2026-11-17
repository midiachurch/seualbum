/** Metadado de apresentação; nunca usar como autorização ou caminho do objeto. */
export function normalizarNomeOriginal(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const nome = valor.split(/[/\\]/).pop()!.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').trim()
  if (!nome || nome === '.' || nome === '..') return null
  return nome.slice(0, 240)
}
