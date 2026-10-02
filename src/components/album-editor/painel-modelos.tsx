'use client'

import { useMemo, useState } from 'react'
import { MiniaturaLamina } from '@/components/album-editor/miniatura-lamina'
import { CATEGORIAS, documentoDoModelo, estiloPorId, MODELOS_DE_ALBUM, type ModeloAlbum } from '@/lib/album/modelos'
import type { Geometria } from '@/lib/album/documento'
import { cn } from '@/lib/utils'

const SEM_FOTOS = new Map()

/**
 * Biblioteca de modelos de álbum: cada modelo cria as lâminas já com os
 * quadros posicionados (vazios) no estilo dele. Depois, "Preencher" completa
 * os quadros com as fotos — ou o designer arrasta uma a uma.
 */
export function PainelModelos({
  geometria,
  temConteudo,
  somenteLeitura,
  onAplicar,
  onAplicarNaLamina,
}: {
  geometria: Geometria
  temConteudo: boolean
  somenteLeitura: boolean
  onAplicar: (modelo: ModeloAlbum, laminas: number) => void
  onAplicarNaLamina: (modelo: ModeloAlbum) => void
}) {
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number] | 'Todos'>('Todos')
  const [escolhido, setEscolhido] = useState<ModeloAlbum | null>(null)
  const [laminas, setLaminas] = useState('')
  const lista = MODELOS_DE_ALBUM.filter((m) => categoria === 'Todos' || m.categoria === categoria)
  const previa = useMemo(() => (escolhido ? documentoDoModelo(escolhido, 3, geometria).laminas.slice(escolhido.capa ? 1 : 0) : []), [escolhido, geometria])

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <div className="flex flex-wrap gap-1">
        {(['Todos', ...CATEGORIAS] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoria(c)}
            className={cn('rounded-full px-2.5 py-1 text-[11px]', categoria === c ? 'bg-white text-[#171717]' : 'bg-white/10 text-white/80 hover:bg-white/20')}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="space-y-1.5">
        {lista.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => {
                setEscolhido(m)
                setLaminas(String(m.laminas))
              }}
              className={cn('w-full rounded-lg p-2 text-left text-xs', escolhido?.id === m.id ? 'bg-white/15 ring-1 ring-white/50' : 'bg-white/5 hover:bg-white/10')}
            >
              <span className="block font-medium text-white">{m.nome}</span>
              <span className="block text-white/50">
                {m.categoria} · {estiloPorId(m.estilo).nome} · {m.laminas} lâminas{m.capa ? ' + capa' : ''}
              </span>
              <span className="block text-white/60">{m.descricao}</span>
            </button>
          </li>
        ))}
      </ul>
      {escolhido ? (
        <section className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-xs font-semibold text-white">Prévia — {escolhido.nome}</p>
          <div className="space-y-1.5">
            {previa.map((l) => (
              <MiniaturaLamina key={l.id} lamina={l} geometria={geometria} fotos={SEM_FOTOS} largura={236} />
            ))}
          </div>
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
          {temConteudo ? <p className="text-xs text-amber-300">Substitui as lâminas atuais — dá para desfazer (Ctrl+Z).</p> : null}
          <button
            type="button"
            disabled={somenteLeitura || !(Number(laminas) >= 1 && Number(laminas) <= 200)}
            onClick={() => onAplicar(escolhido, Math.floor(Number(laminas)))}
            className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#171717] hover:bg-white/90 disabled:opacity-50"
          >
            Aplicar modelo ao álbum
          </button>
          <button
            type="button"
            disabled={somenteLeitura}
            onClick={() => onAplicarNaLamina(escolhido)}
            className="w-full rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
          >
            Aplicar só na lâmina atual
          </button>
        </section>
      ) : null}
    </div>
  )
}
