import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ValuePillar {
  icon: LucideIcon
  titulo: string
  texto: string
}

interface ValuePillarsProps {
  eyebrow: string
  title: string
  description?: string
  items: ValuePillar[]
  tone?: 'white' | 'gray'
}

/** Grade de pilares da marca — três colunas no desktop, separadas por filete. */
export function ValuePillars({ eyebrow, title, description, items, tone = 'white' }: ValuePillarsProps) {
  return (
    <section className={cn('font-marketing py-20 sm:py-28', tone === 'gray' ? 'bg-[#F5F5F5]' : 'bg-white')}>
      <div className="container">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-overline text-[#595959]">{eyebrow}</p>
          <h2 className="text-display-l mt-4 text-balance text-[#444444]">{title}</h2>
          {description ? (
            <p className={cn('text-body mt-4', tone === 'gray' ? 'text-[#444444]' : 'text-[#595959]')}>{description}</p>
          ) : null}
        </header>

        <ul className="mt-14 grid gap-px overflow-hidden border border-[#EAEAEA] bg-[#EAEAEA] sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, titulo, texto }) => (
            <li key={titulo} className="bg-white p-8 sm:p-10">
              <Icon className="h-6 w-6 text-[#444444]" strokeWidth={1.25} aria-hidden />
              <h3 className="mt-6 text-base font-semibold text-[#444444]">{titulo}</h3>
              <p className="text-body mt-2 text-[#595959]">{texto}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
