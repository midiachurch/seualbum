'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react'
import { cn, rolagemSuave } from '@/lib/utils'

/**
 * Visualização "álbum físico": a lâmina aberta inteira, com a folha da
 * direita (ou da esquerda, voltando) virando em 3D sobre a dobra. Recebe as
 * lâminas já em imagem — no editor, geradas na hora; no link de aprovação,
 * as que o designer enviou. `sobreposicao` desenha por cima da lâmina parada
 * (os pins de comentário).
 */

export type PaginaDoLivro = { url: string | null; rotulo: string }

const DURACAO_MS = 700

function Metade({ url, lado }: { url: string | null; lado: 'esquerda' | 'direita' }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- lâmina gerada (blob/link assinado).
        <img
          src={url}
          alt=""
          draggable={false}
          className="absolute top-0 h-full max-w-none select-none"
          style={{ width: '200%', left: lado === 'esquerda' ? 0 : '-100%' }}
        />
      ) : null}
    </div>
  )
}

export function Flipbook({
  paginas,
  proporcao,
  indice,
  onIndice,
  sobreposicao,
  className,
}: {
  paginas: PaginaDoLivro[]
  /** Largura ÷ altura da lâmina aberta. */
  proporcao: number
  indice: number
  onIndice: (i: number) => void
  sobreposicao?: (indice: number) => ReactNode
  className?: string
}) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const [virando, setVirando] = useState<{ de: number; para: number; frente: boolean } | null>(null)
  const [girou, setGirou] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [telaCheia, setTelaCheia] = useState(false)

  const ir = useCallback(
    (para: number) => {
      if (virando || para < 0 || para >= paginas.length || para === indice) return
      // Sem animação para quem prefere menos movimento, ou pulando várias.
      if (rolagemSuave() === 'auto' || Math.abs(para - indice) > 1) {
        onIndice(para)
        return
      }
      setVirando({ de: indice, para, frente: para > indice })
      setGirou(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setGirou(true)))
      window.setTimeout(() => {
        onIndice(para)
        setVirando(null)
        setGirou(false)
      }, DURACAO_MS)
    },
    [indice, onIndice, paginas.length, virando],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA'].includes(alvo.tagName)) return
      if (e.key === 'ArrowRight') ir(indice + 1)
      if (e.key === 'ArrowLeft') ir(indice - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [indice, ir])

  useEffect(() => {
    const ao = () => setTelaCheia(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', ao)
    return () => document.removeEventListener('fullscreenchange', ao)
  }, [])

  const atual = paginas[indice]
  const de = virando ? paginas[virando.de] : null
  const para = virando ? paginas[virando.para] : null

  const botaoIcone =
    'flex h-10 w-10 items-center justify-center rounded-full text-[#6B6B6B] transition-colors hover:bg-[#F5F5F5] hover:text-[#171717] disabled:pointer-events-none disabled:opacity-30'
  const seta =
    'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#EAEAEA] bg-white text-[#171717] shadow-sm transition-colors hover:bg-[#F5F5F5] sm:h-12 sm:w-12'

  return (
    <div ref={caixaRef} className={cn('flex h-full w-full flex-col bg-[#F5F5F5] text-[#171717]', className)}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-10">
        <div
          className="relative shrink-0 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)]"
          style={{
            aspectRatio: String(proporcao),
            width: `min(${100 * zoom}%, calc((100vh - 9rem) * ${proporcao} * ${zoom}))`,
            perspective: '2400px',
          }}
        >
          {virando && de && para ? (
            <>
              {/* Lados parados: o que fica da lâmina de saída e o que já aparece da de chegada. */}
              <div className="absolute inset-y-0 left-0 w-1/2">
                <Metade url={virando.frente ? de.url : para.url} lado="esquerda" />
              </div>
              <div className="absolute inset-y-0 right-0 w-1/2">
                <Metade url={virando.frente ? para.url : de.url} lado="direita" />
              </div>
              {/* A folha virando: frente = metade da lâmina de saída; verso = metade da de chegada. */}
              <div
                className="absolute inset-y-0 w-1/2"
                style={{
                  [virando.frente ? 'right' : 'left']: 0,
                  transformOrigin: virando.frente ? 'left center' : 'right center',
                  transformStyle: 'preserve-3d',
                  transition: `transform ${DURACAO_MS}ms cubic-bezier(.45,.05,.35,1)`,
                  transform: girou ? `rotateY(${virando.frente ? -180 : 180}deg)` : 'rotateY(0deg)',
                }}
              >
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                  <Metade url={de.url} lado={virando.frente ? 'direita' : 'esquerda'} />
                  {/* Sombreado da folha em movimento. */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#171717]/20" />
                </div>
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <Metade url={para.url} lado={virando.frente ? 'esquerda' : 'direita'} />
                </div>
              </div>
            </>
          ) : atual ? (
            <>
              {atual.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- lâmina gerada (blob/link assinado).
                <img src={atual.url} alt={atual.rotulo} draggable={false} className="absolute inset-0 h-full w-full select-none bg-white object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-white text-sm text-[#9A9A9A]">Gerando lâmina…</div>
              )}
              {sobreposicao?.(indice)}
            </>
          ) : null}
          {/* Sombra da dobra. */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#171717]/10 to-transparent" />
        </div>

        {indice > 0 ? (
          <button type="button" onClick={() => ir(indice - 1)} aria-label="Página anterior" className={cn(seta, 'left-2 sm:left-4')}>
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        ) : null}
        {indice < paginas.length - 1 ? (
          <button type="button" onClick={() => ir(indice + 1)} aria-label="Página seguinte" className={cn(seta, 'right-2 sm:right-4')}>
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 px-2 pb-2 text-sm sm:px-4">
        <div className="flex items-center">
          <button type="button" onClick={() => onIndice(0)} disabled={indice === 0} className={botaoIcone} aria-label="Início" title="Início">
            <ChevronsLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => ir(indice - 1)} disabled={indice === 0} className={cn(botaoIcone, 'hidden sm:flex')} aria-label="Anterior" title="Anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <span className="min-w-0 truncate text-xs tabular-nums text-[#6B6B6B] sm:text-sm" aria-live="polite">
          <span className="font-medium text-[#171717]">{atual?.rotulo}</span> · {indice + 1} de {paginas.length}
        </span>
        <div className="flex items-center">
          <button type="button" onClick={() => ir(indice + 1)} disabled={indice >= paginas.length - 1} className={cn(botaoIcone, 'hidden sm:flex')} aria-label="Seguinte" title="Seguinte">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onIndice(paginas.length - 1)}
            disabled={indice >= paginas.length - 1}
            className={botaoIcone}
            aria-label="Final"
            title="Final"
          >
            <ChevronsRight className="h-4 w-4" aria-hidden />
          </button>
          <span className="mx-1 hidden h-5 w-px bg-[#EAEAEA] sm:block" aria-hidden />
          <button
            type="button"
            onClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
            className={botaoIcone}
            aria-label={zoom > 1 ? 'Diminuir zoom' : 'Aumentar zoom'}
            title={zoom > 1 ? 'Diminuir zoom' : 'Aumentar zoom'}
          >
            {zoom > 1 ? <ZoomOut className="h-4 w-4" aria-hidden /> : <ZoomIn className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void caixaRef.current?.requestFullscreen?.())}
            className={botaoIcone}
            aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
            title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {telaCheia ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  )
}
