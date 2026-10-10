'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { definirTemplateAtivo, renomearTemplateAlbum, type ResultadoDiagramacao } from '@/lib/actions/diagramacao'
import type { AlbumTemplateRow } from '@/types/database'
import { cn, formatDate } from '@/lib/utils'

/** Miniatura da geometria: quadros em frações da lâmina aberta (proporção 2:1). */
function Previa({ quadros }: { quadros: AlbumTemplateRow['quadros'] }) {
  return (
    <svg viewBox="0 0 200 100" className="h-12 w-24 shrink-0 rounded border bg-white" aria-hidden>
      <line x1="100" y1="0" x2="100" y2="100" stroke="#EAEAEA" strokeDasharray="3 3" />
      {quadros.map((q, i) => (
        <rect key={i} x={q.x * 200} y={q.y * 100} width={q.w * 200} height={q.h * 100} fill="#D4D4D4" stroke="#FFFFFF" strokeWidth="1.5" />
      ))}
    </svg>
  )
}

export function TemplatesManager({ templates }: { templates: AlbumTemplateRow[] }) {
  const router = useRouter()
  const [nomes, setNomes] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [pendente, iniciar] = useTransition()

  function executar(acao: () => Promise<ResultadoDiagramacao>, sucesso: string) {
    setAviso(null)
    iniciar(async () => {
      const r = await acao()
      setAviso(r.ok ? { tipo: 'ok', texto: sucesso } : { tipo: 'erro', texto: r.erro })
      if (r.ok) router.refresh()
    })
  }

  if (templates.length === 0) {
    return <EmptyState title="Nenhum template salvo" description='No editor, selecione uma lâmina e use "Salvar como template".' />
  }

  return (
    <div className="space-y-4">
      {aviso ? (
        <p
          role="status"
          className={cn(
            'rounded-xl border p-3 text-sm',
            aviso.tipo === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-destructive/30 bg-destructive/5 text-destructive',
          )}
        >
          {aviso.texto}
        </p>
      ) : null}
      <ul className="divide-y rounded-2xl border">
        {templates.map((t) => {
          const ativo = t.ativo !== false
          const nome = nomes[t.id] ?? t.nome
          const mudou = nome.trim() !== t.nome && nome.trim().length > 0
          return (
            <li key={t.id} className={cn('flex flex-wrap items-center gap-4 p-4', !ativo && 'bg-[#FAFAFA] opacity-70')}>
              <Previa quadros={t.quadros} />
              <form
                className="flex min-w-[220px] flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (mudou) executar(() => renomearTemplateAlbum(t.id, nome), 'Template renomeado.')
                }}
              >
                <Input
                  value={nome}
                  maxLength={80}
                  aria-label={`Nome do template ${t.nome}`}
                  onChange={(e) => setNomes((n) => ({ ...n, [t.id]: e.target.value }))}
                  className="h-9"
                />
                {mudou ? (
                  <Button type="submit" size="sm" variant="brand" disabled={pendente}>
                    Salvar
                  </Button>
                ) : null}
              </form>
              <p className="w-44 text-xs text-muted-foreground">
                {t.n_fotos} foto{t.n_fotos > 1 ? 's' : ''} · {t.assinatura}
                <br />
                {t.usos} uso{t.usos === 1 ? '' : 's'}
                {t.ultimo_uso ? ` · último em ${formatDate(t.ultimo_uso)}` : ''}
              </p>
              <Button
                size="sm"
                variant={ativo ? 'brandOutline' : 'brand'}
                disabled={pendente}
                onClick={() => executar(() => definirTemplateAtivo(t.id, !ativo), ativo ? 'Template desativado.' : 'Template reativado.')}
              >
                {pendente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {ativo ? 'Desativar' : 'Reativar'}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
