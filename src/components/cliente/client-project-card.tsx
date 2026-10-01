import Link from 'next/link'
import { ClientStageBadge } from '@/components/cliente/client-stage-badge'
import { clientProgressPercent, clientStageOf, type Project } from '@/types/platform'
import { formatDate } from '@/lib/utils'

export function ClientProjectCard({ project }: { project: Project }) {
  const cover = project.photos.find((p) => p.capa) ?? project.photos[0]
  const stage = clientStageOf(project.status)
  const percent = clientProgressPercent(project.status)
  // A capa/card leva direto para a ação da etapa: prova liberada → a prova;
  // faltando fotos → a aba de fotos; senão, o acompanhamento do projeto.
  const href =
    stage === 'prova_liberada'
      ? `/cliente/projetos/${project.id}/prova`
      : stage === 'aguardando_fotos'
        ? `/cliente/projetos/${project.id}?aba=fotos`
        : `/cliente/projetos/${project.id}`

  return (
    <Link
      href={href}
      className="flex gap-4 rounded-2xl border border-[#EAEAEA] bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria.
          <img src={cover.url} alt={project.nome} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <p className="line-clamp-2 break-words font-semibold text-[#171717]">{project.nome}</p>
          <p className="mt-0.5 text-xs text-[#595959]">
            {project.dataEvento ? formatDate(project.dataEvento) : 'Data a definir'}
          </p>
          <ClientStageBadge stage={stage} className="mt-2" />
        </div>
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EAEAEA]">
            <div className="h-full rounded-full bg-[#171717] transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-[#6B6B6B]">{percent}% concluído</p>
        </div>
      </div>
    </Link>
  )
}
