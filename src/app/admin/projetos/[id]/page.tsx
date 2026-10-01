import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectWorkspace } from '@/components/admin/projects/project-workspace'
import { CobrancaLaminasCard } from '@/components/admin/projects/cobranca-laminas-card'
import {
  getClients,
  getComunicacoesLog,
  getFaturasDoProjeto,
  getResumoExcedente,
  getPhotographers,
  getPlatformRole,
  getProject,
  getTeamMembers,
  requirePlatformAccess,
} from '@/lib/supabase/queries'
import { hasPermission } from '@/types/platform'

export const metadata: Metadata = { title: 'Projeto' }

export default async function ProjetoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAccess(['projetos', 'design'])
  const role = await getPlatformRole()
  // Designer: produção pura (fotos, briefing, versões, pins) — sem status
  // manual, sem atribuição, sem dados do cliente nem caixa de e-mails.
  const modoDesigner = role === 'designer'
  const canEdit = !role || hasPermission(role, 'projetos', 'editar') || hasPermission(role, 'design', 'editar')
  const canAssign = !role || hasPermission(role, 'projetos', 'atribuir')
  const canApproveInternal = !role || hasPermission(role, 'projetos', 'aprovar')

  const { id } = await params
  const [project, clients, photographers, teamMembers] = await Promise.all([
    getProject(id),
    getClients(),
    getPhotographers(),
    getTeamMembers(),
  ])
  if (!project) notFound()
  // Cobrança é assunto comercial: o designer não vê (nem a RLS deixa — 0021/0023).
  const [communicationLog, faturas, resumo] = await Promise.all([
    getComunicacoesLog(id),
    modoDesigner ? Promise.resolve([]) : getFaturasDoProjeto(id),
    modoDesigner ? Promise.resolve(null) : getResumoExcedente(id),
  ])

  const client = clients.find((c) => c.id === project.clientId)
  const photographer = photographers.find((p) => p.id === project.fotografoId)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href={modoDesigner ? '/admin/design' : '/admin/projetos'}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {modoDesigner ? 'Voltar para a fila de design' : 'Voltar para projetos'}
        </Link>
      </Button>

      {modoDesigner ? null : (
        <CobrancaLaminasCard
          projetoId={project.id}
          status={project.status}
          laminasInclusas={project.laminasInclusas ?? null}
          precoLaminaExtra={project.precoLaminaExtra ?? null}
          resumo={resumo}
          faturas={faturas}
          podeDispensar={canApproveInternal}
        />
      )}

      <ProjectWorkspace
        project={project}
        client={client}
        photographer={photographer}
        teamMembers={teamMembers}
        communicationLog={communicationLog}
        canEdit={canEdit}
        canAssign={canAssign}
        canApproveInternal={canApproveInternal}
        modoDesigner={modoDesigner}
      />
    </div>
  )
}
