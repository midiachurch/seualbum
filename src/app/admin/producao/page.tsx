import Link from 'next/link'
import type { Metadata } from 'next'
import { AlertTriangle, Clock } from 'lucide-react'
import { ProductionQueue } from '@/components/admin/production/production-queue'
import { SlaBadge } from '@/components/admin/production/sla-badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  getClients,
  getCurrentTeamMember,
  getPhotographers,
  getPlatformRole,
  getProjects,
  getTeamMembers,
  requirePlatformAccess,
} from '@/lib/supabase/queries'
import { getSlaInfo } from '@/lib/sla'
import { hasPermission } from '@/types/platform'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Produção' }

const EM_ANDAMENTO_EXCLUI = ['finalizado', 'arquivado', 'aprovado', 'aprovado_aguardando_pagamento']

export default async function ProducaoPage() {
  await requirePlatformAccess('projetos')
  const role = await getPlatformRole()
  const currentMember = await getCurrentTeamMember()
  const canAssign = !role || hasPermission(role, 'projetos', 'atribuir')
  const canEdit = !role || hasPermission(role, 'projetos', 'editar')
  const [projects, clients, photographers, teamMembers] = await Promise.all([
    getProjects(),
    getClients(),
    getPhotographers(),
    getTeamMembers(),
  ])

  const aguardandoAtribuicao = projects.filter((p) => p.responsavelId === null)
  const meusTrabalhos = currentMember
    ? projects.filter((p) => p.responsavelId === currentMember.id && !EM_ANDAMENTO_EXCLUI.includes(p.status))
    : []
  const aguardandoRevisaoInterna = projects.filter((p) => p.status === 'em_revisao_interna')

  // Painel de SLA (seção "Gestão de SLA"): mesma lógica de `getSlaInfo` usada
  // nas tags do Kanban — um único cálculo, sem duplicar regra de prazo.
  const comSla = projects
    .map((p) => ({ project: p, sla: getSlaInfo(p) }))
    .filter((x): x is { project: (typeof projects)[number]; sla: NonNullable<ReturnType<typeof getSlaInfo>> } => x.sla !== null)

  const estourados = comSla.filter((x) => x.sla.tone === 'atrasado').sort((a, b) => a.sla.horasRestantes - b.sla.horasRestantes)
  const vencendo48h = comSla.filter((x) => x.sla.tone === 'atencao').sort((a, b) => a.sla.horasRestantes - b.sla.horasRestantes)

  const cards = [
    { label: 'Aguardando atribuição', valor: aguardandoAtribuicao.length },
    { label: 'Meus trabalhos em andamento', valor: meusTrabalhos.length },
    { label: 'SLA estourado', valor: estourados.length, destaque: estourados.length > 0 },
    { label: 'Vencendo em 48h', valor: vencendo48h.length },
    { label: 'Aguardando revisão interna', valor: aguardandoRevisaoInterna.length },
  ]

  const clientName = (id: string) => clients.find((c) => c.id === id)?.nome ?? '—'

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Produção</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A sala de máquinas — o que a equipe precisa fazer hoje.
          {currentMember ? ` Você está entrando como ${currentMember.nome}.` : ''}
        </p>
      </header>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`mt-1 text-3xl font-bold tracking-tight ${card.destaque ? 'text-destructive' : ''}`}>
              {card.valor}
            </p>
          </div>
        ))}
      </section>

      <section aria-label="Painel de SLA">
        <h2 className="text-lg font-medium tracking-tight">Painel de SLA</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              SLA estourado ({estourados.length})
            </p>
            {estourados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum projeto atrasado agora. 🎉</p>
            ) : (
              <ul className="space-y-1.5">
                {estourados.map(({ project, sla }) => (
                  <li key={project.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm">
                    <Link href={`/admin/projetos/${project.id}`} className="font-medium hover:underline">
                      {project.nome}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {clientName(project.clientId)}
                      <SlaBadge project={project} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Clock className="h-4 w-4" aria-hidden />
              Vencendo em 48h ({vencendo48h.length})
            </p>
            {vencendo48h.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada vencendo nas próximas 48h.</p>
            ) : (
              <ul className="space-y-1.5">
                {vencendo48h.map(({ project }) => (
                  <li key={project.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm">
                    <Link href={`/admin/projetos/${project.id}`} className="font-medium hover:underline">
                      {project.nome}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {clientName(project.clientId)}
                      <SlaBadge project={project} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {currentMember ? (
        <section aria-label="Meus trabalhos">
          <h2 className="text-lg font-medium tracking-tight">Meus trabalhos</h2>
          {meusTrabalhos.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Nenhum projeto atribuído a você no momento" />
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {meusTrabalhos.map((project) => (
                <li key={project.id} className="space-y-1.5 rounded-xl border bg-card p-4">
                  <Link href={`/admin/projetos/${project.id}`} className="font-medium hover:underline">
                    {project.nome}
                  </Link>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Prazo: {formatDate(project.dataLimiteProducao)}</span>
                    <SlaBadge project={project} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section aria-label="Fila de trabalho">
        <h2 className="mb-4 text-lg font-medium tracking-tight">Fila de trabalho</h2>
        <ProductionQueue
          projects={projects}
          clients={clients}
          photographers={photographers}
          teamMembers={teamMembers}
          currentTeamMemberId={currentMember?.id ?? null}
          canAssign={canAssign}
          canEdit={canEdit}
        />
      </section>
    </div>
  )
}
