'use client'

import { useState, useTransition } from 'react'
import { definirDownloadGaleria, definirFotosColecao, removerColecao, salvarColecao } from '@/lib/actions/colecoes'

export type FotoGestao = { id: string; url: string; nome: string }
export type ColecaoGestao = { id: string; nome: string; fotoIds: string[] }
export type DownloadGestao = { liberado: boolean; expiraEm: string | null; limite: number }

export function GestaoGaleria({ projetoId, fotos, colecoes, download }: { projetoId: string; fotos: FotoGestao[]; colecoes: ColecaoGestao[]; download: DownloadGestao }) {
  const [nome, setNome] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [liberado, setLiberado] = useState(download.liberado)
  const [limite, setLimite] = useState(String(download.limite))
  const [validade, setValidade] = useState(download.expiraEm ? download.expiraEm.slice(0, 10) : '')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  const abrir = (c: ColecaoGestao) => { setEditando(c.id); setMarcadas(new Set(c.fotoIds)) }
  return <section className="space-y-5 rounded-2xl border p-5" aria-label="Coleções e download">
    <div>
      <h2 className="text-xl font-semibold">Coleções e download</h2>
      <p className="mt-1 text-sm text-muted-foreground">Coleções organizam as mesmas fotos (sem copiar arquivos): uma foto pode estar em várias. Remover uma coleção não apaga fotos.</p>
    </div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="text-sm">{aviso}</p>}
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => {
      e.preventDefault(); setErro(''); setAviso('')
      iniciar(async () => { const r = await salvarColecao(projetoId, crypto.randomUUID(), nome, colecoes.length); if (!r.ok) setErro(r.erro); else { setNome(''); setAviso('Coleção criada.') } })
    }}>
      <label className="grid gap-1 text-sm">Nova coleção<input required minLength={2} maxLength={80} value={nome} onChange={e => setNome(e.target.value)} className="min-h-11 rounded-lg border px-3" placeholder="Ex.: Cerimônia" /></label>
      <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">Criar</button>
    </form>
    {colecoes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma coleção ainda.</p> : <ul className="space-y-3">
      {colecoes.map(c => <li key={c.id} className="space-y-3 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{c.nome} <span className="text-sm font-normal text-muted-foreground">· {c.fotoIds.length} fotos</span></p>
          <span className="flex gap-2">
            <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" aria-expanded={editando === c.id} onClick={() => editando === c.id ? setEditando(null) : abrir(c)}>{editando === c.id ? 'Fechar' : 'Escolher fotos'}</button>
            <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => { setErro(''); setAviso(''); iniciar(async () => { const r = await removerColecao(projetoId, c.id); if (!r.ok) setErro(r.erro); else setAviso('Coleção removida. As fotos continuam na galeria.') }) }}>Remover</button>
          </span>
        </div>
        {editando === c.id && <div className="space-y-3">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {fotos.map(f => <li key={f.id}><label className="relative block cursor-pointer overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura já assinada pelo servidor. */}
              <img src={f.url} alt={f.nome} loading="lazy" className="aspect-square w-full object-cover" />
              <input type="checkbox" aria-label={`Incluir ${f.nome} em ${c.nome}`} checked={marcadas.has(f.id)} onChange={e => setMarcadas(s => { const n = new Set(s); if (e.target.checked) n.add(f.id); else n.delete(f.id); return n })} className="absolute left-2 top-2 h-5 w-5" />
            </label></li>)}
          </ul>
          <button type="button" disabled={pendente || marcadas.size > 1000} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50" onClick={() => {
            setErro(''); setAviso('')
            iniciar(async () => { const r = await definirFotosColecao(projetoId, c.id, [...marcadas]); if (!r.ok) setErro(r.erro); else { setAviso(`Coleção atualizada: ${r.total} fotos.`); setEditando(null) } })
          }}>Salvar {marcadas.size} fotos</button>
        </div>}
      </li>)}
    </ul>}
    <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3" onSubmit={e => {
      e.preventDefault(); setErro(''); setAviso('')
      const n = Number(limite)
      if (!Number.isInteger(n) || n < 1 || n > 5000) { setErro('O limite deve ser um número de 1 a 5000.'); return }
      const expira = validade ? new Date(`${validade}T23:59:59`).toISOString() : null
      iniciar(async () => { const r = await definirDownloadGaleria(projetoId, liberado, expira, n); if (!r.ok) setErro(r.erro); else setAviso(liberado ? 'Download liberado.' : 'Download desligado.') })
    }}>
      <p className="text-sm sm:col-span-3"><strong>Download dos originais pelo cliente.</strong> Vem desligado: o cliente só vê as fotos em tamanho de tela. Cada baixada fica registrada.</p>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={liberado} onChange={e => setLiberado(e.target.checked)} /> Liberar download</label>
      <label className="grid gap-1 text-sm">Limite de fotos por acesso<input type="number" min={1} max={5000} value={limite} onChange={e => setLimite(e.target.value)} className="min-h-11 rounded-lg border px-3" /></label>
      <label className="grid gap-1 text-sm">Válido até (opcional)<input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="min-h-11 rounded-lg border px-3" /></label>
      <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50 sm:col-span-3 sm:w-fit">Salvar configuração</button>
    </form>
  </section>
}
