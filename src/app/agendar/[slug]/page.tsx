import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AgendarPublico } from '@/components/agendar/agendar-publico'
import { agruparSlotsPorDia, hojeNoFuso, somarDias } from '@/lib/agenda/formatacao'
import { lerRecursoPublico, lerSlotsPublicos } from '@/lib/agenda/publico'
import { dataIsoValida } from '@/lib/agenda/regras'

export const metadata: Metadata = { title: 'Agendar horário', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

const JANELA_DIAS = 14

export default async function AgendarPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ de?: string }> }) {
  const { slug } = await params
  const { de } = await searchParams
  const recurso = await lerRecursoPublico(slug)
  if (!recurso) notFound()
  const hoje = hojeNoFuso(recurso.fuso)
  const limite = somarDias(hoje, recurso.antecedencia_max_dias)
  // Janela pedida limitada ao intervalo reservável (nunca antes de hoje nem além do limite do recurso).
  const inicio = dataIsoValida(de) && de > hoje && de <= limite ? de : hoje
  const fim = somarDias(inicio, JANELA_DIAS - 1)
  const slots = await lerSlotsPublicos(recurso.slug, inicio, fim)
  const grupos = agruparSlotsPorDia(slots, recurso.fuso)
  const anterior = inicio > hoje ? (somarDias(inicio, -JANELA_DIAS) > hoje ? somarDias(inicio, -JANELA_DIAS) : hoje) : null
  const proxima = somarDias(inicio, JANELA_DIAS) <= limite ? somarDias(inicio, JANELA_DIAS) : null
  return (
    <main className="container mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{recurso.estudio}</p>
        <h1 className="text-3xl font-semibold">{recurso.nome}</h1>
        {recurso.descricao && <p className="text-sm text-muted-foreground">{recurso.descricao}</p>}
      </header>
      <AgendarPublico recurso={recurso} grupos={grupos} />
      <nav aria-label="Navegar pelas datas" className="flex items-center justify-between text-sm">
        {anterior ? <Link className="min-h-11 content-center underline" href={`/agendar/${recurso.slug}${anterior > hoje ? `?de=${anterior}` : ''}`}>Datas anteriores</Link> : <span />}
        {proxima ? <Link className="min-h-11 content-center underline" href={`/agendar/${recurso.slug}?de=${proxima}`}>Mais datas</Link> : <span />}
      </nav>
    </main>
  )
}
