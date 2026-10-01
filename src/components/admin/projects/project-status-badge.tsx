import { cn } from '@/lib/utils'
import { PROJECT_STATUS_COLOR, PROJECT_STATUS_LABEL, type ProjectStatus } from '@/types/platform'

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        PROJECT_STATUS_COLOR[status],
        className,
      )}
    >
      {PROJECT_STATUS_LABEL[status]}
    </span>
  )
}
