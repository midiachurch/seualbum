'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { criarNegocioStudio, mudarEtapaStudio } from '@/lib/actions/studio-funil'
import {
  ETAPAS, ETAPA_ROTULO, MOTIVOS_PERDA, MOTIVO_PERDA_ROTULO, ORIGENS, ORIGEM_ROTULO, formatarData, formatarReais, podeEscreverEstudio,
} from '@/lib/studio/constantes'
import type { EquipeMembroRow, PapelOrganizacao, StudioEtapa, StudioFunilRow, StudioMotivoPerda } from '@/types/database'
import { useChave } from './use-chave'

type Props = { organizacaoId: string; meuPapel: PapelOrganizacao; negocios: StudioFunilRow[]; membros: EquipeMembroRow[]; hrefBase: string; clienteAberto: string | null }

function CartaoNegocio({ n, podeEscrever, hrefBase, ativo }: { n: StudioFunilRow; podeEscrever: boolean; hrefBase: string; ativo: boolean }) {
  const [destino, setDestino] = useState<StudioEtapa>(n.etapa)
  const [motivo, setMotivo] = useState<StudioMotivoPerda>('preco')
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  const chave = useChave()
  const semAcao = (n.etapa === 'lead' || n.etapa === 'contato' || n.etapa === 'proposta') && !n.proxima_acao_titulo
  const mover = (para: StudioEtapa, m?: StudioMotivoPerda) => {
    setErro('')
    iniciar(async () => {
      const r = await mudarEtapaStudio(n.id, para, chave.obter(), m ?? null)
      if (!r.ok) setErro(r.erro)
      else chave.renovar()
    })
  }
  return <li className={`space-y-2 rounded-xl border p-3 ${ativo ? 'ring-2 ring-[#171717]' : ''}`}>
    <div>
      <p className="font-medium">{n.titulo}</p>
      <p className="text-sm text-muted-foreground">{n.cliente_nome} · {ORIGEM_ROTULO[n.origem]}</p>
    </div>
    <p className="text-sm">{formatarReais(n.valor_estimado)} · {n.dias_na_etapa} d na etapa{n.responsavel_nome ? ` · ${n.responsavel_nome}` : ''}</p>
    {n.etapa === 'perdido' && n.motivo_perda && <p className="text-xs text-muted-foreground">Motivo: {MOTIVO_PERDA_ROTULO[n.motivo_perda]}</p>}
    {n.proxima_acao_titulo
      ? <p className="text-sm">Próxima ação: {n.proxima_acao_titulo} ({formatarData(n.proxima_acao_prazo)}){n.tarefas_atrasadas > 0 ? ' · atrasada' : ''}</p>
      : semAcao && <p className="text-sm text-amber-700">Sem próxima ação definida</p>}
    {podeEscrever && <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`etapa-${n.id}`}>Etapa de {n.titulo}</label>
      <select id={`etapa-${n.id}`} value={destino} disabled={pendente} className="min-h-11 rounded-lg border px-2 text-sm"
        onChange={e => { const v = e.target.value as StudioEtapa; setDestino(v); if (v !== 'perdido' && v !== n.etapa) mover(v) }}>
        {ETAPAS.map(e => <option key={e} value={e}>{ETAPA_ROTULO[e]}</option>)}
      </select>
      {destino === 'perdido' && n.etapa !== 'perdido' && <>
        <select aria-label="Motivo da perda" value={motivo} onChange={e => setMotivo(e.target.value as StudioMotivoPerda)} className="min-h-11 rounded-lg border px-2 text-sm">
          {MOTIVOS_PERDA.map(m => <option key={m} value={m}>{MOTIVO_PERDA_ROTULO[m]}</option>)}
        </select>
        <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => mover('perdido', motivo)}>Confirmar perda</button>
      </>}
    </div>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <Link href={`${hrefBase}&c=${n.cliente_id}`} className="inline-block text-sm underline">Ver linha do tempo</Link>
  </li>
}

function NovoNegocio({ organizacaoId, membros }: { organizacaoId: string; membros: EquipeMembroRow[] }) {
  const [f, setF] = useState({ titulo: '', nome: '', email: '', telefone: '', origem: 'indicacao', valor: '', responsavelId: '' })
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  const chave = useChave()
  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(s => ({ ...s, [k]: e.target.value }))
  return <form className="grid gap-3 rounded-2xl border p-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e => {
    e.preventDefault(); setErro(''); setAviso('')
    iniciar(async () => {
      const r = await criarNegocioStudio({
        organizacaoId, chave: chave.obter(), titulo: f.titulo, nome: f.nome, email: f.email, telefone: f.telefone,
        origem: f.origem, valor: Number(f.valor.replace(',', '.') || 0), responsavelId: f.responsavelId || null,
      })
      if (!r.ok) setErro(r.erro)
      else { chave.renovar(); setAviso('Negócio criado.'); setF({ titulo: '', nome: '', email: '', telefone: '', origem: 'indicacao', valor: '', responsavelId: '' }) }
    })
  }}>
    <h3 className="text-lg font-semibold sm:col-span-2 lg:col-span-4">Novo lead</h3>
    <label className="grid gap-1 text-sm">Título do negócio<input required minLength={2} maxLength={160} value={f.titulo} onChange={campo('titulo')} className="min-h-11 rounded-lg border px-3" /></label>
    <label className="grid gap-1 text-sm">Nome do cliente<input required minLength={2} maxLength={120} value={f.nome} onChange={campo('nome')} className="min-h-11 rounded-lg border px-3" /></label>
    <label className="grid gap-1 text-sm">E-mail<input type="email" maxLength={254} value={f.email} onChange={campo('email')} className="min-h-11 rounded-lg border px-3" /></label>
    <label className="grid gap-1 text-sm">Telefone<input maxLength={40} value={f.telefone} onChange={campo('telefone')} className="min-h-11 rounded-lg border px-3" /></label>
    <label className="grid gap-1 text-sm">Origem<select value={f.origem} onChange={campo('origem')} className="min-h-11 rounded-lg border px-3">{ORIGENS.map(o => <option key={o} value={o}>{ORIGEM_ROTULO[o]}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Valor estimado (R$)<input inputMode="decimal" value={f.valor} onChange={campo('valor')} className="min-h-11 rounded-lg border px-3" /></label>
    <label className="grid gap-1 text-sm">Responsável<select value={f.responsavelId} onChange={campo('responsavelId')} className="min-h-11 rounded-lg border px-3">
      <option value="">Eu</option>{membros.map(m => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}</select></label>
    <div className="flex items-end"><button type="submit" disabled={pendente} className="min-h-11 rounded-lg bg-[#171717] px-4 text-sm text-white disabled:opacity-50">Criar negócio</button></div>
    {erro && <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-4">{erro}</p>}
    {aviso && <p role="status" className="text-sm sm:col-span-2 lg:col-span-4">{aviso}</p>}
  </form>
}

/** Funil comercial em colunas. A etapa é comercial: não altera o status de produção do projeto. */
export function FunilStudio({ organizacaoId, meuPapel, negocios, membros, hrefBase, clienteAberto }: Props) {
  const podeEscrever = podeEscreverEstudio(meuPapel)
  return <div className="space-y-6">
    {podeEscrever ? <NovoNegocio organizacaoId={organizacaoId} membros={membros} />
      : <p role="status" className="text-sm text-muted-foreground">Você tem acesso somente leitura ao funil.</p>}
    <div className="grid gap-4 lg:grid-cols-5">
      {ETAPAS.map(etapa => {
        const lista = negocios.filter(n => n.etapa === etapa)
        const total = lista.reduce((s, n) => s + n.valor_estimado, 0)
        return <section key={etapa} aria-label={ETAPA_ROTULO[etapa]} className="space-y-3 rounded-2xl border p-3">
          <header>
            <h3 className="font-semibold">{ETAPA_ROTULO[etapa]} <span className="text-sm font-normal text-muted-foreground">({lista.length})</span></h3>
            <p className="text-xs text-muted-foreground">{formatarReais(total)}</p>
          </header>
          {!lista.length ? <p className="text-sm text-muted-foreground">Nenhum negócio.</p>
            : <ul className="space-y-3">{lista.map(n => <CartaoNegocio key={n.id} n={n} podeEscrever={podeEscrever} hrefBase={hrefBase} ativo={n.cliente_id === clienteAberto} />)}</ul>}
        </section>
      })}
    </div>
  </div>
}
