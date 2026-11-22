import { NextResponse } from 'next/server'
import { gerarIcs } from '@/lib/agenda/ics'
import { lerReservaPublica } from '@/lib/agenda/publico'
import { slugValido } from '@/lib/agenda/regras'
import { uuidValido } from '@/lib/portal/segredos'

export const dynamic = 'force-dynamic'
const CABECALHOS = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

/**
 * "Adicionar ao calendário" da reserva. Mesma prova de posse da página da reserva
 * (cookie do próprio visitante, validado no banco pelo hash) e só para reserva
 * CONFIRMADA: horário em espera ou cancelado nunca vira compromisso no calendário.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  if (!slugValido(slug) || !uuidValido(id)) return new NextResponse('Reserva não encontrada.', { status: 404, headers: CABECALHOS })
  const r = await lerReservaPublica(id)
  if (!r || r.status !== 'confirmada') return new NextResponse('Reserva não encontrada ou ainda não confirmada.', { status: 404, headers: CABECALHOS })
  const ics = gerarIcs({ uid: r.id, inicio: r.inicio, fim: r.fim, resumo: `${r.recurso}${r.estudio ? ` · ${r.estudio}` : ''}`, descricao: `Reserva confirmada. Para cancelar ou remarcar, use o link da sua reserva.` })
  return new NextResponse(ics, { status: 200, headers: { ...CABECALHOS, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="reserva.ics"' } })
}
