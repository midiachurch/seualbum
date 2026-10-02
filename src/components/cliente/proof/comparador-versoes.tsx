'use client'

import { useState } from 'react'
import { Check, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lamina } from '@/types/platform'

export type PinComparacao = { id: string; numero: number; x: number; y: number; resolvido: boolean; texto: string }

/**
 * Modo comparar da prova (visão da equipe): a mesma lâmina em duas versões,
 * lado a lado no desktop e empilhadas no celular. À esquerda a versão
 * anterior COM os pins que pediram ajuste; à direita a nova — o designer
 * confere ponto a ponto se cada pedido foi aplicado antes de liberar.
 */
export function ComparadorVersoes({
  antes,
  depois,
  laminaAntes,
  laminaDepois,
  indice,
  pins,
  destacado,
  onPin,
}: {
  antes: number
  depois: number
  laminaAntes: Lamina | null
  laminaDepois: Lamina | null
  indice: number
  pins: PinComparacao[]
  destacado: string | null
  onPin: (id: string) => void
}) {
  return (
    <div className="grid flex-1 grid-rows-2 gap-2 overflow-hidden p-2 sm:p-4 lg:grid-cols-2 lg:grid-rows-1 lg:gap-4">
      <Quadro key={laminaAntes?.id ?? 'sem-antes'} titulo={`Versão ${antes}`} subtitulo="com os ajustes pedidos" lamina={laminaAntes} indice={indice}>
        {pins.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPin(p.id)}
            aria-label={`Ajuste ${p.numero}${p.resolvido ? ' (resolvido)' : ''}: ${p.texto}`}
            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span
              className={cn(
                'relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-[#171717] shadow-lg transition-transform',
                destacado === p.id ? 'scale-125 bg-white' : p.resolvido ? 'bg-emerald-400/60 opacity-70' : 'bg-amber-400',
              )}
            >
              {p.numero}
              {p.resolvido ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-1 ring-white">
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </Quadro>
      <Quadro key={laminaDepois?.id ?? 'sem-depois'} titulo={`Versão ${depois}`} subtitulo="nova" lamina={laminaDepois} indice={indice} />
    </div>
  )
}

function Quadro({
  titulo,
  subtitulo,
  lamina,
  indice,
  children,
}: {
  titulo: string
  subtitulo: string
  lamina: Lamina | null
  indice: number
  children?: React.ReactNode
}) {
  const [proporcaoCarregada, setProporcaoCarregada] = useState<number | null>(null)
  const proporcao = lamina?.largura && lamina.altura ? lamina.largura / lamina.altura : (proporcaoCarregada ?? 3 / 2)

  return (
    <section className="flex min-h-0 flex-col rounded-xl bg-white/5 p-2" aria-label={`${titulo}, lâmina ${indice + 1}`}>
      <p className="mb-2 px-1 text-xs font-semibold text-white">
        {titulo} <span className="font-normal text-white/50">· {subtitulo}</span>
      </p>
      {lamina ? (
        <div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
          <div className="relative" style={{ aspectRatio: String(proporcao), width: `min(100cqw, calc(100cqh * ${proporcao}))` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- lâmina via link assinado do Storage (URL expira). */}
            <img
              src={lamina.url}
              alt={`${titulo}, lâmina ${indice + 1}`}
              decoding="async"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget
                if (!lamina.largura && img.naturalWidth && img.naturalHeight) setProporcaoCarregada(img.naturalWidth / img.naturalHeight)
              }}
              className="h-full w-full select-none rounded-lg object-contain shadow-2xl"
            />
            {children}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <ImageOff className="h-6 w-6 text-white/40" aria-hidden />
          <p className="text-xs text-white/50">Sem lâmina {indice + 1} nesta versão.</p>
        </div>
      )}
    </section>
  )
}
