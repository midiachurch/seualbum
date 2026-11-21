'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { aceitarConviteEquipe } from '@/lib/actions/convites-equipe'

export function AceitarConvite({ token, email }: { token: string; email: string }) {
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState(false)
  const [pendente, iniciar] = useTransition()
  if (feito) return <div className="space-y-3" role="status">
    <p>Convite aceito. Você agora faz parte da equipe.</p>
    <Link className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm underline" href="/dashboard/equipe">Ver a equipe</Link>
  </div>
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Você está conectado como {email}. O convite só vale para o e-mail ao qual foi enviado.</p>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50" onClick={() => {
      setErro('')
      iniciar(async () => { const r = await aceitarConviteEquipe(token); if (r.ok) setFeito(true); else setErro(r.erro) })
    }}>{pendente ? 'Aceitando…' : 'Aceitar convite'}</button>
  </div>
}
