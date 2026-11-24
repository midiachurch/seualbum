'use client'

import { useState, useTransition } from 'react'
import { salvarProdutoStore, vincularProdutoStore } from '@/lib/actions/store'
import { formatarMoeda, percentualParaBps, reaisParaCentavos } from '@/lib/store/formato'
import type { PapelOrganizacao, StoreDivergenciaRow, StorePedidoRow, StoreProdutoRow } from '@/types/database'

const TIPOS = [
  ['colecao_digital', 'Coleção digital (preço fixo)'], ['foto_avulsa', 'Foto avulsa (preço por foto)'],
  ['impressao', 'Impressão (por unidade)'], ['servico', 'Serviço'],
] as const
type Props = {
  organizacaoId: string; nome: string; papel: PapelOrganizacao
  produtos: StoreProdutoRow[]; projetos: { id: string; nome: string }[]; vinculos: string[]
  pedidos: StorePedidoRow[]; divergencias: StoreDivergenciaRow[]
}

export function StoreEstudio({ organizacaoId, nome, papel, produtos, projetos, vinculos, pedidos, divergencias }: Props) {
  const gerirCatalogo = papel === 'dono' || papel === 'admin'
  const podeOferecer = gerirCatalogo || papel === 'editor'
  const [form, setForm] = useState({ id: '', nome: '', tipo: 'colecao_digital', preco: '', comissao: '0', descricao: '', ativo: true })
  const [ligados, setLigados] = useState(() => new Set(vinculos))
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, iniciar] = useTransition()
  return <section className="space-y-5 rounded-2xl border p-5" aria-label={`Loja de ${nome}`}>
    <h2 className="text-xl font-semibold">{nome}</h2>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="text-sm">{aviso}</p>}
    <div className="space-y-2">
      <h3 className="font-medium">Produtos</h3>
      {produtos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum produto ainda.</p> : <ul className="divide-y rounded-xl border">
        {produtos.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span>{p.nome} · {formatarMoeda(p.preco_centavos)} · comissão {(p.comissao_bps / 100).toLocaleString('pt-BR')}%{p.ativo ? '' : ' · inativo'}</span>
          {gerirCatalogo && <button type="button" className="min-h-11 rounded-lg border px-3" onClick={() => setForm({ id: p.id, nome: p.nome, tipo: p.tipo, preco: (p.preco_centavos / 100).toFixed(2).replace('.', ','), comissao: String(p.comissao_bps / 100).replace('.', ','), descricao: p.descricao ?? '', ativo: p.ativo })}>Editar</button>}
        </li>)}
      </ul>}
    </div>
    {gerirCatalogo && <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" onSubmit={e => {
      e.preventDefault(); setErro(''); setAviso('')
      const preco = reaisParaCentavos(form.preco); const bps = percentualParaBps(form.comissao)
      if (preco === null) { setErro('Preço inválido. Use o formato 99,90.'); return }
      if (bps === null) { setErro('Comissão inválida. Use um valor de 0 a 50.'); return }
      iniciar(async () => {
        const r = await salvarProdutoStore(organizacaoId, { id: form.id || crypto.randomUUID(), nome: form.nome, tipo: form.tipo, precoCentavos: preco, comissaoBps: bps, ativo: form.ativo, descricao: form.descricao || null })
        if (!r.ok) setErro(r.erro); else { setAviso('Produto salvo. Pedidos antigos mantêm o preço da época.'); setForm({ id: '', nome: '', tipo: 'colecao_digital', preco: '', comissao: '0', descricao: '', ativo: true }) }
      })
    }}>
      <label className="grid gap-1 text-sm">Nome<input required minLength={2} maxLength={120} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="min-h-11 rounded-lg border px-3" /></label>
      <label className="grid gap-1 text-sm">Tipo<select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="min-h-11 rounded-lg border px-3">{TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Preço (R$)<input required inputMode="decimal" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} className="min-h-11 rounded-lg border px-3" placeholder="99,90" /></label>
      <label className="grid gap-1 text-sm">Comissão da plataforma (%)<input required inputMode="decimal" value={form.comissao} onChange={e => setForm(f => ({ ...f, comissao: e.target.value }))} className="min-h-11 rounded-lg border px-3" /></label>
      <label className="grid gap-1 text-sm sm:col-span-2">Descrição (opcional)<input maxLength={600} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="min-h-11 rounded-lg border px-3" /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} /> Ativo</label>
      <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">{form.id ? 'Salvar alterações' : 'Criar produto'}</button>
    </form>}
    {podeOferecer && produtos.length > 0 && projetos.length > 0 && <div className="space-y-2">
      <h3 className="font-medium">Oferecer nas galerias</h3>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Galeria</th>{produtos.map(p => <th key={p.id} className="p-2 text-left">{p.nome}</th>)}</tr></thead>
        <tbody>{projetos.map(g => <tr key={g.id} className="border-t"><td className="p-2">{g.nome}</td>{produtos.map(p => {
          const chave = `${g.id}:${p.id}`
          return <td key={p.id} className="p-2"><input type="checkbox" aria-label={`${p.nome} em ${g.nome}`} checked={ligados.has(chave)} disabled={pendente} onChange={e => {
            const vincular = e.target.checked; setErro('')
            iniciar(async () => {
              const r = await vincularProdutoStore(g.id, p.id, vincular)
              if (!r.ok) { setErro(r.erro); return }
              setLigados(s => { const n = new Set(s); if (vincular) n.add(chave); else n.delete(chave); return n })
            })
          }} /></td>
        })}</tr>)}</tbody></table></div>
    </div>}
    {gerirCatalogo && <div className="space-y-2">
      <h3 className="font-medium">Pedidos</h3>
      {pedidos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p> : <ul className="divide-y rounded-xl border">
        {pedidos.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span>{p.comprador_nome} · {p.status} · {new Date(p.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
          <span>{formatarMoeda(p.total_centavos)} (líquido {formatarMoeda(p.liquido_centavos)})</span>
        </li>)}
      </ul>}
      <p className="text-xs text-muted-foreground">Pagamento simulado nesta etapa: nenhum dinheiro é movimentado. Gateway, repasse e tributos dependem de contrato.</p>
    </div>}
    {gerirCatalogo && divergencias.length > 0 && <div className="space-y-2">
      <h3 className="font-medium">Divergências para revisar</h3>
      <ul className="divide-y rounded-xl border" aria-label="Divergências">{divergencias.map(d => <li key={d.id} className="p-3 text-sm">{d.resultado.replace(/_/g, ' ')} · {d.tipo} · {formatarMoeda(d.valor_centavos)}{d.detalhe ? ` — ${d.detalhe}` : ''}</li>)}</ul>
    </div>}
  </section>
}
