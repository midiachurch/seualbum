'use client'

import { useState } from 'react'
import { AgendaRecursos } from '@/components/dashboard/agenda-recursos'
import { AgendaReservas } from '@/components/dashboard/agenda-reservas'
import { PAPEIS_EQUIPE } from '@/lib/equipe-papeis'
import type { AgendaBloqueioRow, AgendaDisponibilidadeRow, AgendaRecursoRow, AgendaReservaRow, PapelOrganizacao } from '@/types/database'

type Props = {
  organizacaoId: string
  nome: string
  meuPapel: PapelOrganizacao
  recursos: AgendaRecursoRow[]
  reservas: AgendaReservaRow[]
  disponibilidade: AgendaDisponibilidadeRow[]
  bloqueios: AgendaBloqueioRow[]
}

/** Dono/admin configuram; dono/admin/editor operam reservas; visualizador só lê. */
export function AgendaEstudio({ organizacaoId, nome, meuPapel, recursos, reservas, disponibilidade, bloqueios }: Props) {
  const [aba, setAba] = useState<'reservas' | 'recursos'>('reservas')
  const podeConfigurar = meuPapel === 'dono' || meuPapel === 'admin'
  const podeOperar = podeConfigurar || meuPapel === 'editor'
  return <section className="space-y-4 rounded-2xl border p-5" aria-label={`Agenda de ${nome}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">{nome}</h2>
        <p className="text-sm text-muted-foreground">Seu papel: {PAPEIS_EQUIPE[meuPapel].rotulo}. {podeOperar ? '' : 'Você pode consultar a agenda, mas não alterá-la.'}</p>
      </div>
      <div role="tablist" aria-label="Seções da agenda" className="flex gap-2">
        {(['reservas', 'recursos'] as const).map(a => (
          <button key={a} role="tab" type="button" aria-selected={aba === a} onClick={() => setAba(a)}
            className={`min-h-11 rounded-lg border px-4 text-sm ${aba === a ? 'bg-foreground text-background' : ''}`}>{a === 'reservas' ? 'Reservas' : 'Recursos e horários'}</button>
        ))}
      </div>
    </div>
    {aba === 'reservas'
      ? <AgendaReservas recursos={recursos} reservas={reservas} podeOperar={podeOperar} podeGerenciarFinanceiro={podeConfigurar} />
      : <AgendaRecursos organizacaoId={organizacaoId} recursos={recursos} disponibilidade={disponibilidade} bloqueios={bloqueios} podeConfigurar={podeConfigurar} podeOperar={podeOperar} />}
  </section>
}
