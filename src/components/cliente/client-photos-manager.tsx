'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImageUp, Star, X } from 'lucide-react'
import { uploadProjetoFoto } from '@/lib/upload-projeto-foto'
import { cn } from '@/lib/utils'
import type { Photo } from '@/types/platform'

type ManagedPhoto = Photo & { uploading?: boolean; progress?: number }

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Aba "Minhas Fotos" (seção 12). Em modo de demonstração o upload é só
 * cosmético (`URL.createObjectURL`, sem envio real). Fora dele, cada arquivo
 * sobe de verdade para o Cloudflare R2 e vira uma linha em `fotos`
 * (`bucket = 'r2'`) — ver `uploadProjetoFoto`.
 */
export function ClientPhotosManager({ projetoId, initialPhotos }: { projetoId: string; initialPhotos: Photo[] }) {
  const [photos, setPhotos] = useState<ManagedPhoto[]>(initialPhotos)
  const [dragActive, setDragActive] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<string[]>([])

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    },
    [],
  )

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
      const novas: (ManagedPhoto & { _file?: File })[] = files.map((file, i) => {
        const url = URL.createObjectURL(file)
        objectUrlsRef.current.push(url)
        return {
          id: `novo-${Date.now()}-${i}`,
          url,
          grupo: 'Novas fotos',
          favorita: false,
          obrigatoria: false,
          destaque: false,
          capa: false,
          observacao: null,
          uploading: true,
          progress: 0,
          _file: file,
        }
      })

      if (novas.length === 0) return
      setPhotos((prev) => [...prev, ...novas])

      novas.forEach((foto) => {
        if (!DEMO_MODE && foto._file) {
          uploadProjetoFoto(projetoId, foto._file, 'Novas fotos')
            .then(({ url }) => {
              setPhotos((prev) => prev.map((p) => (p.id === foto.id ? { ...p, url: url || p.url, uploading: false, progress: 100 } : p)))
            })
            .catch(() => {
              setPhotos((prev) => prev.map((p) => (p.id === foto.id ? { ...p, uploading: false } : p)))
            })
          return
        }

        const totalTicks = 8 + Math.floor(Math.random() * 6)
        let tick = 0
        const interval = setInterval(() => {
          tick += 1
          const progress = Math.min(100, Math.round((tick / totalTicks) * 100))
          setPhotos((prev) =>
            prev.map((p) => (p.id === foto.id ? { ...p, progress, uploading: progress < 100 } : p)),
          )
          if (progress >= 100) clearInterval(interval)
        }, 160)
      })
    },
    [projetoId],
  )

  function toggleFavorite(id: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, favorita: !p.favorita } : p)))
  }

  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null

  return (
    <div className="space-y-5">
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
          'flex min-h-[44px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
          dragActive ? 'border-[#171717] bg-[#F5F5F5]' : 'border-[#DDDDDD] hover:border-[#AAAAAA]',
        )}
      >
        <ImageUp className="h-8 w-8 text-[#6B6B6B]" aria-hidden />
        <div>
          <p className="font-medium text-[#171717]">Adicionar mais fotos</p>
          <p className="text-xs text-[#6B6B6B]">Toque para escolher ou arraste os arquivos aqui</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>

      {photos.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-[#6B6B6B]">
          Nenhuma foto enviada ainda.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={photo.id} role="button" tabIndex={0} onClick={() => setLightboxIndex(i)} onKeyDown={(e) => e.key === 'Enter' && setLightboxIndex(i)} className="group relative aspect-square overflow-hidden rounded-xl bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:) e fotos mockadas, next/image não serve blob e cache local corrompe no volume externo. */}
              <img src={photo.url} alt={photo.grupo} className={cn('h-full w-full object-cover', photo.uploading && 'opacity-60')} />
              {photo.uploading ? (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                  <div className="h-full bg-white transition-all" style={{ width: `${photo.progress ?? 0}%` }} />
                </div>
              ) : null}
              {photo.capa ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">Capa</span>
              ) : null}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFavorite(photo.id)
                }}
                aria-label={photo.favorita ? 'Remover dos favoritos' : 'Marcar como favorita'}
                aria-pressed={photo.favorita}
                className="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white"
              >
                <Star className={cn('h-4 w-4', photo.favorita && 'fill-yellow-400 text-yellow-400')} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxPhoto ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black" onClick={() => setLightboxIndex(null)}>
          <div className="flex items-center justify-between p-3">
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              aria-label="Fechar"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleFavorite(lightboxPhoto.id)
              }}
              aria-label={lightboxPhoto.favorita ? 'Remover dos favoritos' : 'Marcar como favorita'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <Star className={cn('h-5 w-5', lightboxPhoto.favorita && 'fill-yellow-400 text-yellow-400')} aria-hidden />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- lightbox de preview local/mock, sem otimização de imagem. */}
            <img src={lightboxPhoto.url} alt={lightboxPhoto.grupo} className="max-h-full max-w-full object-contain" />
            {lightboxIndex !== null && lightboxIndex > 0 ? (
              <button
                type="button"
                onClick={() => setLightboxIndex((i) => (i !== null ? i - 1 : i))}
                aria-label="Foto anterior"
                className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
            ) : null}
            {lightboxIndex !== null && lightboxIndex < photos.length - 1 ? (
              <button
                type="button"
                onClick={() => setLightboxIndex((i) => (i !== null ? i + 1 : i))}
                aria-label="Próxima foto"
                className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="p-4 text-center text-sm text-white/70">
            {(lightboxIndex ?? 0) + 1} / {photos.length} · {lightboxPhoto.grupo}
          </p>
        </div>
      ) : null}
    </div>
  )
}
