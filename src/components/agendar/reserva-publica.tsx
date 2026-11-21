'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { cancelarReservaPublica, confirmarReservaPublica, listarSlotsParaRemarcar, pagarSinalSimulado, remarcarReservaPublica } from '@/lib/actions/agendar'
import { agruparSlotsPorDia, formatarReais, hojeNoFuso, rotuloDataHora, somarDias, type GrupoDeSlots } from '@/lib/agenda/formatacao'
import { ROTULO_SINAL, ROTULO_STATUS, statusEfetivo } from '@/lib/agenda/regras'
import type { AgendaReservaPublica } from '@/types/database'

export function ReservaPublicaPainel({ slug, reserva }: { slug: string; reserva: AgendaReservaPublica }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  const [agora, setAgora] = useState(() => Date.now())
  const [grupos, setGrupos] = useState<GrupoDeSlots[] | null>(null)
  useEffect(() => {
    if (reserva.status !== 'hold') return
    const t = setInterval(() => setAgora(Date.now()), 15000)
    return () => clearInterval(t)
  }, [reserva.status])

  const status = statusEfetivo(reserva, agora)
  const sinalPendente = reserva.sinal_status === 'pendente' && (reserva.sinal_centavos ?? 0) > 0
  const restante = reserva.expira_em ? Math.max(0, Math.ceil((Date.parse(reserva.expira_em) - agora) / 60000)) : 0

  const executar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) => {
    setErro(''); setAviso('')
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'Não foi possível concluir.')
      else setAviso(ok)
      router.refresh()
    })
  }
  const carregarHorarios = () => {
    setErro('')
    iniciar(async () => {
      const hoje = hojeNoFuso(reserva.fuso)
      const r = await listarSlotsParaRemarcar(slug, hoje, somarDias(hoje, 20))
      if (!r.ok) { setErro(r.erro); return }
      setGrupos(agruparSlotsPorDia(r.slots, reserva.fuso))
    })
  }

  return (
    <section className="space-y-4 rounded-2xl border p-5" aria-label="Sua reserva">
      <div>
        <p className="text-sm text-muted-foreground">{reserva.estudio}</p>
        <h1 className="text-2xl font-semibold">{reserva.recurso}</h1>
        <p className="mt-1">{rotuloDataHora(reserva.inicio, reserva.fuso)}</p>
        <p className="text-sm text-muted-foreground">Situação: <strong>{ROTULO_STATUS[status] ?? status}</strong>{reserva.sinal_centavos ? ` · ${ROTULO_SINAL[reserva.sinal_status] ?? ''}` : ''}</p>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="text-sm">{aviso}</p>}

      {status === 'hold' && (
        <div className="space-y-3">
          <p className="text-sm">Seguramos este horário por mais {restante} min. {sinalPendente ? `Pague o sinal de ${formatarReais(reserva.sinal_centavos)} (simulado) para confirmar.` : 'Confirme para garantir.'}</p>
          {sinalPendente
            ? <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-50" onClick={() => executar(() => pagarSinalSimulado(reserva.id), 'Sinal registrado e reserva confirmada.')}>Pagar sinal (simulado)</button>
            : <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-50" onClick={() => executar(() => confirmarReservaPublica(reserva.id), 'Reserva confirmada.')}>Confirmar reserva</button>}
        </div>
      )}
      {status === 'expirada' && <p className="text-sm">O tempo acabou e o horário foi liberado. <a className="underline" href={`/agendar/${slug}`}>Escolha outro horário</a>.</p>}
      {status === 'cancelada' && <p className="text-sm">Reserva cancelada. {reserva.sinal_status === 'reembolso_pendente' ? 'O estúdio fará a devolução do sinal.' : ''} <a className="underline" href={`/agendar/${slug}`}>Agendar novamente</a>.</p>}

      {(status === 'confirmada' || status === 'hold') && (
        <div className="space-y-3 border-t pt-4">
          {status === 'confirmada' && <p className="text-sm text-muted-foreground">Cancelar ou remarcar por aqui é possível até {reserva.cancelamento_antecedencia_h} h antes do horário.</p>}
          <div className="flex flex-wrap gap-2">
            {status === 'confirmada' && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50" onClick={carregarHorarios}>Remarcar</button>}
            <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50"
              onClick={() => { if (window.confirm('Cancelar esta reserva?')) executar(() => cancelarReservaPublica(reserva.id), 'Reserva cancelada.') }}>Cancelar reserva</button>
          </div>
          {grupos && (grupos.length ? (
            <div className="space-y-3">
              {grupos.map(g => (
                <section key={g.dia} aria-label={g.rotulo}>
                  <h2 className="mb-1 text-sm font-medium capitalize">{g.rotulo}</h2>
                  <ul className="flex flex-wrap gap-2">
                    {g.slots.map(s => (
                      <li key={s.inicio}><button type="button" disabled={pendente} className="min-h-11 min-w-16 rounded-lg border px-3 text-sm disabled:opacity-50"
                        onClick={() => executar(async () => { const r = await remarcarReservaPublica(reserva.id, s.inicio); if (r.ok) setGrupos(null); return r }, 'Reserva remarcada.')}>{s.hora}</button></li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : <p className="text-sm">Sem horários livres nos próximos dias.</p>)}
        </div>
      )}
    </section>
  )
}
