import Link from 'next/link'
import { Plus } from 'lucide-react'

export function WorkspaceHeader({ titulo, descricao, acao }: { titulo: string; descricao: string; acao?: { nome: string; href: string } }) {
  return <header className="flex flex-wrap items-end justify-between gap-5">
    <div><p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Seu trabalho, em movimento</p><h1>{titulo}</h1><p className="mt-3 max-w-2xl text-sm text-muted-foreground">{descricao}</p></div>
    {acao && <Link href={acao.href} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#142526] px-5 py-3 text-sm font-medium text-white"><Plus size={16} />{acao.nome}</Link>}
  </header>
}

export function WorkspaceIndicadores({ itens }: { itens: { nome: string; valor: string | number; detalhe?: string }[] }) {
  return <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{itens.map(i => <div key={i.nome} className="flex min-h-32 flex-col justify-between rounded-2xl border p-5"><p className="text-sm text-muted-foreground">{i.nome}</p><strong className="mt-4 text-3xl font-normal tracking-tight">{i.valor}</strong>{i.detalhe && <span className="mt-2 text-xs text-muted-foreground">{i.detalhe}</span>}</div>)}</section>
}
