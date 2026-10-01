'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SimpleTabs } from '@/components/ui/simple-tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { ProjectStatusBadge } from '@/components/admin/projects/project-status-badge'
import { AssignmentControl } from '@/components/admin/projects/assignment-control'
import { DesignVersionsPanel } from '@/components/admin/projects/design-versions-panel'
import { CommunicationHistory } from '@/components/admin/projects/communication-history'
import { FotosPorCena } from '@/components/admin/projects/fotos-por-cena'
import { SlaBadge } from '@/components/admin/production/sla-badge'
import { assignProjeto, createSmartLayoutVersion, reviewDesignVersion, updateProjetoStatus } from '@/lib/actions/projetos'
import { generateSmartLayout } from '@/lib/smart-layout'
import {
  EXECUTORES_ROLES,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_ORDER,
  type Client,
  type ComunicacaoLogEntry,
  type DesignVersion,
  type Photographer,
  type Project,
  type ProjectStatus,
  type TeamMember,
} from '@/types/platform'
import { formatDate } from '@/lib/utils'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Estado do projeto vive aqui, num único componente — o header (status,
 * atribuição) e a aba de Diagramação (versões, revisão interna) precisam
 * refletir as mudanças um do outro (enviar versão muda o status; aprovar
 * internamente também), então não dá pra cada um ter seu próprio useState
 * isolado como na Fase 2.
 */
export function ProjectWorkspace({
  project: initialProject,
  client,
  photographer,
  teamMembers,
  communicationLog,
  canEdit,
  canAssign,
  canApproveInternal,
  modoDesigner = false,
}: {
  project: Project
  client: Client | undefined
  photographer: Photographer | undefined
  teamMembers: TeamMember[]
  communicationLog: ComunicacaoLogEntry[]
  canEdit: boolean
  canAssign: boolean
  canApproveInternal: boolean
  /** Designer: sem troca manual de status, sem links de cliente/fotógrafo, sem e-mails. */
  modoDesigner?: boolean
}) {
  const [project, setProject] = useState(initialProject)
  const [erroStatus, setErroStatus] = useState<string | null>(null)
  // `router.refresh()` (nova versão, cortesia, pagamento) traz o projeto do
  // servidor de novo: a tela passa a refletir o banco, não o estado antigo.
  useEffect(() => setProject(initialProject), [initialProject])
  const router = useRouter()
  const operadores = teamMembers.filter((m) => EXECUTORES_ROLES.includes(m.role))

  function logActivity(mensagem: string) {
    return { id: `act-${Date.now()}-${Math.random().toString(36).slice(2)}`, mensagem, data: new Date().toISOString() }
  }

  function updateStatus(status: ProjectStatus) {
    const label = PROJECT_STATUS_LABEL[status]
    const anterior = project.status
    setErroStatus(null)
    setProject((p) => ({ ...p, status, activity: [logActivity(`Status alterado para "${label}".`), ...p.activity] }))
    // O banco recusa atalhos (ex.: pular a cobrança de lâminas extras, ou quem
    // não é gestão marcar "Aprovado para impressão") — a tela volta atrás.
    if (!DEMO_MODE) {
      updateProjetoStatus(project.id, status, label).catch(() => {
        setProject((p) => ({ ...p, status: anterior, activity: p.activity.slice(1) }))
        setErroStatus(
          status === 'aprovado'
            ? 'Só a gestão marca "Aprovado para impressão" — e só sem cobrança de lâminas em aberto.'
            : 'Não foi possível mudar o status agora.',
        )
      })
    }
  }

  function assign(id: string | null) {
    const nome = teamMembers.find((m) => m.id === id)?.nome
    setProject((p) => ({
      ...p,
      responsavelId: id,
      activity: [logActivity(id ? `Atribuído a ${nome}.` : 'Atribuição removida.'), ...p.activity],
    }))
    if (!DEMO_MODE) assignProjeto(project.id, id, nome ?? null).catch(() => {})
  }

  // A versão já foi criada no servidor pelo upload de lâminas
  // (`criarVersaoComLaminas`); aqui só reflete na tela e recarrega os dados
  // (links assinados das lâminas vêm do servidor).
  function versaoCriada(v: { versaoId: string; numero: number; laminas: number; comentarios: string | null }) {
    const versao: DesignVersion = {
      id: v.versaoId,
      numero: v.numero,
      data: new Date().toISOString(),
      responsavelId: '',
      arquivo: '',
      comentarios: v.comentarios,
      status: 'enviada',
      laminas: Array.from({ length: v.laminas }, (_, i) => ({ id: `${v.versaoId}-${i}`, ordem: i + 1, url: '', largura: null, altura: null })),
    }
    setProject((p) => ({
      ...p,
      designVersions: [...p.designVersions, versao],
      status: 'em_revisao_interna',
      activity: [logActivity(`Nova versão com ${v.laminas} lâminas enviada para revisão interna (v${v.numero}).`), ...p.activity],
    }))
    router.refresh()
  }

  function reviewVersion(versionId: string, decision: 'aprovada' | 'rejeitada', comentario?: string) {
    setProject((p) => ({
      ...p,
      designVersions: p.designVersions.map((v) => (v.id === versionId ? { ...v, status: decision } : v)),
      status: decision === 'aprovada' ? 'aguardando_aprovacao_cliente' : 'em_ajustes',
      activity: [
        logActivity(
          decision === 'aprovada'
            ? 'Diagramação aprovada internamente — pronta para seguir ao cliente.'
            : `Ajustes solicitados na revisão interna.${comentario ? ` "${comentario}"` : ''}`,
        ),
        ...p.activity,
      ],
    }))
    if (!DEMO_MODE) reviewDesignVersion(project.id, versionId, decision, comentario).catch(() => {})
  }

  async function smartLayout() {
    if (DEMO_MODE) {
      const layout = generateSmartLayout(project.photos, project.album.quantidadePaginas)
      const novaVersao: DesignVersion = {
        id: `v-smart-${Date.now()}`,
        numero: project.designVersions.length + 1,
        data: new Date().toISOString(),
        responsavelId: teamMembers[0]?.id ?? '',
        arquivo: '',
        comentarios: 'Esboço gerado automaticamente pelo Smart Layout.',
        status: 'enviada',
        quantidadePaginas: layout.length,
        layoutJson: layout,
        automatico: true,
      }
      setProject((p) => ({
        ...p,
        designVersions: [...p.designVersions, novaVersao],
        status: 'em_revisao_interna',
        activity: [logActivity(`Smart Layout gerou automaticamente a versão ${novaVersao.numero} (${layout.length} páginas).`), ...p.activity],
      }))
      return
    }

    try {
      const novaVersao = await createSmartLayoutVersion(project.id)
      setProject((p) => ({
        ...p,
        designVersions: [...p.designVersions, novaVersao],
        status: 'em_revisao_interna',
        activity: [logActivity(`Smart Layout gerou automaticamente a versão ${novaVersao.numero} (${novaVersao.quantidadePaginas} páginas).`), ...p.activity],
      }))
    } catch (e) {
      console.error('[smartLayout]', e)
    }
  }

  const timeline = [
    ...project.activity.map((a) => ({ id: a.id, data: a.data, mensagem: a.mensagem })),
    ...project.approvals.map((a) => ({
      id: a.id,
      data: a.data,
      mensagem:
        a.status === 'aprovado'
          ? `${a.usuario} aprovou a versão ${a.versao}.${a.comentario ? ` "${a.comentario}"` : ''}`
          : `${a.usuario} solicitou alteração na versão ${a.versao}.${a.comentario ? ` "${a.comentario}"` : ''}`,
    })),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">#{project.numero}</p>
            <h1 className="text-2xl font-bold tracking-tight">{project.nome}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <SlaBadge project={project} />
            {canEdit && !modoDesigner ? (
              <select
                value={project.status}
                onChange={(e) => updateStatus(e.target.value as ProjectStatus)}
                // Com lâminas extras a pagar, só o pagamento ou a cortesia liberam.
                disabled={project.status === 'aprovado_aguardando_pagamento'}
                title={project.status === 'aprovado_aguardando_pagamento' ? 'Libere pelo pagamento do estúdio ou pela cortesia' : undefined}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs disabled:opacity-60"
                aria-label="Alterar status do projeto"
              >
                {PROJECT_STATUS_ORDER.filter(
                  (s) => s !== 'aprovado_aguardando_pagamento' || project.status === 'aprovado_aguardando_pagamento',
                ).map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        {erroStatus ? (
          <p role="alert" className="text-sm text-destructive">
            {erroStatus}
          </p>
        ) : null}
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</dt>
            <dd className="mt-1">
              {client && !modoDesigner ? (
                <Link href={`/admin/clientes/${client.id}`} className="underline underline-offset-2">
                  {client.nome}
                </Link>
              ) : (
                client?.nome ?? '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Fotógrafo</dt>
            <dd className="mt-1">
              {photographer && !modoDesigner ? (
                <Link href={`/admin/fotografos/${photographer.id}`} className="underline underline-offset-2">
                  {photographer.estudio}
                </Link>
              ) : (
                photographer?.estudio ?? '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Responsável</dt>
            <dd className="mt-1">
              <AssignmentControl value={project.responsavelId} onChange={assign} teamMembers={operadores} canAssign={canAssign} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {project.status === 'aguardando_aprovacao_cliente' && project.dataLimiteAprovacao ? 'Prazo do cliente' : 'Prazo de produção'}
            </dt>
            <dd className="mt-1">
              {formatDate(
                project.status === 'aguardando_aprovacao_cliente' && project.dataLimiteAprovacao
                  ? project.dataLimiteAprovacao
                  : project.dataLimiteProducao,
              )}
            </dd>
          </div>
        </dl>
      </header>

      <SimpleTabs
        tabs={[
          {
            value: 'visao-geral',
            label: 'Visão geral',
            content: (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Tipo de álbum', valor: project.album.tipo },
                    { label: 'Formato', valor: project.album.formato },
                    { label: 'Orientação', valor: project.album.orientacao },
                    { label: 'Capa', valor: project.album.capa },
                    { label: 'Páginas', valor: String(project.album.quantidadePaginas) },
                    { label: 'Fotografias', valor: String(project.photos.length) },
                    { label: 'Versões enviadas', valor: String(project.designVersions.length) },
                    { label: 'Criado em', valor: formatDate(project.createdAt) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border bg-card p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className="mt-1 font-medium capitalize">{item.valor}</p>
                    </div>
                  ))}
                </div>
                {project.album.observacoes ? (
                  <p className="rounded-2xl border bg-card p-4 text-sm">
                    <span className="font-medium">Observações do produto: </span>
                    {project.album.observacoes}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            value: 'briefing',
            label: 'Briefing',
            content: (
              <dl className="grid gap-6 sm:grid-cols-2">
                {[
                  ['Estilo desejado', project.briefing.estiloDesejado],
                  ['Local', project.briefing.local],
                  ['Quantidade de pessoas', project.briefing.quantidadePessoas],
                  ['Preferências de diagramação', project.briefing.preferenciasDiagramacao],
                  ['Fotos prioritárias', project.briefing.fotosPrioritarias],
                  ['Pessoas que precisam aparecer', project.briefing.pessoasQueDevemAparecer],
                  ['Momentos importantes', project.briefing.momentosImportantes],
                  ['Referências', project.briefing.referencias],
                  ['Orientação para a diagramação', project.briefing.orientacaoDiagramacao],
                  ['Observações gerais', project.briefing.observacoesGerais],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            ),
          },
          {
            value: 'fotografias',
            label: `Fotografias (${project.photos.length})`,
            // Com EXIF, agrupadas por cena e momento (Smart Layout local, 0025).
            content: <FotosPorCena photos={project.photos} />,
          },
          {
            value: 'diagramacao',
            label: 'Diagramação',
            content: (
              <DesignVersionsPanel
                versions={project.designVersions}
                photos={project.photos}
                projectStatus={project.status}
                teamMembers={teamMembers}
                canEdit={canEdit}
                canApproveInternal={canApproveInternal}
                projetoId={project.id}
                onVersaoCriada={versaoCriada}
                onReview={reviewVersion}
                onSmartLayout={smartLayout}
              />
            ),
          },
          {
            value: 'historico',
            label: 'Histórico / Aprovação',
            content:
              timeline.length === 0 ? (
                <EmptyState title="Nenhuma atividade registrada ainda" />
              ) : (
                <ol className="space-y-4 border-l pl-4">
                  {timeline.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-foreground" />
                      <p className="text-sm text-foreground">{entry.mensagem}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.data)}</p>
                    </li>
                  ))}
                </ol>
              ),
          },
          ...(modoDesigner
            ? []
            : [
                {
                  value: 'comunicacao',
                  label: `Histórico de Comunicação (${communicationLog.length})`,
                  content: <CommunicationHistory entries={communicationLog} />,
                },
              ]),
        ]}
      />
    </div>
  )
}
