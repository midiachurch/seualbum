'use client'

import { ajustesNeutros, posicaoDaFoto, type Geometria, type LaminaDoc } from '@/lib/album/documento'
import { filtroCss } from '@/lib/album/ajustes'
import { familiaDe } from '@/lib/album/fontes'
import { tamanhoEmMm } from '@/lib/album/texto'
import { urlParaMiniatura, type FotoNoCanvas } from '@/components/album-editor/tipos'
import { ornamentoPorId } from '@/lib/album/ornamentos'
import { LADO_TEXTURA_MM, ladrilhoDeTextura } from '@/lib/album/texturas'
import type { Textura } from '@/lib/album/documento'

const texturaCss = new Map<Textura, string>()
function urlDaTextura(t: Textura) {
  if (typeof document === 'undefined') return undefined
  if (!texturaCss.has(t)) texturaCss.set(t, ladrilhoDeTextura(t).toDataURL('image/png'))
  return texturaCss.get(t)

}

/**
 * Miniatura de uma lâmina em HTML puro (fita de lâminas, páginas e prévias
 * de modelo): leve o bastante para dezenas na tela ao mesmo tempo. Fiel ao
 * canvas no recorte, rotação e espelhamento; os ajustes de cor usam o filtro
 * CSS equivalente (aproximado).
 */
export function MiniaturaLamina({
  lamina,
  geometria: g,
  fotos,
  largura,
}: {
  lamina: LaminaDoc
  geometria: Geometria
  fotos: Map<string, FotoNoCanvas>
  largura: number
}) {
  const k = largura / g.laminaW
  const fundo = lamina.fundoImagem ? fotos.get(lamina.fundoImagem.fotoId) : undefined
  const camadas = (camada: 'tras' | 'frente') =>
    lamina.formas
      .filter((f) => f.camada === camada && !f.oculto)
      .map((f) =>
        f.forma === 'ornamento' ? (
          <svg
            key={f.id}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute overflow-visible"
            style={{ left: f.x * k, top: f.y * k, width: f.w * k, height: f.h * k, transform: f.rotacao ? `rotate(${f.rotacao}deg)` : undefined, opacity: f.opacidade }}
          >
            <path
              d={ornamentoPorId(f.ornamento).d}
              fill={ornamentoPorId(f.ornamento).preenchido ? (f.preenchimento ?? 'none') : 'none'}
              stroke={f.contorno ?? 'none'}
              strokeWidth={(f.espessura * 100) / Math.max(f.w, f.h)}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
        <div
          key={f.id}
          className="absolute"
          style={{
            left: f.x * k,
            top: f.y * k,
            width: f.w * k,
            height: Math.max(f.h * k, f.forma === 'linha' ? Math.max(1, f.espessura * k) : 0),
            transform: f.rotacao ? `rotate(${f.rotacao}deg)` : undefined,
            opacity: f.opacidade,
            background: f.forma === 'linha' ? (f.contorno ?? '#171717') : (f.preenchimento ?? 'transparent'),
            border: f.forma !== 'linha' && f.contorno ? `${Math.max(0.5, f.espessura * k)}px solid ${f.contorno}` : undefined,
            borderRadius: f.forma === 'elipse' ? '50%' : undefined,
          }}
        />
        ),
      )

  return (
    <div
      className="relative overflow-hidden rounded-sm shadow-sm ring-1 ring-black/10"
      style={{ width: largura, height: g.laminaH * k, background: lamina.fundo }}
      aria-hidden
    >
      {lamina.fundoGradiente ? (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(${lamina.fundoGradiente.angulo + 90}deg, ${lamina.fundoGradiente.de}, ${lamina.fundoGradiente.para})` }}
        />
      ) : null}
      {lamina.textura ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${urlDaTextura(lamina.textura.tipo)})`,
            backgroundSize: `${LADO_TEXTURA_MM * k}px`,
            opacity: lamina.textura.opacidade,
          }}
        />
      ) : null}
      {fundo ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura via link assinado do Storage.
        <img src={urlParaMiniatura(fundo)} alt="" loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: lamina.fundoImagem?.opacidade }} />
      ) : null}
      {camadas('tras')}
      {lamina.quadros.filter((q) => !q.oculto).map((q) => {
        const foto = q.fotoId ? fotos.get(q.fotoId) : undefined
        const pos = foto?.largura && foto.altura ? posicaoDaFoto(q, foto.largura, foto.altura) : null
        const espelho = q.espelharH || q.espelharV ? `scale(${q.espelharH ? -1 : 1}, ${q.espelharV ? -1 : 1})` : undefined
        return (
          <div
            key={q.id}
            className="absolute overflow-hidden bg-[#E5E5E5]"
            style={{
              left: q.x * k,
              top: q.y * k,
              width: q.w * k,
              height: q.h * k,
              transform: q.rotacao ? `rotate(${q.rotacao}deg)` : undefined,
              borderRadius: q.raio ? q.raio * k : undefined,
              opacity: q.opacidade,
              boxShadow: q.sombra ? '0 1px 3px rgba(0,0,0,0.35)' : undefined,
              outline: q.borda ? `${Math.max(0.5, q.borda.espessura * k)}px solid ${q.borda.cor}` : undefined,
              outlineOffset: q.borda ? -Math.max(0.5, q.borda.espessura * k) : undefined,
            }}
          >
            {foto ? (
              <div className="absolute inset-0" style={{ transform: espelho, filter: ajustesNeutros(q.ajustes) ? undefined : filtroCss(q.ajustes) }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura via link assinado do Storage. */}
                <img
                  src={urlParaMiniatura(foto)}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className={pos ? 'absolute max-w-none' : 'h-full w-full object-cover'}
                  style={pos ? { left: pos.x * k, top: pos.y * k, width: pos.w * k, height: pos.h * k } : undefined}
                />
              </div>
            ) : null}
          </div>
        )
      })}
      {camadas('frente')}
      {lamina.textos.filter((t) => !t.oculto).map((t) => (
        <div
          key={t.id}
          className="absolute whitespace-pre-wrap break-words"
          style={{
            left: t.x * k,
            top: t.y * k,
            width: t.w * k,
            transform: t.rotacao ? `rotate(${t.rotacao}deg)` : undefined,
            transformOrigin: 'center',
            opacity: t.opacidade,
            color: t.cor,
            fontFamily: familiaDe(t.fonte),
            fontSize: tamanhoEmMm(t) * k,
            fontWeight: t.peso,
            fontStyle: t.italico ? 'italic' : undefined,
            textAlign: t.alinhamento,
            lineHeight: t.entreLinhas,
            letterSpacing: `${t.entreLetras / 1000}em`,
          }}
        >
          {t.texto}
        </div>
      ))}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-black/15" />
    </div>
  )
}
