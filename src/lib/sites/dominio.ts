/**
 * Domínio próprio do site: normalização, registro TXT de verificação e o
 * resolver de DNS (interface injetável — os testes usam um mock, sem rede).
 * A decisão de titularidade é só esta: o TXT em `_seualbum-verificacao.{dominio}`
 * contém o token gerado pelo banco para AQUELE registro (migration 0071).
 */

export const PREFIXO_TXT = '_seualbum-verificacao'
const DOMINIO = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/
const TLDS_RESERVADOS = /\.(localhost|local|internal|invalid|test|example|onion|arpa)$/

/** Resolver de TXT: cada registro vem como lista de pedaços (como no DNS). */
export interface ResolvedorDns {
  resolverTxt(nome: string): Promise<string[][]>
}

export function normalizarDominio(entrada: string): string {
  return entrada.trim().toLowerCase().replace(/\.$/, '')
}

/** Domínio utilizável (sem esquema, caminho, porta, IP nem TLD reservado). */
export function dominioValido(entrada: unknown): entrada is string {
  if (typeof entrada !== 'string') return false
  const d = normalizarDominio(entrada)
  return d.length <= 253 && DOMINIO.test(d) && !TLDS_RESERVADOS.test(d)
}

export const nomeRegistroTxt = (dominio: string) => `${PREFIXO_TXT}.${normalizarDominio(dominio)}`

export type ResultadoDns = { encontrado: boolean; registros: string[]; erro?: 'dns_indisponivel' }

/**
 * Consulta o TXT e devolve os valores achados. `encontrado` = o token do
 * registro está entre eles (comparação exata, sem aspas/espaços nas pontas).
 * NXDOMAIN/sem dados contam como "não encontrado"; falha de infraestrutura
 * volta como `dns_indisponivel` para a tela pedir nova tentativa.
 */
export async function verificarTitularidade(resolvedor: ResolvedorDns, dominio: string, token: string): Promise<ResultadoDns> {
  if (!dominioValido(dominio) || !/^seualbum-verificacao=[0-9a-f]{32}$/.test(token)) return { encontrado: false, registros: [] }
  try {
    const brutos = await resolvedor.resolverTxt(nomeRegistroTxt(dominio))
    const registros = brutos.map((pedacos) => pedacos.join('').trim()).filter(Boolean).slice(0, 20)
    return { encontrado: registros.includes(token), registros }
  } catch (e) {
    const codigo = (e as { code?: string } | null)?.code
    if (codigo === 'ENOTFOUND' || codigo === 'ENODATA' || codigo === 'NXDOMAIN') return { encontrado: false, registros: [] }
    return { encontrado: false, registros: [], erro: 'dns_indisponivel' }
  }
}
