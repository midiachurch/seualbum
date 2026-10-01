'use client'

import { useId, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'

export interface LibraryPhoto {
  id: string
  src: string | null
  tone: readonly [string, string]
  aspect: 'portrait' | 'landscape' | 'square'
}

const ASPECT_CLASS: Record<LibraryPhoto['aspect'], string> = {
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
  square: 'aspect-square',
}

const MOCK_PHOTOS: LibraryPhoto[] = [
  { id: 'm1', src: null, tone: ['from-neutral-300', 'to-neutral-400'], aspect: 'landscape' },
  { id: 'm2', src: null, tone: ['from-neutral-200', 'to-neutral-300'], aspect: 'portrait' },
  { id: 'm3', src: null, tone: ['from-neutral-400', 'to-neutral-500'], aspect: 'square' },
  { id: 'm4', src: null, tone: ['from-neutral-300', 'to-neutral-400'], aspect: 'portrait' },
  { id: 'm5', src: null, tone: ['from-neutral-200', 'to-neutral-400'], aspect: 'landscape' },
  { id: 'm6', src: null, tone: ['from-neutral-300', 'to-neutral-500'], aspect: 'square' },
]

function PhotoThumb({ photo }: { photo: LibraryPhoto }) {
  if (photo.src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo.src} alt="" className="h-full w-full object-cover" draggable={false} />
  }
  return <div className={cn('h-full w-full bg-gradient-to-br', photo.tone[0], photo.tone[1])} />
}

interface MediaLibraryPanelProps {
  onClose: () => void
  onDragPhoto: (photo: LibraryPhoto, event: ReactPointerEvent) => void
}

/**
 * Biblioteca de fotografias + upload — painel lateral discreto (diretriz 16).
 * As fotos da grade podem ser arrastadas para a página (ver AlbumEditorPreview,
 * que trata o feedback visual do drag conforme a diretriz 19).
 */
export function MediaLibraryPanel({ onClose, onDragPhoto }: MediaLibraryPanelProps) {
  const [photos, setPhotos] = useState<LibraryPhoto[]>(MOCK_PHOTOS)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputId = useId()

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const next: LibraryPhoto[] = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file, index) => ({
        id: `upload-${Date.now()}-${index}`,
        src: URL.createObjectURL(file),
        tone: ['from-neutral-300', 'to-neutral-400'] as const,
        aspect: index % 2 === 0 ? 'landscape' : 'portrait',
      }))
    if (next.length > 0) setPhotos((prev) => [...next, ...prev])
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-border md:flex">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Fotografias
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel de fotografias"
          className="text-lg leading-none text-muted-foreground transition-colors hover:text-foreground"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragOver(false)
            addFiles(event.dataTransfer.files)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1.5 rounded-sm border border-dashed px-4 py-8 text-center transition-colors duration-200',
            isDragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-foreground/30',
          )}
        >
          <span className="text-sm text-foreground">Arraste suas fotografias</span>
          <span className="text-xs text-muted-foreground">
            ou <span className="font-medium text-accent">selecione arquivos</span>
          </span>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => addFiles(event.target.files)}
          />
        </label>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onPointerDown={(event) => onDragPhoto(photo, event)}
              aria-label="Arrastar fotografia para a página"
              className={cn(
                'group relative touch-none select-none overflow-hidden rounded-sm transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]',
                ASPECT_CLASS[photo.aspect],
              )}
            >
              <PhotoThumb photo={photo} />
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
