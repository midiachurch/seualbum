'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ApproveOrderActionProps {
  approvalLink: string
}

/**
 * Aprovação da prova pelo cliente. Prévia funcional com estado local — ao
 * conectar o Supabase, `handleApprove` vira uma server action que atualiza
 * `orders.status` para o próximo estágio da produção.
 */
export function ApproveOrderAction({ approvalLink }: ApproveOrderActionProps) {
  const [approved, setApproved] = useState(false)

  if (approved) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
        <Check className="h-4 w-4" aria-hidden />
        Aprovado
      </span>
    )
  }

  return (
    <div className="flex justify-end gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={approvalLink} target="_blank" rel="noopener noreferrer">
          Ver prova
        </a>
      </Button>
      <Button size="sm" variant="brand" onClick={() => setApproved(true)}>
        Aprovar
      </Button>
    </div>
  )
}
