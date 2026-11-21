import { uuidValido } from './segredos'
export type PortalProva = {
  id: string; numero: number; aberta: boolean
  laminas: { id: string; ordem: number }[]
  comentarios: { id: string; lamina_id: string | null; tipo: 'comentario' | 'ajustes'; texto: string; data: string }[]
}
export function comentarioProvaValido(versao: unknown, lamina: unknown, tipo: unknown, texto: unknown, chave: unknown): boolean {
  return uuidValido(versao) && uuidValido(chave) && (lamina === null || uuidValido(lamina)) &&
    (tipo === 'ajustes' || (tipo === 'comentario' && uuidValido(lamina))) &&
    typeof texto === 'string' && texto.trim().length > 0 && texto.trim().length <= 2000
}

/** Falha fechada se o schema local ainda não oferecer o contrato de prova. */
export function lerContratoProva(valor: unknown): PortalProva | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const p = valor as Record<string, unknown>
  if (!uuidValido(p.id) || !Number.isInteger(p.numero) || (p.numero as number) < 1 || typeof p.aberta !== 'boolean' || !Array.isArray(p.laminas) || !Array.isArray(p.comentarios)) return null
  const laminas: PortalProva['laminas'] = []
  for (const valor of p.laminas) {
    if (!valor || typeof valor !== 'object') return null
    const l = valor as Record<string, unknown>
    if (!uuidValido(l.id) || !Number.isInteger(l.ordem) || (l.ordem as number) < 1) return null
    laminas.push({ id: l.id as string, ordem: l.ordem as number })
  }
  if (new Set(laminas.map((l) => l.id)).size !== laminas.length) return null
  const comentarios: PortalProva['comentarios'] = []
  for (const valor of p.comentarios) {
    if (!valor || typeof valor !== 'object') return null
    const c = valor as Record<string, unknown>
    if (!uuidValido(c.id) || !(c.lamina_id === null || uuidValido(c.lamina_id)) || (c.tipo !== 'comentario' && c.tipo !== 'ajustes') || typeof c.texto !== 'string' || typeof c.data !== 'string' || !Number.isFinite(Date.parse(c.data))) return null
    comentarios.push({ id: c.id as string, lamina_id: c.lamina_id as string | null, tipo: c.tipo, texto: c.texto, data: c.data })
  }
  return { id: p.id as string, numero: p.numero as number, aberta: p.aberta, laminas, comentarios }
}
