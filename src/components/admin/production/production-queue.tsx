'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AssignmentControl } from '@/components/admin/projects/assignment-control'
import { SlaBadge } from '@/components/admin/production/sla-badge'
import { assignProjeto, updateProjetoStatus } from '@/lib/actions/projetos'
import { cn, formatDate } from '@/lib/utils'
import { EXECUTORES_ROLES, PROJECT_STATUS_LABEL, type Client, type Photographer, type Project, type ProjectStatus, type TeamMember } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

const QUEUE_COLUMNS: { status: ProjectStatus; label: string }[] = [
  { status: 'pronto_para_diagramacao', label: 'Aguardando designer' },
  { status: 'em_diagramacao', label: 'Em diagramação' },
  { status: 'em_revisao_interna', label: 'Revisão interna' },
]

const NEXT_STATUS: Partial<Record<ProjectStatus, ProjectStatus>> = {
  pronto_para_diagramacao: 'em_diagramacao',
}

/**
 * Fila de trabalho focada só nas 3 etapas produtivas (seção 17) — não é o
 * Kanban completo dos 13 status, que já existe em /admin/projetos.
 */
export function ProductionQueue({
  projects: initialProjects,
  clients,
  photographers,
  teamMembers,
  currentTeamMemberId,
  canAssign,
  canEdit,
}: {
  projects: Project[]
  clients: Client[]
  photographers: Photographer[]
  teamMembers: TeamMember[]
  currentTeamMemberId: string | null
  canAssign: boolean
  canEdit: boolean
}) {
  const [projects, setProjects] = useState(initialProjects)
  const operadores = teamMembers.filter((m) => EXECUTORES_ROLES.includes(m.role))

  const clientName = (id: string) => clients.find((c) => c.id === id)?.nome ?? '—'
  const photographerName = (id: string) => photographers.find((p) => p.id === id)?.estudio ?? '—'

  function assign(projectId: string, responsavelId: string | null) {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, responsavelId } : p)))
    if (!DEMO_MODE) {
      const nome = teamMembers.find((m) => m.id === responsavelId)?.nome ?? null
      assignProjeto(projectId, responsavelId, nome).catch(() => {})
    }
  }

  function advance(projectId: string) {
    let novoStatus: ProjectStatus | null = null
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p
        const next = NEXT_STATUS[p.status]
        if (next) novoStatus = next
        return next ? { ...p, status: next } : p
      }),
    )
    if (!DEMO_MODE && novoStatus) {
      updateProjetoStatus(projectId, novoStatus, PROJECT_STATUS_LABEL[novoStatus]).catch(() => {})
    }
  }

  const queueProjects = projects.filter((p) => QUEUE_COLUMNS.some((c) => c.status === p.status))

  if (queueProjects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-16 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">Fila de trabalho vazia</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Nenhum projeto aguardando designer, em diagramação ou em revisão interna no momento.
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {QUEUE_COLUMNS.map((column) => {
        const items = queueProjects.filter((p) => p.status === column.status)
        return (
          <div key={column.status} className="w-80 shrink-0 space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{column.label}</p>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-3">
              {items.map((project) => {
                const isMine = Boolean(currentTeamMemberId) && project.responsavelId === currentTeamMemberId
                return (
                  <div
                    key={project.id}
                    className={cn('space-y-2 rounded-xl border bg-card p-3', isMine && 'ring-2 ring-foreground')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/admin/projetos/${project.id}`} className="font-medium hover:underline">
                        {project.nome}
                      </Link>
                      {isMine ? (
                        <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                          Você
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {clientName(project.clientId)} · {photographerName(project.fotografoId)}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Prazo: {formatDate(project.dataLimiteProducao)}</p>
                      <SlaBadge project={project} />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <AssignmentControl
                        value={project.responsavelId}
                        onChange={(id) => assign(project.id, id)}
                        teamMembers={operadores}
                        canAssign={canAssign}
                      />
                      {canEdit && column.status === 'em_revisao_interna' ? (
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                          <Link href={`/admin/projetos/${project.id}`}>Abrir revisão</Link>
                        </Button>
                      ) : canEdit && NEXT_STATUS[column.status] ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => advance(project.id)}
                        >
                          Avançar
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Vazio</p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
