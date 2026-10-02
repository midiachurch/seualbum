'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MiniaturaLamina } from '@/components/album-editor/miniatura-lamina'
import type { FotoNoCanvas } from '@/components/album-editor/tipos'
import { ESTILOS, MAX_FOTOS_POR_LAMINA, tipoDaComposicao, type EstiloId, type Variante } from '@/lib/album/modelos'
import { novaLamina, type Geometria } from '@/lib/album/documento'
import { cn } from '@/lib/utils'

export type PedidoPreenchimento = {
  laminas: number
  capa: boolean
  estilo: EstiloId
  /** Só as fotos selecionadas na biblioteca. */
  soSelecionadas: boolean
  /** Completar os quadros vazios do modelo em vez de refazer as lâminas. */
  usarQuadrosDoModelo: boolean
}

/** Smart Layout da lâmina atual + preenchimento automático do álbum. */
export function PainelLayouts({
  geometria,
  fotosMapa,
  variantes,
  origem,
  selecionadas,
  totalFotos,
  sugestaoLaminas,
  estiloInicial,
  temConteudo,
  temQuadrosVazios,
  somenteLeitura,
  onAplicar,
  onPreencher,
}: {
  geometria: Geometria
  fotosMapa: Map<string, FotoNoCanvas>
  variantes: Variante[]
  origem: 'selecao' | 'lamina' | null
  selecionadas: number
  totalFotos: number
  sugestaoLaminas: number
  estiloInicial: EstiloId
  temConteudo: boolean
  temQuadrosVazios: boolean
  somenteLeitura: boolean
  onAplicar: (v: Variante) => void
  onPreencher: (p: PedidoPreenchimento) => void
}) {
  const [laminas, setLaminas] = useState(String(sugestaoLaminas))
  const [capa, setCapa] = useState(false)
  const [estilo, setEstilo] = useState<EstiloId>(estiloInicial)
  const [soSelecionadas, setSoSelecionadas] = useState(false)
  const [usarQuadros, setUsarQuadros] = useState(temQuadrosVazios)
  const n = Number(laminas)
  const fotosDoPreenchimento = soSelecionadas ? selecionadas : totalFotos

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Criar composição (Smart Layout)</p>
        <p className="text-xs text-white/60">
          {origem === 'selecao'
            ? `${variantes.length} sugestões para as ${selecionadas} foto(s) selecionadas. Clique para aplicar na lâmina atual.`
            : origem === 'lamina'
              ? 'Rearranjos das fotos que já estão nesta lâmina. Selecione fotos na aba Fotos para outras combinações.'
              : `Selecione de 1 a ${MAX_FOTOS_POR_LAMINA} fotos na aba Fotos (ou ponha fotos na lâmina) para ver sugestões.`}
        </p>
        <div className="grid grid-cols-1 gap-2">
          {variantes.map((v, i) => (
            <button
              key={v.id}
              type="button"
              disabled={somenteLeitura}
              onClick={() => onAplicar(v)}
              className="rounded-lg p-1.5 text-left ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/40 disabled:opacity-50"
              aria-label={`Aplicar o layout ${i + 1} na lâmina atual`}
            >
              <MiniaturaLamina lamina={{ ...novaLamina(), id: v.id, quadros: v.quadros }} geometria={geometria} fotos={fotosMapa} largura={236} />
              <span className="mt-1 flex justify-between text-[11px] text-white/60">
                <span>Composição {String(i + 1).padStart(2, '0')}</span>
                <span className="rounded bg-white/10 px-1.5">{tipoDaComposicao(v)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-white/10 pt-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Preencher álbum automaticamente
        </p>
        <p className="text-xs text-white/60">
          O Smart Album monta uma primeira proposta (favoritas e obrigatórias primeiro, em ordem de captura, no ritmo do estilo). Depois é com você:
          tudo fica editável.
        </p>
        {temQuadrosVazios ? (
          <label className="flex items-start gap-2 text-xs text-white/80">
            <input type="checkbox" checked={usarQuadros} onChange={(e) => setUsarQuadros(e.target.checked)} className="mt-0.5 accent-white" />
            Só completar os quadros vazios do modelo (mantém as lâminas como estão)
          </label>
        ) : null}
        {!usarQuadros || !temQuadrosVazios ? (
          <>
            <fieldset className="space-y-1">
              <legend className="text-xs text-white/80">Estilo</legend>
              {ESTILOS.map((e) => (
                <label key={e.id} className={cn('flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-xs', estilo === e.id ? 'bg-white/15' : 'hover:bg-white/5')}>
                  <input type="radio" name="estilo" checked={estilo === e.id} onChange={() => setEstilo(e.id)} className="mt-0.5 accent-white" />
                  <span>
                    <span className="font-medium text-white">{e.nome}</span>
                    <span className="block text-white/50">{e.descricao}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="block text-xs text-white/80">
              Lâminas
              <input
                type="number"
                min={1}
                max={200}
                value={laminas}
                onChange={(e) => setLaminas(e.target.value)}
                className="mt-1 block w-full rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={capa} onChange={(e) => setCapa(e.target.checked)} className="accent-white" />
              Reservar a 1ª lâmina para a capa
            </label>
          </>
        ) : null}
        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={soSelecionadas} onChange={(e) => setSoSelecionadas(e.target.checked)} disabled={selecionadas === 0} className="accent-white" />
          Usar só as {selecionadas} foto(s) selecionadas
        </label>
        <p className="text-xs text-white/50">
          {fotosDoPreenchimento} foto(s){!usarQuadros || !temQuadrosVazios ? ` em ${Number.isFinite(n) ? n : '—'} lâmina(s)` : ' nos quadros vazios'}.
        </p>
        {temConteudo && (!usarQuadros || !temQuadrosVazios) ? <p className="text-xs text-amber-300">Substitui o que já está no álbum — dá para desfazer (Ctrl+Z).</p> : null}
        <Button
          size="sm"
          variant="brand"
          className="w-full"
          disabled={somenteLeitura || fotosDoPreenchimento === 0 || ((!usarQuadros || !temQuadrosVazios) && !(n >= 1 && n <= 200))}
          onClick={() =>
            onPreencher({ laminas: Math.floor(n) || 1, capa, estilo, soSelecionadas, usarQuadrosDoModelo: usarQuadros && temQuadrosVazios })
          }
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Preencher automaticamente
        </Button>
      </section>
    </div>
  )
}
