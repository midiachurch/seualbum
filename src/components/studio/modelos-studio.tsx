'use client'

import { useState, useTransition } from 'react'
import { enfileirarMensagemStudio, previaModeloStudio, salvarModeloStudio } from '@/lib/actions/studio-comunicacao'
import { CANAIS, CANAL_ROTULO, FINALIDADES, FINALIDADE_ROTULO, podeEscreverEstudio, podeGerirEstudio } from '@/lib/studio/constantes'
import { VALORES_EXEMPLO, VARIAVEIS_MODELO, renderizarPrevia, variaveisValidas } from '@/lib/studio/modelos'
import type { PapelOrganizacao, StudioFunilRow, StudioModeloRow, StudioPreviaRow } from '@/types/database'
import { useChave } from './use-chave'

type Props = { organizacaoId: string; meuPapel: PapelOrganizacao; modelos: StudioModeloRow[]; negocios: StudioFunilRow[] }

function ModeloItem({ m, organizacaoId, meuPapel, negocios }: { m: StudioModeloRow; organizacaoId: string; meuPapel: PapelOrganizacao; negocios: StudioFunilRow[] }) {
  const [negocioId, setNegocioId] = useState(negocios[0]?.id ?? '')
  const [previa, setPrevia] = useState<StudioPreviaRow | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  const chave = useChave()
  const negocio = negocios.find(n => n.id === negocioId)
  return <li className="space-y-2 rounded-xl border p-3">
    <p className="font-medium">{m.nome} <span className="text-sm font-normal text-muted-foreground">· {CANAL_ROTULO[m.canal]} · {FINALIDADE_ROTULO[m.finalidade]}{m.ativo ? '' : ' · inativo'}</span></p>
    {m.assunto && <p className="text-sm text-muted-foreground">Assunto: {m.assunto}</p>}
    <p className="whitespace-pre-wrap text-sm">{m.corpo}</p>
    {negocios.length > 0 && <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`neg-${m.id}`}>Negócio para a prévia</label>
      <select id={`neg-${m.id}`} value={negocioId} onChange={e => { setNegocioId(e.target.value); setPrevia(null) }} className="min-h-11 rounded-lg border px-2 text-sm">
        {negocios.map(n => <option key={n.id} value={n.id}>{n.cliente_nome} — {n.titulo}</option>)}
      </select>
      <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => {
        setErro(''); setAviso('')
        iniciar(async () => {
          const r = await previaModeloStudio(organizacaoId, m.id, negocio?.cliente_id ?? null, negocioId || null)
          if (!r.ok) setErro(r.erro); else setPrevia(r.previa)
        })
      }}>Ver prévia (não envia)</button>
      {podeEscreverEstudio(meuPapel) && m.ativo && <button type="button" disabled={pendente || !negocio} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => {
        if (!negocio) return
        setErro(''); setAviso('')
        iniciar(async () => {
          const r = await enfileirarMensagemStudio({ organizacaoId, chave: chave.obter(), canal: m.canal, clienteId: negocio.cliente_id, modeloId: m.id, negocioId: negocio.id })
          if (!r.ok) setErro(r.erro); else { chave.renovar(); setAviso('Na fila de saída. Nada é enviado: o envio externo está desligado.') }
        })
      }}>Colocar na fila (simulada)</button>}
    </div>}
    {previa && <div className="rounded-lg bg-[#F5F5F5] p-3 text-sm" aria-label="Prévia renderizada">
      {previa.assunto && <p className="font-medium">{previa.assunto}</p>}
      <p className="whitespace-pre-wrap">{previa.corpo}</p>
      {previa.faltando.length > 0 && <p className="mt-2 text-amber-700">Faltam dados para: {previa.faltando.join(', ')}</p>}
    </div>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="text-sm">{aviso}</p>}
  </li>
}

function FormModelo({ organizacaoId }: { organizacaoId: string }) {
  const [f, setF] = useState({ nome: '', canal: 'email', finalidade: 'livre', assunto: '', corpo: '' })
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(s => ({ ...s, [k]: e.target.value }))
  const valido = variaveisValidas(f.assunto) && variaveisValidas(f.corpo)
  const previaCorpo = renderizarPrevia(f.corpo, VALORES_EXEMPLO)
  return <form className="grid gap-3 rounded-2xl border p-5 lg:grid-cols-2" onSubmit={e => {
    e.preventDefault(); setErro(''); setAviso('')
    iniciar(async () => {
      const r = await salvarModeloStudio({ organizacaoId, nome: f.nome, canal: f.canal, finalidade: f.finalidade, assunto: f.assunto, corpo: f.corpo, ativo: true })
      if (!r.ok) setErro(r.erro); else { setAviso('Modelo salvo.'); setF({ nome: '', canal: 'email', finalidade: 'livre', assunto: '', corpo: '' }) }
    })
  }}>
    <h3 className="text-lg font-semibold lg:col-span-2">Novo modelo</h3>
    <label className="grid gap-1 text-sm">Nome<input required minLength={2} maxLength={80} value={f.nome} onChange={campo('nome')} className="min-h-11 rounded-lg border px-3" /></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="grid gap-1 text-sm">Canal<select value={f.canal} onChange={campo('canal')} className="min-h-11 rounded-lg border px-3">{CANAIS.map(c => <option key={c} value={c}>{CANAL_ROTULO[c]}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Finalidade<select value={f.finalidade} onChange={campo('finalidade')} className="min-h-11 rounded-lg border px-3">{FINALIDADES.map(c => <option key={c} value={c}>{FINALIDADE_ROTULO[c]}</option>)}</select></label>
    </div>
    <label className="grid gap-1 text-sm lg:col-span-2">Assunto (e-mail)<input maxLength={200} value={f.assunto} onChange={campo('assunto')} className="min-h-11 rounded-lg border px-3" /></label>
    <label className="grid gap-1 text-sm">Mensagem<textarea required maxLength={4000} rows={6} value={f.corpo} onChange={campo('corpo')} className="rounded-lg border p-3" /></label>
    <div className="space-y-2 text-sm">
      <p className="font-medium">Prévia com dados de exemplo</p>
      <p className="whitespace-pre-wrap rounded-lg bg-[#F5F5F5] p-3">{previaCorpo.texto || 'Digite a mensagem para ver a prévia.'}</p>
      <p className="text-muted-foreground">Variáveis: {VARIAVEIS_MODELO.map(v => `{{${v.nome}}}`).join(' ')}</p>
      {!valido && <p role="alert" className="text-destructive">Há variável desconhecida ou chaves incompletas.</p>}
    </div>
    <div className="lg:col-span-2"><button type="submit" disabled={pendente || !valido} className="min-h-11 rounded-lg bg-[#171717] px-4 text-sm text-white disabled:opacity-50">Salvar modelo</button></div>
    {erro && <p role="alert" className="text-sm text-destructive lg:col-span-2">{erro}</p>}
    {aviso && <p role="status" className="text-sm lg:col-span-2">{aviso}</p>}
  </form>
}

/** Modelos de mensagem com variáveis e prévia. A prévia só renderiza texto; colocar na fila também não envia. */
export function ModelosStudio({ organizacaoId, meuPapel, modelos, negocios }: Props) {
  return <div className="space-y-6">
    {podeGerirEstudio(meuPapel) ? <FormModelo organizacaoId={organizacaoId} />
      : <p role="status" className="text-sm text-muted-foreground">Somente dono e administradores editam modelos.</p>}
    {!modelos.length ? <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</p>
      : <ul className="space-y-3">{modelos.map(m => <ModeloItem key={m.id} m={m} organizacaoId={organizacaoId} meuPapel={meuPapel} negocios={negocios} />)}</ul>}
  </div>
}
