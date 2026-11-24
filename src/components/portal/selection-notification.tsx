'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { marcarNotificacaoSelecaoLida } from '@/lib/actions/notificacoes-selecao'

export function SelectionNotification({ id, projetoId, revisao, total, criadaEm, lidaEm }: {
  id: string; projetoId: string; revisao: number; total: number; criadaEm: string; lidaEm: string | null
}) {
  const [lida, setLida] = useState(Boolean(lidaEm))
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  return <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
    <div>
      <Link className="font-medium underline" href={`/dashboard/albuns/${projetoId}/compartilhar`}>
        Seleção entregue · revisão {revisao} · {total} fotos
      </Link>
      <p className="mt-1 text-sm text-muted-foreground"><time dateTime={criadaEm}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(criadaEm))}</time> · {lida ? 'Lida' : 'Não lida'}</p>
      {erro && <p role="alert" className="mt-1 text-sm text-destructive">{erro}</p>}
    </div>
    {!lida && <button type="button" disabled={pendente} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50" onClick={() => {
      setErro('')
      iniciar(async () => {
        const resultado = await marcarNotificacaoSelecaoLida(id)
        if (resultado.ok) setLida(true)
        else setErro(resultado.erro)
      })
    }}>{pendente ? 'Salvando…' : 'Marcar como lida'}</button>}
  </li>
}
