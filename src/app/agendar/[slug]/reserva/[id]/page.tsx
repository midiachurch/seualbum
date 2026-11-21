import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReservaPublicaPainel } from '@/components/agendar/reserva-publica'
import { lerReservaPublica } from '@/lib/agenda/publico'
import { slugValido } from '@/lib/agenda/regras'
import { uuidValido } from '@/lib/portal/segredos'

export const metadata: Metadata = { title: 'Sua reserva', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

export default async function ReservaPublicaPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  if (!slugValido(slug) || !uuidValido(id)) notFound()
  const reserva = await lerReservaPublica(id)
  if (!reserva) {
    return (
      <main className="container mx-auto max-w-2xl space-y-4 px-4 py-10">
        <h1 className="text-2xl font-semibold">Reserva não encontrada</h1>
        <p className="text-sm text-muted-foreground">Abra este link no mesmo aparelho e navegador em que você reservou, ou escolha um novo horário.</p>
        <Link className="underline" href={`/agendar/${slug}`}>Escolher um horário</Link>
      </main>
    )
  }
  return (
    <main className="container mx-auto max-w-2xl space-y-6 px-4 py-10">
      <ReservaPublicaPainel slug={slug} reserva={reserva} />
    </main>
  )
}
