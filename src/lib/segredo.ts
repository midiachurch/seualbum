import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Compara um segredo recebido (header) com o esperado (env) em tempo
 * constante. Os dois lados passam por SHA-256 antes do `timingSafeEqual`,
 * que exige buffers do mesmo tamanho — assim o tempo também não revela o
 * comprimento do segredo.
 *
 * Fail closed: sem segredo configurado (undefined/vazio), nada confere.
 */
export function segredoConfere(recebido: string | null | undefined, esperado: string | null | undefined): boolean {
  if (!esperado || typeof recebido !== 'string') return false
  const a = createHash('sha256').update(recebido, 'utf8').digest()
  const b = createHash('sha256').update(esperado, 'utf8').digest()
  return timingSafeEqual(a, b)
}

/** `Authorization: Bearer <segredo>` — mesmo critério de `segredoConfere`. */
export function bearerConfere(authorization: string | null | undefined, esperado: string | null | undefined): boolean {
  if (!esperado) return false
  return segredoConfere(authorization, `Bearer ${esperado}`)
}
