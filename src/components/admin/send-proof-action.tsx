'use client'

import { useState } from 'react'
import { Check, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SendProofActionProps {
  orderId: string
  initialLink: string | null
}

/**
 * Anexa a prova/entrega do álbum a um pedido. Prévia funcional com estado
 * local — ao conectar o Supabase, `handleSend` vira uma server action que
 * grava em `orders.link_aprovacao` e avança o status para "aguardando_aprovacao".
 */
export function SendProofAction({ orderId, initialLink }: SendProofActionProps) {
  const [link, setLink] = useState(initialLink)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)

  function handleSend() {
    if (!draft.trim()) return
    setLink(draft.trim())
    setOpen(false)
    setDraft('')
  }

  if (open) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Link da prova"
          className="h-9 w-48"
          aria-label={`Link da prova do pedido ${orderId}`}
        />
        <Button size="sm" onClick={handleSend} disabled={!draft.trim()}>
          Enviar
        </Button>
      </div>
    )
  }

  if (link) {
    return (
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
        Prova enviada
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Atualizar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex justify-end">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" aria-hidden />
        Enviar prova
      </Button>
    </div>
  )
}
