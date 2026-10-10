'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Flipbook, type PaginaDoLivro } from '@/components/album-editor/flipbook'
import { carregarImagem, renderizarLaminaParaTela } from '@/lib/album/exportar'
import { rotuloDaLamina, type DocumentoAlbum, type Geometria } from '@/lib/album/documento'

const LARGURA_TELA_PX = 2000

/**
 * "Visualizar álbum": some com as ferramentas e mostra o álbum como o cliente
 * vai ver (sem guias, sem sangria), virando as páginas. As lâminas são
 * geradas no navegador, começando pela que está aberta no editor.
 */
export function Visualizacao({
  documento,
  geometria,
  urls,
  indiceInicial,
  onFechar,
}: {
  documento: DocumentoAlbum
  geometria: Geometria
  urls: Map<string, string>
  indiceInicial: number
  onFechar: (indice: number) => void
}) {
  const [indice, setIndice] = useState(indiceInicial)
  const [paginas, setPaginas] = useState<PaginaDoLivro[]>(() =>
    documento.laminas.map((_, i) => ({ url: null, rotulo: rotuloDaLamina(i, documento.primeiraEhCapa) })),
  )
  const criadas = useRef<string[]>([])
  const indiceRef = useRef(indice)
  // Espelha o índice para o atalho de teclado fora do render.
  useEffect(() => {
    indiceRef.current = indice
  }, [indice])

  useEffect(() => {
    let cancelado = false
    const cache = new Map<string, Promise<HTMLImageElement>>()
    const imagem = (fotoId: string) => {
      const url = urls.get(fotoId)
      if (!url) return Promise.reject(new Error('Foto não encontrada.'))
      if (!cache.has(fotoId)) cache.set(fotoId, carregarImagem(url))
      return cache.get(fotoId)!
    }
    const ordem = [indiceInicial, ...documento.laminas.map((_, i) => i).filter((i) => i !== indiceInicial)]
    void (async () => {
      for (const i of ordem) {
        if (cancelado) return
        try {
          const { blob } = await renderizarLaminaParaTela(documento.laminas[i], geometria, imagem, LARGURA_TELA_PX)
          if (cancelado) return
          const url = URL.createObjectURL(blob)
          criadas.current.push(url)
          setPaginas((p) => p.map((pg, k) => (k === i ? { ...pg, url } : pg)))
        } catch {
          // Lâmina com foto indisponível: fica o aviso "Gerando…" no lugar.
        }
      }
    })()
    return () => {
      cancelado = true
      criadas.current.forEach((u) => URL.revokeObjectURL(u))
      criadas.current = []
    }
    // Gera uma vez por abertura (o álbum não muda enquanto a visualização está aberta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !document.fullscreenElement) onFechar(indiceRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onFechar])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0A0A0A]" role="dialog" aria-modal="true" aria-label="Visualizar álbum">
      <button
        type="button"
        onClick={() => onFechar(indice)}
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Fechar visualização"
      >
        <X className="h-5 w-5" />
      </button>
      <Flipbook paginas={paginas} proporcao={geometria.laminaW / geometria.laminaH} indice={indice} onIndice={setIndice} />
    </div>
  )
}
