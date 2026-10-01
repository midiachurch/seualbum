'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, LayoutGrid, Kanban as KanbanIcon, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ProjectStatusBadge } from '@/components/admin/projects/project-status-badge'
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_ORDER,
  type Client,
  type Photographer,
  type Project,
  type ProjectStatus,
} from '@/types/platform'
import { SlaBadge } from '@/components/admin/production/sla-badge'
import { cn, formatDate } from '@/lib/utils'

/**
 * Listagem (cards, seção 2 — priorizar visual) + Kanban (seção 8) na mesma
 * tela, com filtros. "Avançar etapa" só existe se `canEdit`; sem drag&drop —
 * um clique já basta para mover a barra de status neste mock.
 */
export function ProjectsBoard({
  projects: initialProjects,
  clients,
  photographers,
  canEdit,
  canCreate,
}: {
  projects: Project[]
  clients: Client[]
  photographers: Photographer[]
  canEdit: boolean
  canCreate: boolean
}) {
  const [projects, setProjects] = useState(initialProjects)
  const [view, setView] = useState<'lista' | 'kanban'>('lista')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | ProjectStatus>('todos')
  const [clientFilter, setClientFilter] = useState('todos')

  const clientName = (id: string) => clients.find((c) => c.id === id)?.nome ?? '—'
  const photographerName = (id: string) => photographers.find((p) => p.id === id)?.estudio ?? '—'

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return projects.filter((p) => {
      const matchesSearch =
        !term || p.nome.toLowerCase().includes(term) || clientName(p.clientId).toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'todos' || p.status === statusFilter
      const matchesClient = clientFilter === 'todos' || p.clientId === clientFilter
      return matchesSearch && matchesStatus && matchesClient
      // eslint-disable-next-line react-hooks/exhaustive-deps -- clientName é pura, não precisa entrar nas deps
    })
  }, [projects, search, statusFilter, clientFilter])

  function advanceStatus(id: string) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const idx = PROJECT_STATUS_ORDER.indexOf(p.status)
        const next = PROJECT_STATUS_ORDER[Math.min(PROJECT_STATUS_ORDER.length - 1, idx + 1)]
        return { ...p, status: next }
      }),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'} no total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={view === 'lista' ? 'brand' : 'ghost'}
              onClick={() => setView('lista')}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              Lista
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'kanban' ? 'brand' : 'ghost'}
              onClick={() => setView('kanban')}
            >
              <KanbanIcon className="h-4 w-4" aria-hidden />
              Kanban
            </Button>
          </div>
          {canCreate ? (
            <Button asChild size="sm" variant="brand">
              <Link href="/admin/projetos/novo">
                <Plus className="h-4 w-4" aria-hidden />
                Novo projeto
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por projeto ou cliente…"
          className="max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="todos">Todos os status</option>
          {PROJECT_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {PROJECT_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="todos">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum projeto encontrado" description="Ajuste os filtros ou crie o primeiro projeto." />
      ) : view === 'lista' ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/admin/projetos/${project.id}`}
              className="group overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-secondary">
                {project.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria.
                  <img
                    src={project.photos[0].url}
                    alt={project.nome}
                    className="h-full w-full object-cover grayscale transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}
                <ProjectStatusBadge status={project.status} className="absolute left-3 top-3" />
              </div>
              <div className="p-4">
                <p className="font-medium">{project.nome}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {clientName(project.clientId)} · {photographerName(project.fotografoId)}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Prazo: {formatDate(project.dataLimiteProducao)}</p>
                  <SlaBadge project={project} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PROJECT_STATUS_ORDER.map((status) => {
            const items = filtered.filter((p) => p.status === status)
            return (
              <div key={status} className="w-72 shrink-0 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {PROJECT_STATUS_LABEL[status]}
                  </p>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((project) => (
                    <div key={project.id} className="rounded-xl border bg-card p-3">
                      <Link href={`/admin/projetos/${project.id}`} className="font-medium hover:underline">
                        {project.nome}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{clientName(project.clientId)}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Prazo: {formatDate(project.dataLimiteProducao)}</p>
                        <SlaBadge project={project} />
                      </div>
                      {canEdit && status !== 'finalizado' && status !== 'arquivado' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-7 px-2 text-xs"
                          onClick={() => advanceStatus(project.id)}
                        >
                          Avançar etapa
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {items.length === 0 ? (
                    <p className={cn('rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground')}>
                      Vazio
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
