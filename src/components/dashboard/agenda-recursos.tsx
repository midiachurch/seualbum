'use client'

import { useState, useTransition } from 'react'
import {
  arquivarRecursoAgenda, criarBloqueioAgenda, definirDisponibilidadeAgenda, removerBloqueioAgenda, salvarRecursoAgenda, type DadosRecurso,
} from '@/lib/actions/agenda'
import { DIAS_SEMANA, horaCurta, instanteLocal, lerPeriodo, rotuloDataHora } from '@/lib/agenda/formatacao'
import { ROTULO_TIPO, TIPOS_RECURSO, janelasValidas, type JanelaSemanal } from '@/lib/agenda/regras'
import type { AgendaBloqueioRow, AgendaDisponibilidadeRow, AgendaRecursoRow } from '@/types/database'

const FUSOS_COMUNS = ['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza', 'America/Cuiaba', 'America/Rio_Branco', 'America/Noronha','Europe/Lisbon', 'America/New_York', 'UTC']

const slugDe = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

const VAZIO: DadosRecurso = {
  nome: '', slug: '', tipo: 'pessoa', descricao: '', fuso: 'America/Sao_Paulo', duracaoMin: 60, bufferMin: 0, intervaloMin: 30,
  antecedenciaMinMin: 120, antecedenciaMaxDias: 60, cancelamentoAntecedenciaH: 24, sinalCentavos: null, publicado: false,
}
const deRecurso = (r: AgendaRecursoRow): DadosRecurso => ({
  nome: r.nome, slug: r.slug, tipo: r.tipo, descricao: r.descricao ?? '', fuso: r.fuso, duracaoMin: r.duracao_min, bufferMin: r.buffer_min,
  intervaloMin: r.intervalo_min, antecedenciaMinMin: r.antecedencia_min_min, antecedenciaMaxDias: r.antecedencia_max_dias,
  cancelamentoAntecedenciaH: r.cancelamento_antecedencia_h, sinalCentavos: r.sinal_centavos, publicado: r.publicado,
})

function Numero({ rotulo, valor, onChange, min, max, ajuda }: { rotulo: string; valor: number; onChange: (n: number) => void; min: number; max: number; ajuda?: string }) {
  return <label className="grid gap-1 text-sm">{rotulo}
    <input type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(valor) ? valor : ''} onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))} className="min-h-11 rounded-lg border px-3" />
    {ajuda && <span className="text-xs text-muted-foreground">{ajuda}</span>}
  </label>
}

function FormRecurso({ organizacaoId, recurso, podeConfigurar, aoSalvar }: { organizacaoId: string; recurso: AgendaRecursoRow | null; podeConfigurar: boolean; aoSalvar: () => void }) {
  const [d, setD] = useState<DadosRecurso>(recurso ? deRecurso(recurso) : VAZIO)
  const [slugManual, setSlugManual] = useState(Boolean(recurso))
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  const set = <K extends keyof DadosRecurso>(k: K, v: DadosRecurso[K]) => setD(x => ({ ...x, [k]: v }))
  return <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => {
    e.preventDefault(); setErro(''); setAviso('')
    iniciar(async () => {
      const r = await salvarRecursoAgenda(organizacaoId, recurso?.id ?? null, d)
      if (!r.ok) setErro(r.erro)
      else { setAviso('Recurso salvo.'); if (!recurso) setD(VAZIO); aoSalvar() }
    })
  }}>
    {erro && <p role="alert" className="text-sm text-destructive sm:col-span-2">{erro}</p>}
    {aviso && <p role="status" className="text-sm sm:col-span-2">{aviso}</p>}
    <label className="grid gap-1 text-sm">Nome
      <input required minLength={2} maxLength={120} value={d.nome} disabled={!podeConfigurar} onChange={e => { set('nome', e.target.value); if (!slugManual) set('slug', slugDe(e.target.value)) }} className="min-h-11 rounded-lg border px-3" />
    </label>
    <label className="grid gap-1 text-sm">Endereço público (/agendar/…)
      <input required minLength={3} maxLength={60} pattern="[a-z0-9][a-z0-9\-]{1,58}[a-z0-9]" value={d.slug} disabled={!podeConfigurar} onChange={e => { setSlugManual(true); set('slug', e.target.value.toLowerCase()) }} className="min-h-11 rounded-lg border px-3" />
    </label>
    <label className="grid gap-1 text-sm">Tipo
      <select value={d.tipo} disabled={!podeConfigurar} onChange={e => set('tipo', e.target.value)} className="min-h-11 rounded-lg border px-3">{TIPOS_RECURSO.map(t => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}</select>
    </label>
    <label className="grid gap-1 text-sm">Fuso horário
      <input required list="fusos-agenda" value={d.fuso} disabled={!podeConfigurar} onChange={e => set('fuso', e.target.value)} className="min-h-11 rounded-lg border px-3" />
      <datalist id="fusos-agenda">{FUSOS_COMUNS.map(f => <option key={f} value={f} />)}</datalist>
    </label>
    <label className="grid gap-1 text-sm sm:col-span-2">Descrição (aparece na página pública)
      <textarea maxLength={1000} rows={2} value={d.descricao} disabled={!podeConfigurar} onChange={e => set('descricao', e.target.value)} className="rounded-lg border px-3 py-2" />
    </label>
    <Numero rotulo="Duração (min)" valor={d.duracaoMin} min={5} max={720} onChange={n => set('duracaoMin', n)} />
    <Numero rotulo="Intervalo entre início de horários (min)" valor={d.intervaloMin} min={5} max={240} onChange={n => set('intervaloMin', n)} ajuda="Ex.: 30 oferece 09:00, 09:30, 10:00…" />
    <Numero rotulo="Folga depois de cada reserva (min)" valor={d.bufferMin} min={0} max={240} onChange={n => set('bufferMin', n)} ajuda="Tempo de preparo/deslocamento entre sessões." />
    <Numero rotulo="Antecedência mínima (min)" valor={d.antecedenciaMinMin} min={0} max={20160} onChange={n => set('antecedenciaMinMin', n)} ajuda="Ninguém reserva com menos tempo que isso." />
    <Numero rotulo="Reservável até (dias à frente)" valor={d.antecedenciaMaxDias} min={1} max={365} onChange={n => set('antecedenciaMaxDias', n)} />
    <Numero rotulo="Cancelar/remarcar pelo cliente até (horas antes)" valor={d.cancelamentoAntecedenciaH} min={0} max={720} onChange={n => set('cancelamentoAntecedenciaH', n)} />
    <label className="grid gap-1 text-sm">Sinal em R$ (simulado; vazio = sem sinal)
      <input type="number" min={0} max={100000} step="0.01" value={d.sinalCentavos == null ? '' : d.sinalCentavos / 100} disabled={!podeConfigurar}
        onChange={e => set('sinalCentavos', e.target.value === '' ? null : Math.round(Number(e.target.value) * 100))} className="min-h-11 rounded-lg border px-3" />
    </label>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={d.publicado} disabled={!podeConfigurar} onChange={e => set('publicado', e.target.checked)} /> Publicado (visível na página pública)</label>
    {podeConfigurar && <div className="sm:col-span-2"><button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">{pendente ? 'Salvando…' : recurso ? 'Salvar recurso' : 'Criar recurso'}</button></div>}
  </form>
}

function Disponibilidade({ recurso, linhas, podeConfigurar }: { recurso: AgendaRecursoRow; linhas: AgendaDisponibilidadeRow[]; podeConfigurar: boolean }) {
  const [janelas, setJanelas] = useState<JanelaSemanal[]>(linhas.map(l => ({ dia: l.dia_semana, inicio: horaCurta(l.inicio), fim: horaCurta(l.fim) })))
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  const editar = (i: number, p: Partial<JanelaSemanal>) => setJanelas(js => js.map((j, k) => k === i ? { ...j, ...p } : j))
  return <div className="space-y-2">
    <h4 className="font-medium">Horários da semana (no fuso do recurso)</h4>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="text-sm">{aviso}</p>}
    {DIAS_SEMANA.map((nome, dia) => <div key={dia} className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-sm">{nome}</span>
      {janelas.map((j, i) => j.dia !== dia ? null : <span key={i} className="flex items-center gap-1">
        <input type="time" aria-label={`${nome}: início`} value={j.inicio} disabled={!podeConfigurar} onChange={e => editar(i, { inicio: e.target.value })} className="min-h-11 rounded-lg border px-2" />
        <span>às</span>
        <input type="time" aria-label={`${nome}: fim`} value={j.fim === '24:00' ? '23:59' : j.fim} disabled={!podeConfigurar} onChange={e => editar(i, { fim: e.target.value })} className="min-h-11 rounded-lg border px-2" />
        {podeConfigurar && <button type="button" aria-label={`Remover janela de ${nome}`} className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => setJanelas(js => js.filter((_, k) => k !== i))}>×</button>}
      </span>)}
      {podeConfigurar && <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => setJanelas(js => [...js, { dia, inicio: '09:00', fim: '17:00' }])}>+ horário</button>}
    </div>)}
    {podeConfigurar && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50" onClick={() => {
      setErro(''); setAviso('')
      if (!janelasValidas(janelas)) { setErro('Confira os horários: fim depois do início e sem janelas sobrepostas no mesmo dia.'); return }
      iniciar(async () => { const r = await definirDisponibilidadeAgenda(recurso.id, janelas); if (!r.ok) setErro(r.erro); else setAviso('Horários salvos.') })
    }}>{pendente ? 'Salvando…' : 'Salvar horários'}</button>}
  </div>
}

function Bloqueios({ recurso, linhas, podeOperar }: { recurso: AgendaRecursoRow; linhas: AgendaBloqueioRow[]; podeOperar: boolean }) {
  const [ini, setIni] = useState('')
  const [fim, setFim] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  return <div className="space-y-2">
    <h4 className="font-medium">Bloqueios (folgas e exceções)</h4>
    <p className="text-xs text-muted-foreground">Bloqueios não cancelam reservas já feitas: cancele ou remarque essas manualmente.</p>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="text-sm">{aviso}</p>}
    <ul className="divide-y rounded-xl border">
      {linhas.map(b => { const p = lerPeriodo(b.periodo); return <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
        <span>{p ? `${rotuloDataHora(p.inicio, recurso.fuso)} até ${rotuloDataHora(p.fim, recurso.fuso)}` : 'Período'}{b.motivo ? ` · ${b.motivo}` : ''}</span>
        {podeOperar && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => {
          setErro(''); setAviso(''); iniciar(async () => { const r = await removerBloqueioAgenda(b.id); if (!r.ok) setErro(r.erro) })
        }}>Remover</button>}
      </li> })}
      {!linhas.length && <li className="p-2 text-sm text-muted-foreground">Sem bloqueios.</li>}
    </ul>
    {podeOperar && <form className="grid gap-2 sm:grid-cols-4 sm:items-end" onSubmit={e => {
      e.preventDefault(); setErro(''); setAviso('')
      const a = instanteLocal(ini, recurso.fuso); const b = instanteLocal(fim, recurso.fuso)
      if (!a || !b) { setErro('Informe início e fim.'); return }
      iniciar(async () => { const r = await criarBloqueioAgenda(recurso.id, a, b, motivo); if (!r.ok) setErro(r.erro); else { setIni(''); setFim(''); setMotivo(''); setAviso('Bloqueio criado.') } })
    }}>
      <label className="grid gap-1 text-sm">Início<input type="datetime-local" required value={ini} onChange={e => setIni(e.target.value)} className="min-h-11 rounded-lg border px-2" /></label>
      <label className="grid gap-1 text-sm">Fim<input type="datetime-local" required value={fim} onChange={e => setFim(e.target.value)} className="min-h-11 rounded-lg border px-2" /></label>
      <label className="grid gap-1 text-sm">Motivo<input maxLength={200} value={motivo} onChange={e => setMotivo(e.target.value)} className="min-h-11 rounded-lg border px-3" /></label>
      <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">Bloquear</button>
    </form>}
  </div>
}

type Props = {
  organizacaoId: string
  recursos: AgendaRecursoRow[]
  disponibilidade: AgendaDisponibilidadeRow[]
  bloqueios: AgendaBloqueioRow[]
  podeConfigurar: boolean
  podeOperar: boolean
}

export function AgendaRecursos({ organizacaoId, recursos, disponibilidade, bloqueios, podeConfigurar, podeOperar }: Props) {
  const [aberto, setAberto] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  return <div className="space-y-4">
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {podeConfigurar && <div>
      <button type="button" className="min-h-11 rounded-lg border px-4 text-sm" onClick={() => setNovo(v => !v)}>{novo ? 'Fechar' : 'Novo recurso'}</button>
      {novo && <div className="mt-3 rounded-xl border p-4"><FormRecurso organizacaoId={organizacaoId} recurso={null} podeConfigurar aoSalvar={() => setNovo(false)} /></div>}
    </div>}
    {!recursos.length && <p className="text-sm text-muted-foreground">Nenhum recurso ainda. Um recurso é o que o cliente reserva: uma pessoa, um equipamento ou um espaço.</p>}
    <ul className="space-y-3">
      {recursos.map(r => <li key={r.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{r.nome} <span className="text-sm font-normal text-muted-foreground">· {ROTULO_TIPO[r.tipo]} · {r.fuso}</span></p>
            <p className="text-sm text-muted-foreground">{r.publicado ? <>Publicado em <code>/agendar/{r.slug}</code></> : 'Não publicado: ninguém reserva ainda.'}</p>
          </div>
          <button type="button" className="min-h-11 rounded-lg border px-4 text-sm" aria-expanded={aberto === r.id} onClick={() => setAberto(aberto === r.id ? null : r.id)}>{aberto === r.id ? 'Fechar' : 'Abrir'}</button>
        </div>
        {aberto === r.id && <div className="mt-4 space-y-6">
          <FormRecurso organizacaoId={organizacaoId} recurso={r} podeConfigurar={podeConfigurar} aoSalvar={() => undefined} />
          <Disponibilidade recurso={r} linhas={disponibilidade.filter(d => d.recurso_id === r.id)} podeConfigurar={podeConfigurar} />
          <Bloqueios recurso={r} linhas={bloqueios.filter(b => b.recurso_id === r.id)} podeOperar={podeOperar} />
          {podeConfigurar && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm text-destructive disabled:opacity-50" onClick={() => {
            if (!window.confirm('Arquivar este recurso? Ele sai do ar; as reservas existentes continuam no histórico.')) return
            setErro(''); iniciar(async () => { const x = await arquivarRecursoAgenda(r.id); if (!x.ok) setErro(x.erro) })
          }}>Arquivar recurso</button>}
        </div>}
      </li>)}
    </ul>
  </div>
}
