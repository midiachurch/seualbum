import { AlertTriangle, Clock } from 'lucide-react'
import { getSlaInfo } from '@/lib/sla'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/platform'

const TONE_CLASS: Record<'atrasado' | 'atencao' | 'normal', string> = {
  atrasado: 'bg-destructive/10 text-destructive',
  atencao: 'bg-amber-100 text-amber-800',
  normal: 'bg-secondary text-secondary-foreground',
}

/** Tag dinâmica de prazo restante — usada nos cards do Kanban e no cabeçalho do projeto. */
export function SlaBadge({ project, className }: { project: Pick<Project, 'status' | 'dataLimiteProducao' | 'dataLimiteAprovacao'>; className?: string }) {
  const sla = getSlaInfo(project)
  if (!sla) return null

  const Icon = sla.tone === 'atrasado' ? AlertTriangle : Clock

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        TONE_CLASS[sla.tone],
        className,
      )}
      title={sla.kind === 'aprovacao' ? 'Prazo para o cliente aprovar' : 'Prazo interno de produção'}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {sla.label}
    </span>
  )
}
