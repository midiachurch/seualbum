import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatBRL(value: number) {
  return BRL.format(value)
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

/** "há 2 dias" / "hoje" / "ontem" — usado nas timelines de atividade. */
export function formatRelativeDate(value: string | Date) {
  const diffMs = new Date(value).getTime() - Date.now()
  const diffDays = Math.round(diffMs / 86_400_000)
  return RELATIVE_TIME.format(diffDays, 'day')
}

/** "Marina Alves & Théo Costa" -> "MA" — avatar do portal do cliente. */
export function initials(nome: string) {
  const palavras = nome.split(/\s+/).filter(Boolean)
  const primeiras = [palavras[0], palavras[palavras.length - 1]].filter(Boolean)
  return primeiras.map((p) => p[0]?.toUpperCase() ?? '').join('')
}

/** "850 KB" / "4.2 MB" / "1.3 GB" — tamanhos de arquivo em telas de upload/download. */
export function formatarTamanho(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** `behavior` para scrollTo/scrollIntoView que respeita "reduzir movimento" do sistema. */
export function rolagemSuave(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}
