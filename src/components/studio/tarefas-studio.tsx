'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { atualizarTarefaStudio, criarTarefaStudio, mudarStatusTarefaStudio } from '@/lib/actions/studio-tarefas'
import {
  FILTROS_TAREFA, FILTRO_TAREFA_ROTULO, PRIORIDADES, PRIORIDADE_ROTULO, formatarData, podeEscreverEstudio,
} from '@/lib/studio/constantes'
import type { EquipeMembroRow, PapelOrganizacao, StudioFiltroTarefa, StudioFunilRow, StudioTarefaListaRow } from '@/types/database'
import { useChave } from './use-chave'

type Props = {
  organizacaoId: string
  meuPapel: PapelOrganizacao
  tarefas: StudioTarefaListaRow[]
  membros: EquipeMembroRow[]
  clientes: Pick<StudioFunilRow, 'cliente_id' | 'cliente_nome'>[]
  filtro: StudioFiltroTarefa
  responsavelFiltro: string | null
  hrefBase: string
}

function LinhaTarefa({ t, membros }: { t: StudioTarefaListaRow; membros: EquipeMembroRow[] }) {
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  const agir = (fn: () => Promise<{ ok: boolean; erro?: string }>) => { setErro(''); iniciar(async () => { const r = await fn(); if (!r.ok) setErro(r.erro ?? 'Falha.') }) }
  const aberta = t.status === 'aberta'
  return <li className="space-y-2 rounded-xl border p-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className={`font-medium ${aberta ? '' : 'line-through text-muted-foreground'}`}>{t.titulo}</p>
        <p className="text-sm text-muted-foreground">
          {t.cliente_nome ? `${t.cliente_nome} · ` : ''}Prazo: {formatarData(t.prazo)} · Prioridade {PRIORIDADE_ROTULO[t.prioridade].toLowerCase()}
          {t.atrasada ? ' · ATRASADA' : ''}
        </p>
        <p className="text-sm text-muted-foreground">Responsável: {t.responsavel_nome ?? 'sem responsável'}</p>
      </div>
      {t.pode_editar ? <div className="flex flex-wrap items-center gap-2">
        {aberta && <>
          <label className="sr-only" htmlFor={`resp-${t.id}`}>Responsável por {t.titulo}</label>
          <select id={`resp-${t.id}`} value={t.responsavel_id ?? ''} disabled={pendente} className="min-h-11 rounded-lg border px-2 text-sm"
            onChange={e => agir(() => atualizarTarefaStudio(t.id, { titulo: t.titulo, responsavelId: e.target.value, prazo: t.prazo, prioridade: t.prioridade, descricao: t.descricao }))}>
            {!t.responsavel_id && <option value="">—</option>}
            {membros.map(m => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
          </select>
          <button type="button" disabled={pendente} className="min-h-11 rounded-lg bg-[#171717] px-3 text-sm text-white disabled:opacity-50" onClick={() => agir(() => mudarStatusTarefaStudio(t.id, 'concluida'))}>Concluir</button>
          <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => agir(() => mudarStatusTarefaStudio(t.id, 'cancelada'))}>Cancelar</button>
        </>}
        {!aberta && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => agir(() => mudarStatusTarefaStudio(t.id, 'aberta'))}>Reabrir</button>}
      </div> : <span className="text-xs text-muted-foreground">Somente leitura</span>}
    </div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </li>
}

function NovaTarefa({ organizacaoId, membros, clientes }: Pick<Props, 'organizacaoId' | 'membros' | 'clientes'>) {
  const vazio = { titulo: '', responsavelId: '', prazo: '', prioridade: 'media', clienteId: '' }
  const [f, setF] = useState(vazio)
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  const chave = useChave()
  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(s => ({ ...s, [k]: e.target.value }))
  return <form className="grid gap-3 rounded-2xl border p-5 sm:grid-cols-2 lg:grid-cols-5" onSubmit={e => {
    e.preventDefault(); setErro('')
    iniciar(async () => {
      const r = await criarTarefaStudio({ organizacaoId, chave: chave.obter(), titulo: f.titulo, responsavelId: f.responsavelId || null, prazo: f.prazo || null, prioridade: f.prioridade, clienteId: f.clienteId || null })
      if (!r.ok) setErro(r.erro)
      else { chave.renovar(); setF(vazio) }
    })
  }}>
    <label className="grid gap-1 text-sm lg:col-span-2">Nova tarefa<input required minLength={2} maxLength={200} value={f.titulo} onChange={campo('titulo')} className="min-h-11 rounded-lg border px-3" /></label>
    <label className="grid gap-1 text-sm">Responsável<select value={f.responsavelId} onChange={campo('responsavelId')} className="min-h-11 rounded-lg border px-3"><option value="">Eu</option>{membros.map(m => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Prazo<input type="date" value={f.prazo} onChange={campo('prazo')} className="min-h-11 rounded-lg border px-3" /></label>
    <label className="grid gap-1 text-sm">Prioridade<select value={f.prioridade} onChange={campo('prioridade')} className="min-h-11 rounded-lg border px-3">{PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_ROTULO[p]}</option>)}</select></label>
    <label className="grid gap-1 text-sm sm:col-span-2">Cliente (opcional)<select value={f.clienteId} onChange={campo('clienteId')} className="min-h-11 rounded-lg border px-3"><option value="">Sem cliente</option>{clientes.map(c => <option key={c.cliente_id} value={c.cliente_id}>{c.cliente_nome}</option>)}</select></label>
    <div className="flex items-end"><button type="submit" disabled={pendente} className="min-h-11 rounded-lg bg-[#171717] px-4 text-sm text-white disabled:opacity-50">Criar tarefa</button></div>
    {erro && <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-5">{erro}</p>}
  </form>
}

/** Tarefas com filtros (minhas, atrasadas, hoje, por responsável). Editor só altera as próprias; visualizador só lê. */
export function TarefasStudio(props: Props) {
  const { organizacaoId, meuPapel, tarefas, membros, clientes, filtro, responsavelFiltro, hrefBase } = props
  return <div className="space-y-6">
    {podeEscreverEstudio(meuPapel) ? <NovaTarefa organizacaoId={organizacaoId} membros={membros} clientes={clientes} />
      : <p role="status" className="text-sm text-muted-foreground">Você tem acesso somente leitura às tarefas.</p>}
    <nav aria-label="Filtros de tarefas" className="flex flex-wrap items-center gap-2">
      {FILTROS_TAREFA.filter(f => f !== 'responsavel').map(f => <Link key={f} href={`${hrefBase}&f=${f}`} aria-current={f === filtro ? 'page' : undefined}
        className={`min-h-11 content-center rounded-full border px-4 text-sm ${f === filtro ? 'bg-[#171717] text-white' : ''}`}>{FILTRO_TAREFA_ROTULO[f]}</Link>)}
      <form action={hrefBase.split('?')[0]} className="flex items-center gap-2">
        <input type="hidden" name="aba" value="tarefas" />
        <input type="hidden" name="f" value="responsavel" />
        {hrefBase.includes('org=') && <input type="hidden" name="org" value={organizacaoId} />}
        <label className="sr-only" htmlFor="filtro-responsavel">Filtrar por responsável</label>
        <select id="filtro-responsavel" name="r" defaultValue={responsavelFiltro ?? ''} className="min-h-11 rounded-lg border px-2 text-sm">
          {membros.map(m => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
        </select>
        <button type="submit" className={`min-h-11 rounded-full border px-4 text-sm ${filtro === 'responsavel' ? 'bg-[#171717] text-white' : ''}`}>Por responsável</button>
      </form>
    </nav>
    {!tarefas.length ? <p className="text-sm text-muted-foreground">Nenhuma tarefa neste filtro.</p>
      : <ul className="space-y-3">{tarefas.map(t => <LinhaTarefa key={t.id} t={t} membros={membros} />)}</ul>}
  </div>
}
