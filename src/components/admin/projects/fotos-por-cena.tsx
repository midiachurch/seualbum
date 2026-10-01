'use client'

import { useMemo, useState } from 'react'
import { Camera, Clock, Sparkles } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { agruparPorCena, horaDaCena } from '@/lib/cenas'
import { cn } from '@/lib/utils'
import type { Photo } from '@/types/platform'

/**
 * Aba Fotografias do projeto, para o designer: com EXIF (lido no upload,
 * migration 0025), as fotos chegam agrupadas em cenas e momentos — cada
 * momento é um candidato natural a uma lâmina. Sem EXIF, a grade de sempre.
 * O fotógrafo nunca vê isto (Smart Layout invisível para quem envia).
 */
export function FotosPorCena({ photos }: { photos: Photo[] }) {
  const resultado = useMemo(() => agruparPorCena(photos), [photos])
  const temCenas = resultado.cenas.length > 0
  const [modo, setModo] = useState<'cenas' | 'todas'>(temCenas ? 'cenas' : 'todas')

  if (photos.length === 0) return <EmptyState title="Nenhuma fotografia enviada ainda" />

  const totalMomentos = resultado.cenas.reduce((s, c) => s + c.momentos.length, 0)

  return (
    <div className="space-y-5">
      {temCenas ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#171717]" aria-hidden />
            <span>
              {resultado.cenas.length} {resultado.cenas.length === 1 ? 'cena' : 'cenas'} · {totalMomentos}{' '}
              {totalMomentos === 1 ? 'momento' : 'momentos'} pela hora de captura
              {resultado.semData.length > 0 ? ` · ${resultado.semData.length} sem data` : ''}
            </span>
          </p>
          <div role="group" aria-label="Organizar fotos" className="flex rounded-xl border bg-card p-1 text-sm">
            {(
              [
                { valor: 'cenas', rotulo: 'Por cena' },
                { valor: 'todas', rotulo: 'Todas' },
              ] as const
            ).map((op) => (
              <button
                key={op.valor}
                type="button"
                aria-pressed={modo === op.valor}
                onClick={() => setModo(op.valor)}
                className={cn(
                  'min-h-[36px] rounded-lg px-3 font-medium transition-colors',
                  modo === op.valor ? 'bg-[#171717] text-white' : 'text-[#595959] hover:bg-[#F5F5F5]',
                )}
              >
                {op.rotulo}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {resultado.ajustesDeRelogio.length > 0 && modo === 'cenas' ? (
        <p className="rounded-xl bg-[#F5F5F5] p-3 text-xs text-[#444444]">
          Relógio corrigido para alinhar as câmeras:{' '}
          {resultado.ajustesDeRelogio
            .map((a) => `${a.camera} ${a.minutos > 0 ? '+' : '−'}${Math.abs(a.minutos)} min`)
            .join(' · ')}
          .
        </p>
      ) : null}

      {modo === 'todas' ? (
        <Grade fotos={photos} />
      ) : (
        <>
          {resultado.cenas.map((cena) => (
            <section key={cena.numero} aria-labelledby={`cena-${cena.numero}`} className="space-y-3">
              <h3 id={`cena-${cena.numero}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
                Cena {cena.numero}
                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {horaDaCena(cena.inicio)}–{horaDaCena(cena.fim)}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {cena.fotos.length} fotos · {cena.momentos.length} {cena.momentos.length === 1 ? 'momento' : 'momentos'}
                </span>
                {cena.cameras.length > 1 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                    {cena.cameras.length} câmeras
                  </span>
                ) : null}
              </h3>
              <ol className="space-y-2">
                {cena.momentos.map((momento, i) => (
                  <li key={i} className="rounded-xl border border-dashed border-[#DDDDDD] p-2">
                    <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Momento {i + 1} · {momento.length} {momento.length === 1 ? 'foto' : 'fotos'}
                    </p>
                    <Grade fotos={momento} compacta />
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {resultado.semData.length > 0 ? (
            <section aria-labelledby="cena-sem-data" className="space-y-3">
              <h3 id="cena-sem-data" className="text-sm font-semibold">
                Sem data de captura
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {resultado.semData.length} fotos (sem EXIF — ordem de envio)
                </span>
              </h3>
              <Grade fotos={resultado.semData} />
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function Grade({ fotos, compacta = false }: { fotos: Photo[]; compacta?: boolean }) {
  return (
    <div className={cn('grid gap-3', compacta ? 'grid-cols-3 gap-2 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4')}>
      {fotos.map((photo) => (
        <div key={photo.id} className="group overflow-hidden rounded-xl border bg-card">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
            <img src={photo.url} alt={photo.grupo} loading="lazy" className="aspect-square w-full object-cover grayscale" />
            {photo.capa || photo.destaque || photo.obrigatoria ? (
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/70 to-transparent p-2">
                {photo.capa ? <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">Capa</span> : null}
                {photo.destaque ? <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">Destaque</span> : null}
                {photo.obrigatoria ? <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">Obrigatória</span> : null}
              </div>
            ) : null}
          </div>
          {!compacta && photo.grupo ? <p className="px-2 py-1 text-xs text-muted-foreground">{photo.grupo}</p> : null}
          {compacta && photo.capturadaEm ? (
            // Hora do relógio da própria câmera (antes de qualquer correção entre câmeras).
            <p className="truncate px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground" title={photo.camera ?? undefined}>
              {photo.capturadaEm.slice(11, 19)}
              {photo.camera ? ` · ${photo.camera.split(' ')[0]}` : ''}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
