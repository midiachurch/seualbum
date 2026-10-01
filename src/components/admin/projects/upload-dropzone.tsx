'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type UploadItem = {
  id: string
  name: string
  sizeKb: number
  previewUrl: string
  progress: number
  status: 'enviando' | 'concluido'
  file: File
}

/**
 * Dropzone real (drag&drop + seletor de arquivos) com preview local via
 * `URL.createObjectURL` e progresso simulado — a barra é sempre cosmética
 * (o projeto ainda não existe neste passo do wizard), mas os arquivos reais
 * ficam disponíveis via `onFilesChange` para o envio de verdade acontecer
 * depois que o projeto for criado (ver `NewProjectWizard`).
 */
export function UploadDropzone({ onFilesChange }: { onFilesChange?: (files: File[]) => void } = {}) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Ref espelhando `items` para o cleanup de unmount ler o valor mais
  // recente — um array vazio nas deps do efeito capturaria só o estado
  // inicial e nunca revogaria as URLs geradas de verdade.
  const itemsRef = useRef<UploadItem[]>([])
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    },
    [],
  )

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      const newItems: UploadItem[] = Array.from(fileList)
        .filter((file) => file.type.startsWith('image/'))
        .map((file) => ({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          sizeKb: Math.round(file.size / 1024),
          previewUrl: URL.createObjectURL(file),
          progress: 0,
          status: 'enviando' as const,
          file,
        }))

      if (newItems.length === 0) return
      setItems((prev) => {
        const next = [...prev, ...newItems]
        onFilesChange?.(next.map((i) => i.file))
        return next
      })

      newItems.forEach((item) => {
        const totalTicks = 8 + Math.floor(Math.random() * 6)
        let tick = 0
        const interval = setInterval(() => {
          tick += 1
          const progress = Math.min(100, Math.round((tick / totalTicks) * 100))
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, progress, status: progress >= 100 ? 'concluido' : 'enviando' } : i,
            ),
          )
          if (progress >= 100) clearInterval(interval)
        }, 160)
      })
    },
    [onFilesChange],
  )

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      const next = prev.filter((i) => i.id !== id)
      onFilesChange?.(next.map((i) => i.file))
      return next
    })
  }

  const concluidas = items.filter((i) => i.status === 'concluido').length

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          addFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-16 text-center transition-colors',
          dragActive ? 'border-foreground bg-secondary/40' : 'border-border hover:border-foreground/40',
        )}
      >
        <ImageUp className="h-10 w-10 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">Arraste as fotos aqui, ou clique para selecionar</p>
          <p className="mt-1 text-sm text-muted-foreground">JPG, PNG ou WEBP — envie quantas quiser, em lote.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {items.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {concluidas} de {items.length} fotos enviadas
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="group relative overflow-hidden rounded-xl border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview local via blob: URL, next/image não serve URLs blob */}
                <img src={item.previewUrl} alt={item.name} className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remover ${item.name}`}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {item.status === 'enviando' ? (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
                    <div
                      className="h-full bg-foreground transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                ) : null}
                <p className="truncate px-2 py-1 text-xs text-muted-foreground">{item.name}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
