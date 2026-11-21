import 'server-only'

import { cookies } from 'next/headers'
import { isDemoMode } from '@/lib/demo-mode'
import { hashPortal, segredoValido, uuidValido } from '@/lib/portal/segredos'
import { createPublicClient } from '@/lib/supabase/server'
import { slugValido } from '@/lib/agenda/regras'
import type { AgendaRecursoPublico, AgendaReservaPublica, AgendaSlotRow } from '@/types/database'

/** O segredo da reserva fica só no cookie httpOnly do visitante; o banco guarda apenas o hash. */
export const hashSegredoReserva = (segredo: string) => hashPortal(`agenda:${segredo}`)
export const nomeCookieReserva = (id: string) => `agenda_r_${id}`
export const nomeCookieTentativa = (tentativa: string) => `agenda_t_${tentativa}`

export const cookieAgenda = (maxAge: number) => ({
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/agendar', maxAge,
})

export async function lerSegredoReserva(id: string): Promise<string | null> {
  if (!uuidValido(id)) return null
  const valor = (await cookies()).get(nomeCookieReserva(id))?.value
  return segredoValido(valor) ? valor : null
}

/** Recurso publicado, só com campos que o visitante pode ver. */
export async function lerRecursoPublico(slug: string): Promise<AgendaRecursoPublico | null> {
  if (isDemoMode() || !slugValido(slug)) return null
  try {
    const { data, error } = await createPublicClient().rpc('agenda_recurso_publico', { p_slug: slug })
    return error || !data ? null : data
  } catch { return null }
}

/** Slots LIVRES (o que falta na lista é "indisponível"; nada de reservas alheias). */
export async function lerSlotsPublicos(slug: string, de: string, ate: string): Promise<AgendaSlotRow[]> {
  if (isDemoMode() || !slugValido(slug)) return []
  try {
    const { data, error } = await createPublicClient().rpc('agenda_listar_slots', { p_slug: slug, p_de: de, p_ate: ate })
    return error || !Array.isArray(data) ? [] : data
  } catch { return [] }
}

export async function lerReservaPublica(id: string): Promise<AgendaReservaPublica | null> {
  if (isDemoMode()) return null
  const segredo = await lerSegredoReserva(id)
  if (!segredo) return null
  try {
    const { data, error } = await createPublicClient().rpc('agenda_reserva_publica', { p_id: id, p_token_hash: hashSegredoReserva(segredo) })
    return error || !data ? null : data
  } catch { return null }
}
