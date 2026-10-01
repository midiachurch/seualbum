import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getClients, getPhotographers, requirePlatformAccess } from '@/lib/supabase/queries'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Perfil do fotógrafo' }

export default async function FotografoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAccess('fotografos')
  const { id } = await params
  const [photographers, clients] = await Promise.all([getPhotographers(), getClients()])
  const photographer = photographers.find((p) => p.id === id)
  if (!photographer) notFound()

  const clientes = clients.filter((c) => c.fotografoResponsavelId === photographer.id)

  const indicadores = [
    { label: 'Total de projetos', valor: photographer.projetosCount },
    { label: 'Projetos ativos', valor: photographer.projetosAtivos },
    { label: 'Total de clientes', valor: photographer.clientesCount },
    { label: 'Último acesso', valor: formatDate(photographer.ultimoAcessoEm) },
  ]

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/admin/fotografos">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para fotógrafos
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{photographer.estudio}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {photographer.nome} · Parceiro desde {formatDate(photographer.createdAt)}
          </p>
        </div>
        <span
          className={
            photographer.status === 'ativo'
              ? 'inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800'
              : 'inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground'
          }
        >
          {photographer.status === 'ativo' ? 'Ativo' : 'Inativo'}
        </span>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((item) => (
          <div key={item.label} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{item.valor}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-medium tracking-tight">Dados de contato</h2>
        <dl className="mt-4 grid gap-6 rounded-2xl border bg-card p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</dt>
            <dd className="mt-1 text-sm">{photographer.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</dt>
            <dd className="mt-1 text-sm">{photographer.telefone}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cidade</dt>
            <dd className="mt-1 text-sm">{photographer.cidade}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Plano</dt>
            <dd className="mt-1 text-sm">{photographer.plano ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-lg font-medium tracking-tight">Clientes vinculados</h2>
        {clientes.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Nenhum cliente vinculado ainda" />
          </div>
        ) : (
          <ul className="mt-4 divide-y rounded-2xl border">
            {clientes.map((client) => (
              <li key={client.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <Link href={`/admin/clientes/${client.id}`} className="font-medium underline underline-offset-2">
                  {client.nome}
                </Link>
                <span className="text-muted-foreground">{client.projetosCount} projeto(s)</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
