'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { finalizarCompraStore } from '@/lib/actions/store'
import { formatarMoeda } from '@/lib/store/formato'
import type { StoreCatalogoItem } from '@/types/database'

const ROTULO: Record<string, string> = { colecao_digital: 'Coleção digital', foto_avulsa: 'Foto avulsa (por foto)', impressao: 'Impressão', servico: 'Serviço' }

export function LojaPortal({ link, catalogo, favoritas }: { link: string; catalogo: StoreCatalogoItem[]; favoritas: string[] }) {
  const router = useRouter()
  const [escolhidos, setEscolhidos] = useState<Record<string, number>>({})
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  // Uma chave por tentativa: retry não duplica; sucesso ou recusa começam outra compra.
  const chave = useRef<string>('')
  const digital = (t: string) => t === 'colecao_digital' || t === 'foto_avulsa'
  // Estimativa só para mostrar: o valor valido é o do servidor, calculado pelo catálogo.
  const estimativa = catalogo.reduce((soma, p) => {
    const q = escolhidos[p.id]
    if (!q) return soma
    const unidades = p.tipo === 'foto_avulsa' ? favoritas.length : p.tipo === 'colecao_digital' ? 1 : q
    return soma + p.preco_centavos * unidades
  }, 0)
  const itens = catalogo.filter(p => escolhidos[p.id])
  const precisaFavoritas = itens.some(p => digital(p.tipo)) && favoritas.length === 0
  return <section className="space-y-4" aria-label="Loja">
    <p className="text-sm text-muted-foreground">Fotos digitais usam as suas favoritas ({favoritas.length}). O pagamento desta etapa é uma simulação: nenhuma cobrança real é feita.</p>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {catalogo.length === 0 ? <p>O estúdio ainda não ofereceu produtos nesta galeria.</p> : <ul className="grid gap-3 sm:grid-cols-2">
      {catalogo.map(p => <li key={p.id} className="flex flex-col gap-2 rounded-xl border p-4">
        <p className="font-medium">{p.nome}</p>
        <p className="text-xs text-muted-foreground">{ROTULO[p.tipo] ?? p.tipo}{p.descricao ? ` · ${p.descricao}` : ''}</p>
        <p className="text-sm">{formatarMoeda(p.preco_centavos)}</p>
        {digital(p.tipo)
          ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(escolhidos[p.id])} onChange={e => setEscolhidos(s => ({ ...s, [p.id]: e.target.checked ? 1 : 0 }))} /> Adicionar</label>
          : <label className="grid gap-1 text-sm">Quantidade
              <input type="number" min={0} max={99} value={escolhidos[p.id] ?? 0} onChange={e => setEscolhidos(s => ({ ...s, [p.id]: Math.max(0, Math.min(99, Number(e.target.value) || 0)) }))} className="min-h-11 rounded-lg border px-3" />
            </label>}
      </li>)}
    </ul>}
    {itens.length > 0 && <form className="grid gap-3 rounded-xl border p-4" onSubmit={e => {
      e.preventDefault(); setErro('')
      if (precisaFavoritas) { setErro('Marque ao menos uma foto favorita na galeria antes de comprar fotos digitais.'); return }
      chave.current ||= crypto.randomUUID()
      iniciar(async () => {
        const r = await finalizarCompraStore(link, { chave: chave.current, nome, email, itens: itens.map(p => ({ produtoId: p.id, ...(digital(p.tipo) ? { fotoIds: favoritas } : { quantidade: escolhidos[p.id] }) })) })
        if (!r.ok) { setErro(r.erro); return }
        chave.current = ''
        router.push(r.entrega)
      })
    }}>
      <p className="text-sm">Total estimado: <strong>{formatarMoeda(estimativa)}</strong> <span className="text-muted-foreground">(o valor final é confirmado pelo servidor)</span></p>
      <label className="grid gap-1 text-sm">Seu nome<input required minLength={2} maxLength={120} value={nome} onChange={e => setNome(e.target.value)} className="min-h-11 rounded-lg border px-3" autoComplete="name" /></label>
      <label className="grid gap-1 text-sm">Seu e-mail<input required type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="min-h-11 rounded-lg border px-3" autoComplete="email" /></label>
      <button type="submit" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">{pendente ? 'Processando…' : 'Finalizar compra (simulada)'}</button>
    </form>}
  </section>
}
