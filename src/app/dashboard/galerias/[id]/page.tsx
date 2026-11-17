import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Images, ListChecks, Link2 } from 'lucide-react'
import { getProject, requireUser } from '@/lib/supabase/queries'
import { ClientPhotosManager } from '@/components/cliente/client-photos-manager'
import { SelectionDeliveryPanel } from '@/components/cliente/selecao-entregue/selection-delivery-panel'
import { PortalShare } from '@/components/portal/portal-share'
export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const { user, profile } = await requireUser()
  const { id } = await params,
    { aba } = await searchParams
  const project = await getProject(id)
  if (!project || profile?.role !== 'fotografo' || project.fotografoId !== user.id) notFound()
  const active = aba === 'selecoes' || aba === 'compartilhar' ? aba : 'fotos'
  const tabs = [
    { id: 'fotos', label: 'Fotos', icon: Images },
    { id: 'selecoes', label: 'Seleções', icon: ListChecks },
    { id: 'compartilhar', label: 'Compartilhar', icon: Link2 },
  ]
  return (
    <div className="space-y-7">
      <Link
        href="/dashboard/galerias"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600"
      >
        <ArrowLeft size={16} />
        Todas as galerias
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Galeria digital</p>
        <h1 className="mt-2 break-words text-3xl font-semibold sm:text-4xl">{project.nome}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Adicione as fotos, compartilhe o acesso e acompanhe as escolhas.
        </p>
      </header>
      <nav aria-label="Áreas da galeria" className="flex gap-1 border-b">
        {tabs.map(({ id: tab, label, icon: Icon }) => (
          <Link
            key={tab}
            href={`/dashboard/galerias/${id}?aba=${tab}`}
            aria-current={active === tab ? 'page' : undefined}
            className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-medium sm:px-5 ${active === tab ? 'border-primary text-primary' : 'border-transparent text-slate-600'}`}
          >
            <Icon size={17} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      {active === 'fotos' ? (
        <section className="rounded-2xl border bg-white p-4 sm:p-7">
          <h2 className="mb-5 text-xl font-semibold">Fotos da galeria</h2>
          <ClientPhotosManager projetoId={id} initialPhotos={project.photos} />
        </section>
      ) : active === 'selecoes' ? (
        <SelectionDeliveryPanel projetoId={id} somenteRecebidas />
      ) : (
        <PortalShare projetoId={id} />
      )}
    </div>
  )
}
