'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { abrirConversa } from '@/lib/actions/mensagens'
import type { CanalConversa } from '@/lib/mensagens'

/**
 * "Nova conversa": escolhe um estúdio (equipe → fio geral) ou um projeto
 * (estúdio → fio do projeto) e abre o fio na caixa de entrada.
 */
export function NovaConversa({
  canal,
  campo,
  opcoes,
  rotulo,
  hrefDoFio,
}: {
  canal: CanalConversa
  campo: 'fotografoId' | 'projetoId'
  opcoes: { valor: string; rotulo: string }[]
  rotulo: string
  /** Prefixo do link do fio aberto; recebe `c=<id>` no fim. */
  hrefDoFio: string
}) {
  const router = useRouter()
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [abrindo, start] = useTransition()

  if (opcoes.length === 0) return null

  function abrir() {
    if (!valor) return
    setErro(null)
    start(async () => {
      const r = await abrirConversa({ canal, [campo]: valor })
      if (!r.ok) return setErro(r.erro)
      router.push(`${hrefDoFio}${hrefDoFio.includes('?') ? '&' : '?'}c=${r.conversaId}`)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        aria-label={rotulo}
        className="h-9 max-w-full rounded-lg border border-input bg-background px-2 text-sm"
      >
        <option value="">{rotulo}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="brandOutline" onClick={abrir} disabled={!valor || abrindo}>
        {abrindo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
        Abrir conversa
      </Button>
      {erro ? (
        <p role="alert" className="w-full text-xs text-destructive">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
