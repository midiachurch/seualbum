'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Eraser, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { MiniaturaLamina } from '@/components/album-editor/miniatura-lamina'
import type { FotoNoCanvas } from '@/components/album-editor/tipos'
import { rotuloDaLamina, type Geometria, type LaminaDoc } from '@/lib/album/documento'
import { cn } from '@/lib/utils'

const LARGURA_MINI = 132

/** Fita de lâminas (rodapé do editor): navegar, reordenar arrastando, duplicar, excluir. */
export function FitaLaminas({
  laminas,
  geometria,
  fotos,
  ativa,
  primeiraEhCapa,
  problemasPorLamina,
  comentariosPorLamina,
  onIr,
  onAdicionar,
  onDuplicar,
  onLimpar,
  onExcluir,
  onMover,
  somenteLeitura,
}: {
  laminas: LaminaDoc[]
  geometria: Geometria
  fotos: Map<string, FotoNoCanvas>
  ativa: number
  primeiraEhCapa: boolean
  problemasPorLamina: Map<number, number>
  comentariosPorLamina?: Map<number, number>
  onIr: (indice: number) => void
  onAdicionar: (depoisDe: number) => void
  onDuplicar: (indice: number) => void
  onLimpar: (indice: number) => void
  onExcluir: (indice: number) => void
  somenteLeitura: boolean
  onMover: (de: number, para: number) => void
}) {
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)

  const rotulo = (i: number) => rotuloDaLamina(i, primeiraEhCapa, false)
  const paginas = (i: number) => {
    if (primeiraEhCapa && i === 0) return ''
    const n = primeiraEhCapa ? i : i + 1
    return `págs. ${2 * n - 1}–${2 * n}`
  }

  return (
    <div className="flex items-stretch gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:thin]">
      {laminas.map((lamina, i) => {
        const problemas = problemasPorLamina.get(i) ?? 0
        return (
          <div
            key={lamina.id}
            draggable={!somenteLeitura}
            onDragStart={(e) => {
              setArrastando(i)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              if (arrastando === null) return
              e.preventDefault()
              setSobre(i)
            }}
            onDragLeave={() => setSobre((s) => (s === i ? null : s))}
            onDrop={(e) => {
              e.preventDefault()
              if (arrastando !== null && arrastando !== i) onMover(arrastando, i)
              setArrastando(null)
              setSobre(null)
            }}
            onDragEnd={() => {
              setArrastando(null)
              setSobre(null)
            }}
            className={cn(
              'group relative flex shrink-0 flex-col gap-1 rounded-lg p-1.5 transition-colors',
              i === ativa ? 'bg-white/15 ring-2 ring-white' : 'hover:bg-white/10',
              sobre === i && arrastando !== i && 'ring-2 ring-pink-400',
              arrastando === i && 'opacity-40',
            )}
          >
            <button type="button" onClick={() => onIr(i)} aria-label={`Ir para ${rotulo(i)}`} aria-current={i === ativa ? 'true' : undefined}>
              <MiniaturaLamina lamina={lamina} geometria={geometria} fotos={fotos} largura={LARGURA_MINI} />
            </button>
            <div className="flex items-center justify-between gap-1 text-[11px] text-white/70">
              <span className="tabular-nums">
                <span className="font-medium">{rotulo(i)}</span>
                {paginas(i) ? <span className="ml-1 text-white/40">{paginas(i)}</span> : null}
              </span>
              {comentariosPorLamina?.get(i) ? (
                <span className="flex items-center gap-0.5 rounded-full bg-sky-400 px-1.5 text-[10px] font-bold text-[#0A0A0A]" aria-label={`${comentariosPorLamina.get(i)} comentários do cliente`}>
                  <MessageSquare className="h-2.5 w-2.5" aria-hidden />
                  {comentariosPorLamina.get(i)}
                </span>
              ) : null}
              {problemas > 0 ? (
                <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-[#171717]" aria-label={`${problemas} pontos de atenção`}>
                  {problemas}
                </span>
              ) : null}
            </div>
            {i === ativa && !somenteLeitura ? (
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => onMover(i, i - 1)} disabled={i === 0} className="rounded p-1 text-white/70 hover:bg-white/10 disabled:opacity-30" aria-label="Mover para a esquerda">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onDuplicar(i)} className="rounded p-1 text-white/70 hover:bg-white/10" aria-label="Duplicar lâmina">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onLimpar(i)} className="rounded p-1 text-white/70 hover:bg-white/10" aria-label="Limpar lâmina">
                  <Eraser className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onExcluir(i)}
                  disabled={laminas.length === 1}
                  className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-red-300 disabled:opacity-30"
                  aria-label="Excluir lâmina"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMover(i, i + 1)}
                  disabled={i === laminas.length - 1}
                  className="rounded p-1 text-white/70 hover:bg-white/10 disabled:opacity-30"
                  aria-label="Mover para a direita"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        disabled={somenteLeitura}
        onClick={() => onAdicionar(ativa)}
        className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/30 px-4 text-xs text-white/70 hover:bg-white/10"
        style={{ minWidth: LARGURA_MINI / 1.4 }}
      >
        <Plus className="h-5 w-5" aria-hidden />
        Nova lâmina
      </button>
    </div>
  )
}
