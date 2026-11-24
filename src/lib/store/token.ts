import { createHash } from 'node:crypto'

/**
 * Token do link de entrega, derivado da chave idempotente da compra: assim um
 * retry da MESMA compra devolve o mesmo link, e o banco guarda só o hash.
 * `SEUALBUM_STORE_PEPPER` (opcional) impede derivar o token só com a chave.
 */
export function tokenEntrega(chave: string, pepper: string = process.env.SEUALBUM_STORE_PEPPER ?? ''): string {
  return createHash('sha256').update(`loja-entrega|${pepper}|${chave.toLowerCase()}`).digest('hex')
}
export const hashTokenEntrega = (token: string) => createHash('sha256').update(`loja:${token}`).digest('hex')
