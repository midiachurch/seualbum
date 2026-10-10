'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { SimpleTabs } from '@/components/ui/simple-tabs'
import { ClientStageBadge } from '@/components/cliente/client-stage-badge'
import { ProjectTimeline } from '@/components/cliente/project-timeline'
import { ClientPhotosManager } from '@/components/cliente/client-photos-manager'
import { clientStageOf, type Photographer, type Project } from '@/types/platform'
import { formatDate } from '@/lib/utils'

const ALBUM_TYPE_LABEL: Record<string, string> = {
  fotolivro: 'Fotolivro',
  tradicional: 'Álbum tradicional',
  premium: 'Álbum premium',
  casamento: 'Álbum de casamento',
  aniversario: 'Álbum de aniversário',
  formatura: 'Álbum de formatura',
  corporativo: 'Álbum corporativo',
}

const COVER_LABEL: Record<string, string> = {
  fotografica: 'Fotográfica',
  tecido: 'Tecido',
  couro: 'Couro',
  acrilico: 'Acrílico',
  personalizada: 'Personalizada',
}

const ORIENTATION_LABEL: Record<string, string> = {
  quadrado: 'Quadrado',
  horizontal: 'Horizontal',
  vertical: 'Vertical',
}

export function ProjectHub({
  project,
  photographer,
  initialTab,
  painelAprovacao,
  painelMensagens,
}: {
  project: Project
  photographer: Photographer | undefined
  initialTab: string
  /** Aba "Aprovação": painel de aprovação da prova (versões, checklist, apontamentos). */
  painelAprovacao?: React.ReactNode
  /** Aba "Mensagens" (0037): o fio com o estúdio, montado pela página. */
  painelMensagens?: React.ReactNode
}) {
  const stage = clientStageOf(project.status)

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-[#171717]">{project.nome}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ClientStageBadge stage={stage} />
          <span className="text-xs text-[#6B6B6B]">
            {project.dataEvento ? `Evento em ${formatDate(project.dataEvento)}` : 'Data a definir'}
          </span>
        </div>
        {photographer ? <p className="text-xs text-[#6B6B6B]">Fotógrafo: {photographer.estudio}</p> : null}
      </header>

      {stage === 'prova_liberada' ? (
        <Link
          href={`/cliente/projetos/${project.id}/prova`}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#171717] px-4 py-4 text-sm font-semibold text-white shadow-sm"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Ver e aprovar minha prova digital
        </Link>
      ) : null}

      <SimpleTabs
        defaultValue={initialTab}
        tabs={[
          ...(painelAprovacao ? [{ value: 'aprovacao', label: 'Aprovação', content: painelAprovacao }] : []),
          {
            value: 'visao-geral',
            label: 'Visão geral',
            content: <ProjectTimeline currentStage={stage} />,
          },
          {
            value: 'fotos',
            label: `Fotos (${project.photos.length})`,
            content: <ClientPhotosManager projetoId={project.id} initialPhotos={project.photos} />,
          },
          {
            value: 'detalhes',
            label: 'Detalhes',
            content: (
              <dl className="divide-y divide-[#EAEAEA] rounded-2xl border border-[#EAEAEA] bg-white">
                {[
                  ['Tipo de álbum', ALBUM_TYPE_LABEL[project.album.tipo] ?? project.album.tipo],
                  ['Formato', project.album.formato],
                  ['Orientação', ORIENTATION_LABEL[project.album.orientacao] ?? project.album.orientacao],
                  ['Capa', COVER_LABEL[project.album.capa] ?? project.album.capa],
                  ['Páginas', String(project.album.quantidadePaginas)],
                  ['Estilo desejado', project.briefing.estiloDesejado],
                  ['Local do evento', project.briefing.local],
                  ['Quantidade de pessoas', project.briefing.quantidadePessoas],
                  ['Fotos prioritárias', project.briefing.fotosPrioritarias],
                  ['Observações gerais', project.briefing.observacoesGerais],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-[#6B6B6B]">{label}</dt>
                    <dd className="text-right font-medium text-[#171717]">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            ),
          },
          ...(painelMensagens ? [{ value: 'mensagens', label: 'Mensagens', content: painelMensagens }] : []),
        ]}
      />
    </div>
  )
}
