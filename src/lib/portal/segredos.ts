import { createHash, randomBytes, randomInt } from 'node:crypto'

export const segredoValido = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
export const uuidValido = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)
export const hashPortal = (valor: string) => createHash('sha256').update(valor).digest('hex')
export const hashSessaoPortal = (link: string, token: string) => hashPortal(`${link}:${token}`)
export const novoSegredo = () => randomBytes(32).toString('hex')
export const novoCodigo = () => String(randomInt(0, 100_000_000)).padStart(8, '0')
export const cookiePortal = (link: string) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: `/portal/${link}`, maxAge: 8 * 3600 })
