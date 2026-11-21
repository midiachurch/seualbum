'use client'

import { useState, useTransition } from 'react'
import {
  cancelarSaidaStudio, definirFollowupDiasStudio, processarFilaStudio, reenfileirarSaidaStudio, rodarAutomacoesStudio,
} from '@/lib/actions/studio-comunicacao'
import { CANAL_ROTULO, OUTBOX_STATUS_ROTULO, formatarDataHora, podeEscreverEstudio, podeGerirEstudio } from '@/lib/studio/constantes'
import type { PapelOrganizacao, StudioOutboxListaRow } from '@/types/database'

type Props = { organizacaoId: string; meuPapel: PapelOrganizacao; itens: StudioOutboxListaRow[]; followupDias: number }

/** Fila de saída. Envio externo DESLIGADO: processar apenas simula (adaptador registro). */
export function SaidaStudio({ organizacaoId, meuPapel, itens, followupDias }: Props) {
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [dias, setDias] = useState(String(followupDias))
  const [pendente, iniciar] = useTransition()
  const gestor = podeGerirEstudio(meuPapel)
  const agir = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: (r: never) => string) => {
    setErro(''); setAviso('')
    iniciar(async () => { const r = await fn(); if (!r.ok) setErro(r.erro ?? 'Falha.'); else setAviso(ok(r as never)) })
  }
  return <div className="space-y-6">
    <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
      Envio externo desligado. Nenhum e-mail, WhatsApp ou SMS é enviado: itens processados ficam marcados como <strong>simulados</strong> e o texto que seria enviado é só registrado.
    </p>
    {gestor && <div className="flex flex-wrap items-end gap-3 rounded-2xl border p-5">
      <button type="button" disabled={pendente} className="min-h-11 rounded-lg bg-[#171717] px-4 text-sm text-white disabled:opacity-50"
        onClick={() => agir(() => processarFilaStudio(organizacaoId), (r: { resumo: { simuladas: number; falhas: number } }) => `${r.resumo.simuladas} simulado(s), ${r.resumo.falhas} com falha.`)}>Processar fila (simulação)</button>
      <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50"
        onClick={() => agir(() => rodarAutomacoesStudio(organizacaoId), (r: { lembretes: number; followups: number }) => `Gerados: ${r.lembretes} lembrete(s) de tarefa e ${r.followups} follow-up(s). Nada foi enviado.`)}>Rodar automações</button>
      <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); agir(() => definirFollowupDiasStudio(organizacaoId, Number(dias)), () => 'Prazo do follow-up atualizado.') }}>
        <label className="grid gap-1 text-sm">Follow-up de proposta após (dias)
          <input type="number" min={1} max={60} value={dias} onChange={e => setDias(e.target.value)} className="min-h-11 w-28 rounded-lg border px-3" /></label>
        <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">Salvar</button>
      </form>
    </div>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="text-sm">{aviso}</p>}
    {!itens.length ? <p className="text-sm text-muted-foreground">A fila de saída está vazia.</p>
      : <ul className="space-y-3">{itens.map(i => <li key={i.id} className="space-y-1 rounded-xl border p-3">
        <p className="text-sm font-medium">{i.cliente_nome ?? 'Equipe'} · {CANAL_ROTULO[i.canal]} · {OUTBOX_STATUS_ROTULO[i.status]}</p>
        <p className="text-sm text-muted-foreground">Para {i.destinatario} · {formatarDataHora(i.created_at)} · tentativas {i.tentativas}/{i.max_tentativas}</p>
        {i.assunto && <p className="text-sm">{i.assunto}</p>}
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{i.corpo}</p>
        {i.ultimo_erro && <p className="text-sm text-destructive">Último erro: {i.ultimo_erro}</p>}
        <div className="flex gap-2">
          {podeEscreverEstudio(meuPapel) && (i.status === 'pendente' || i.status === 'falhou') && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => agir(() => cancelarSaidaStudio(i.id), () => 'Item cancelado.')}>Cancelar</button>}
          {gestor && i.status === 'falhou' && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => agir(() => reenfileirarSaidaStudio(i.id), () => 'Item reenfileirado.')}>Reenfileirar</button>}
        </div>
      </li>)}</ul>}
  </div>
}
