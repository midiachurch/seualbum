'use client'

import { useState, useTransition } from 'react'
import {
  cancelarReservaEstudio, concluirReservaEstudio, confirmarReservaEstudio, listarSlotsEstudio, registrarReembolsoEstudio,
  registrarSinalEstudio, remarcarReservaEstudio, reservarPeloEstudio, vincularClienteReserva,
} from '@/lib/actions/agenda'
import { agruparSlotsPorDia, formatarReais, hojeNoFuso, rotuloDataHora, somarDias, type GrupoDeSlots } from '@/lib/agenda/formatacao'
import { ROTULO_SINAL, ROTULO_STATUS, statusEfetivo } from '@/lib/agenda/regras'
import type { AgendaRecursoRow, AgendaReservaRow } from '@/types/database'

type Filtro = 'abertas' | 'proximas' | 'historico'

/** Escolhe um slot livre de um recurso a partir de uma data (a janela é de 7 dias). */
function SeletorDeSlots({ recurso, onEscolher, desabilitado }: { recurso: AgendaRecursoRow; onEscolher: (inicio: string) => void; desabilitado: boolean }) {
  const [data, setData] = useState(() => hojeNoFuso(recurso.fuso))
  const [grupos, setGrupos] = useState<GrupoDeSlots[] | null>(null)
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  return <div className="space-y-2">
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm">A partir de
        <input type="date" value={data} onChange={e => setData(e.target.value)} className="min-h-11 rounded-lg border px-3" />
      </label>
      <button type="button" disabled={pendente || !data} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50" onClick={() => {
        setErro('')
        iniciar(async () => {
          const r = await listarSlotsEstudio(recurso.id, data, somarDias(data, 6))
          if (!r.ok) { setErro(r.erro); return }
          setGrupos(agruparSlotsPorDia(r.slots, recurso.fuso))
        })
      }}>Ver horários livres</button>
    </div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {grupos && (grupos.length ? grupos.map(g => <section key={g.dia} aria-label={g.rotulo}>
      <h4 className="mb-1 text-sm font-medium capitalize">{g.rotulo}</h4>
      <ul className="flex flex-wrap gap-2">{g.slots.map(s => <li key={s.inicio}>
        <button type="button" disabled={desabilitado} className="min-h-11 min-w-16 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => onEscolher(s.inicio)}>{s.hora}</button>
      </li>)}</ul>
    </section>) : <p className="text-sm">Sem horários livres nesta semana.</p>)}
  </div>
}

type Props = { recursos: AgendaRecursoRow[]; reservas: AgendaReservaRow[]; podeOperar: boolean; podeGerenciarFinanceiro: boolean }

export function AgendaReservas({ recursos, reservas, podeOperar, podeGerenciarFinanceiro }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('abertas')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [remarcando, setRemarcando] = useState<string | null>(null)
  const [novaAberta, setNovaAberta] = useState(false)
  const [recursoNovo, setRecursoNovo] = useState(recursos[0]?.id ?? '')
  const [slotNovo, setSlotNovo] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [pendente, iniciar] = useTransition()
  const [agora] = useState(() => Date.now())
  const porRecurso = new Map(recursos.map(r => [r.id, r]))

  const efetivo = (r: AgendaReservaRow) => statusEfetivo(r, agora)
  const visiveis = reservas.filter(r => {
    const s = efetivo(r)
    if (filtro === 'abertas') return s === 'hold' || (s === 'confirmada' && Date.parse(r.fim) < agora)
    if (filtro === 'proximas') return s === 'confirmada' && Date.parse(r.fim) >= agora
    return s === 'cancelada' || s === 'expirada' || s === 'concluida'
  })
  const executar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) => {
    setErro(''); setAviso('')
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'Não foi possível concluir.')
      else setAviso(ok)
    })
  }
  const recNovo = porRecurso.get(recursoNovo)

  return <div className="space-y-4">
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="text-sm">{aviso}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar reservas">
        {([['abertas', 'Aguardando'], ['proximas', 'Próximas'], ['historico', 'Histórico']] as const).map(([k, rot]) => (
          <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={`min-h-11 rounded-lg border px-4 text-sm ${filtro === k ? 'bg-foreground text-background' : ''}`}>{rot}</button>
        ))}
      </div>
      {podeOperar && recursos.length > 0 && <button type="button" className="min-h-11 rounded-lg border px-4 text-sm" onClick={() => setNovaAberta(v => !v)}>{novaAberta ? 'Fechar' : 'Nova reserva'}</button>}
    </div>

    {novaAberta && podeOperar && recNovo && <form className="space-y-3 rounded-xl border p-4" onSubmit={e => {
      e.preventDefault()
      if (!slotNovo) { setErro('Escolha um horário livre.'); return }
      executar(async () => {
        const r = await reservarPeloEstudio(recNovo.id, slotNovo, nome, email, telefone)
        if (r.ok) { setSlotNovo(''); setNome(''); setEmail(''); setTelefone(''); setNovaAberta(false) }
        return r
      }, 'Reserva criada e confirmada.')
    }}>
      <h3 className="font-medium">Reservar pelo estúdio</h3>
      <label className="grid gap-1 text-sm">Recurso
        <select value={recursoNovo} onChange={e => { setRecursoNovo(e.target.value); setSlotNovo('') }} className="min-h-11 rounded-lg border px-3">{recursos.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}</select>
      </label>
      <SeletorDeSlots key={recNovo.id} recurso={recNovo} desabilitado={pendente} onEscolher={setSlotNovo} />
      {slotNovo && <p className="text-sm">Horário escolhido: <strong>{rotuloDataHora(slotNovo, recNovo.fuso)}</strong></p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">Nome<input required minLength={2} maxLength={120} value={nome} onChange={e => setNome(e.target.value)} className="min-h-11 rounded-lg border px-3" /></label>
        <label className="grid gap-1 text-sm">E-mail<input required type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="min-h-11 rounded-lg border px-3" /></label>
        <label className="grid gap-1 text-sm">Telefone<input type="tel" maxLength={30} value={telefone} onChange={e => setTelefone(e.target.value)} className="min-h-11 rounded-lg border px-3" /></label>
      </div>
      <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">{pendente ? 'Salvando…' : 'Criar reserva confirmada'}</button>
    </form>}

    {!recursos.length && <p className="text-sm text-muted-foreground">Crie um recurso na aba “Recursos e horários” para começar a receber reservas.</p>}
    {recursos.length > 0 && !visiveis.length && <p className="text-sm text-muted-foreground">Nenhuma reserva nesta lista.</p>}
    <ul className="divide-y rounded-xl border">
      {visiveis.map(r => {
        const rec = porRecurso.get(r.recurso_id)
        const fuso = rec?.fuso ?? 'UTC'
        const s = efetivo(r)
        return <li key={r.id} className="space-y-2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{r.contato_nome} <span className="text-sm font-normal text-muted-foreground">· {rec?.nome ?? 'Recurso'}</span></p>
              <p className="text-sm">{rotuloDataHora(r.inicio, fuso)}</p>
              <p className="text-sm text-muted-foreground">{r.contato_email}{r.contato_telefone ? ` · ${r.contato_telefone}` : ''}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">{ROTULO_STATUS[s] ?? s}</p>
              {(r.sinal_centavos ?? 0) > 0 && <p className="text-muted-foreground">{formatarReais(r.sinal_centavos)} · {ROTULO_SINAL[r.sinal_status]}</p>}
              {r.cliente_id && <p className="text-muted-foreground">Vinculada ao cadastro</p>}
            </div>
          </div>
          {podeOperar && <div className="flex flex-wrap gap-2">
            {s === 'hold' && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => executar(() => confirmarReservaEstudio(r.id), 'Reserva confirmada.')}>Confirmar</button>}
            {s === 'hold' && r.sinal_status === 'pendente' && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => executar(() => registrarSinalEstudio(r.id), 'Sinal registrado (simulado).')}>Registrar sinal</button>}
            {s === 'confirmada' && Date.parse(r.inicio) <= agora && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => executar(() => concluirReservaEstudio(r.id), 'Reserva concluída.')}>Concluir</button>}
            {s === 'confirmada' && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => setRemarcando(remarcando === r.id ? null : r.id)}>Remarcar</button>}
            {(s === 'hold' || s === 'confirmada') && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50"
              onClick={() => { const m = window.prompt('Motivo do cancelamento (opcional):'); if (m !== null) executar(() => cancelarReservaEstudio(r.id, m), 'Reserva cancelada.') }}>Cancelar</button>}
            {(s === 'confirmada' || s === 'concluida') && !r.cliente_id && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => executar(() => vincularClienteReserva(r.id), 'Cliente vinculado ao cadastro.')}>Vincular a cliente</button>}
            {podeGerenciarFinanceiro && r.sinal_status === 'reembolso_pendente' && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => executar(() => registrarReembolsoEstudio(r.id), 'Reembolso registrado.')}>Marcar reembolso feito</button>}
          </div>}
          {remarcando === r.id && rec && <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm">Escolha o novo horário:</p>
            <SeletorDeSlots recurso={rec} desabilitado={pendente} onEscolher={inicio => executar(async () => { const x = await remarcarReservaEstudio(r.id, inicio); if (x.ok) setRemarcando(null); return x }, 'Reserva remarcada.')} />
          </div>}
        </li>
      })}
    </ul>
  </div>
}
