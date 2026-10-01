'use client'

import { cn } from '@/lib/utils'
import type { TeamMember } from '@/types/platform'

/**
 * Atribuição de projeto a um operador/designer (seção 17). `teamMembers`
 * já vem filtrado para papel 'operador' por quem chama — só quem executa a
 * diagramação pode ser responsável por um projeto.
 */
export function AssignmentControl({
  value,
  onChange,
  teamMembers,
  canAssign,
  className,
}: {
  value: string | null
  onChange: (id: string | null) => void
  teamMembers: TeamMember[]
  canAssign: boolean
  className?: string
}) {
  if (!canAssign) {
    const nome = teamMembers.find((m) => m.id === value)?.nome
    return (
      <span className={cn('text-sm', !nome && 'text-muted-foreground', className)}>
        {nome ?? 'Não atribuído'}
      </span>
    )
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="Atribuir a"
      className={cn('h-8 rounded-lg border border-input bg-background px-2 text-xs', className)}
    >
      <option value="">Não atribuído</option>
      {teamMembers.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nome}
        </option>
      ))}
    </select>
  )
}
