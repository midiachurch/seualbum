import { cn } from '@/lib/utils'
import { CLIENT_STAGE_COLOR, CLIENT_STAGE_LABEL, type ClientStage } from '@/types/platform'

export function ClientStageBadge({ stage, className }: { stage: ClientStage; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        CLIENT_STAGE_COLOR[stage],
        className,
      )}
    >
      {CLIENT_STAGE_LABEL[stage]}
    </span>
  )
}
