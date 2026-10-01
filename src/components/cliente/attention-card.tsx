import Link from 'next/link'
import { ChevronRight, ImageUp, Sparkles } from 'lucide-react'

export function AttentionCard({
  icon,
  title,
  description,
  href,
}: {
  icon: 'fotos' | 'prova'
  title: string
  description: string
  href: string
}) {
  const Icon = icon === 'fotos' ? ImageUp : Sparkles

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5]">
        <Icon className="h-5 w-5 text-[#171717]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#171717]">{title}</p>
        <p className="text-xs text-[#595959]">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#CCCCCC]" aria-hidden />
    </Link>
  )
}
