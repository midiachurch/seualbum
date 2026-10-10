import Link from 'next/link'
import { Clock, Truck } from 'lucide-react'
import {
  STATUS_PAINEL_COR,
  prazoDeResposta,
  progressoDoStatus,
  situacaoDoProjeto,
  versoesLiberadas,
} from '@/lib/prova/painel'
import type { Project } from '@/types/platform'
import { cn, formatDate } from '@/lib/utils'

/**
 * Card do álbum no painel do cliente: capa, status em linguagem de cliente
 * (aguardando aprovação, em ajustes, aprovado, em produção, entregue), prazo
 * para responder e rastreio quando houver.
 */
export function ClientProjectCard({ project, estudio }: { project: Project; estudio?: string | null }) {
  const cover = project.photos.find((p) => p.capa) ?? project.photos[0]
  const situacao = situacaoDoProjeto(project)
  const percent = progressoDoStatus(situacao.status)
  const prazo = situacao.status === 'aguardando_aprovacao' ? prazoDeResposta(project.dataLimiteAprovacao) : null
  const temProva = versoesLiberadas(project.designVersions).length > 0
  // A capa/card leva direto para a ação da etapa: prova esperando → a prova;
  // faltando fotos → a aba de fotos; com prova publicada → o painel de aprovação.
  const href =
    situacao.status === 'aguardando_aprovacao'
      ? `/cliente/projetos/${project.id}/prova`
      : situacao.status === 'aguardando_fotos'
        ? `/cliente/projetos/${project.id}?aba=fotos`
        : temProva
          ? `/cliente/projetos/${project.id}?aba=aprovacao`
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
            {estudio ? ` · ${estudio}` : ''}
          </p>
          <span className={cn('mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_PAINEL_COR[situacao.status])}>
            {situacao.label}
          </span>
          {prazo ? (
            <p className={cn('mt-1.5 flex items-center gap-1 text-[11px] font-medium', prazo.urgente ? 'text-amber-800' : 'text-[#595959]')}>
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              {prazo.texto}
            </p>
          ) : null}
          {situacao.rastreio ? (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-sky-900">
              <Truck className="h-3 w-3 shrink-0" aria-hidden />
              Rastreio <span className="font-mono">{situacao.rastreio}</span>
            </p>
          ) : null}
        </div>
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EAEAEA]">
            <div className="h-full rounded-full bg-[#171717] transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-[#6B6B6B]">{percent}% da jornada</p>
        </div>
      </div>
    </Link>
  )
}
