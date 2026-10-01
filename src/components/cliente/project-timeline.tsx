import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CLIENT_STAGE_DESCRIPTION, CLIENT_STAGE_LABEL, CLIENT_STAGE_ORDER, type ClientStage } from '@/types/platform'

export function ProjectTimeline({ currentStage }: { currentStage: ClientStage }) {
  const currentIndex = CLIENT_STAGE_ORDER.indexOf(currentStage)

  return (
    <ol className="space-y-0">
      {CLIENT_STAGE_ORDER.map((stage, i) => {
        const isDone = i < currentIndex
        const isCurrent = i === currentIndex
        const isLast = i === CLIENT_STAGE_ORDER.length - 1

        return (
          <li key={stage} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast ? (
              <span
                className={cn(
                  'absolute left-[15px] top-8 h-full w-0.5',
                  isDone ? 'bg-[#171717]' : 'bg-[#EAEAEA]',
                )}
              />
            ) : null}
            <span
              className={cn(
                'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isDone && 'bg-[#171717] text-white',
                isCurrent && 'bg-[#171717] text-white ring-4 ring-[#171717]/20',
                !isDone && !isCurrent && 'bg-[#EAEAEA] text-[#6B6B6B]',
              )}
            >
              {isDone ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
            <div className={cn('pt-0.5', !isDone && !isCurrent && 'opacity-50')}>
              <p className={cn('font-medium', isCurrent ? 'text-[#171717]' : 'text-[#444444]')}>
                {CLIENT_STAGE_LABEL[stage]}
              </p>
              {isCurrent ? (
                <p className="mt-1 text-sm text-[#595959]">{CLIENT_STAGE_DESCRIPTION[stage]}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
