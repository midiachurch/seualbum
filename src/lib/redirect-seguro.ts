/**
 * Validação única de destinos de redirect vindos do usuário (`?next=`, campo
 * `next` de formulário). Roda no navegador e no servidor — sem dependências.
 *
 * Só aceita caminhos internos. `startsWith('/') && !startsWith('//')` não basta:
 * navegadores tratam `\` como `/` em URLs http(s), então `/\evil.com` vira
 * `//evil.com` (outro host). Também recusa caracteres de controle (tab/CR/LF
 * são removidos pelo parser de URL e podem montar `//` do mesmo jeito).
 */

/** Origem fictícia só para resolver o caminho; nunca aparece no resultado. */
const BASE = 'https://interno.invalid'

/**
 * Devolve o caminho normalizado (pathname + search + hash) se `next` for um
 * caminho interno seguro; senão `null`.
 */
export function caminhoInternoSeguro(next: unknown): string | null {
  if (typeof next !== 'string' || next.length === 0 || next.length > 2048) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  if (next.includes('\\')) return null
  if (/[\u0000-\u001f\u007f]/.test(next)) return null

  let url: URL
  try {
    url = new URL(next, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null

  const caminho = `${url.pathname}${url.search}${url.hash}`
  // Defesa extra: o resultado normalizado também não pode começar com `//`.
  return caminho.startsWith('//') ? null : caminho
}

/** Como `caminhoInternoSeguro`, com um destino padrão quando `next` não serve. */
export function caminhoInternoOu(next: unknown, padrao: string): string {
  return caminhoInternoSeguro(next) ?? padrao
}
