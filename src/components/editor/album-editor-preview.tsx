'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ALBUM_PAGES, PageFilmstrip } from '@/components/editor/page-filmstrip'
import { MediaLibraryPanel, type LibraryPhoto } from '@/components/editor/media-library-panel'
import {
  ContextualToolbar,
  CropGuide,
  DEFAULT_IMAGE_STYLE,
  DEFAULT_TEXT_STYLE,
  PropertiesPanel,
  composeImageTransform,
  type ImageKey,
  type ImageStyle,
  type TextStyle,
} from '@/components/editor/element-controls'
import { cn } from '@/lib/utils'

type Selection = 'none' | ImageKey | 'texto'
type Tool = 'imagem' | null

interface PlacedPhoto {
  id: string
  photo: LibraryPhoto
  xPct: number
  yPct: number
}

const TOOLS = ['Imagem', 'Texto', 'Forma', 'Cor'] as const
const TEXT_Z = 3

const CONTEXTUAL_LABEL: Record<Selection, string> = {
  none: 'Nada selecionado',
  'imagem-principal': 'Imagem selecionada',
  'imagem-secundaria': 'Imagem selecionada',
  texto: 'Texto selecionado',
}

/**
 * Prévia visual do futuro editor de álbum — sem lógica de edição real.
 * Serve para validar a direção de arte (mesa de trabalho editorial, página
 * como protagonista, toolbar contextual) antes da implementação funcional.
 */
export function AlbumEditorPreview() {
  const [activePage, setActivePage] = useState(2)
  const [selection, setSelection] = useState<Selection>('none')
  const [activeTool, setActiveTool] = useState<Tool>(null)
  const [draggingPhoto, setDraggingPhoto] = useState<LibraryPhoto | null>(null)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [isOverPage, setIsOverPage] = useState(false)
  const [placedPhotos, setPlacedPhotos] = useState<PlacedPhoto[]>([])
  const [imageStyles, setImageStyles] = useState<Record<ImageKey, ImageStyle>>({
    'imagem-principal': { ...DEFAULT_IMAGE_STYLE, z: 1 },
    'imagem-secundaria': { ...DEFAULT_IMAGE_STYLE, z: 2 },
  })
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE)
  const pageRef = useRef<HTMLDivElement>(null)
  const isImage = selection === 'imagem-principal' || selection === 'imagem-secundaria'
  const isText = selection === 'texto'
  const hasSelection = selection !== 'none'

  function handleSelectPage(index: number) {
    setActivePage(index)
    setSelection('none')
    setPlacedPhotos([])
    setImageStyles({
      'imagem-principal': { ...DEFAULT_IMAGE_STYLE, z: 1 },
      'imagem-secundaria': { ...DEFAULT_IMAGE_STYLE, z: 2 },
    })
    setTextStyle(DEFAULT_TEXT_STYLE)
  }

  function handleImageStyleChange(patch: Partial<ImageStyle>) {
    if (!isImage) return
    const key = selection as ImageKey
    setImageStyles((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  function handleBringToFront() {
    if (!isImage) return
    const key = selection as ImageKey
    setImageStyles((prev) => {
      const maxZ = Math.max(prev['imagem-principal'].z, prev['imagem-secundaria'].z, TEXT_Z)
      return { ...prev, [key]: { ...prev[key], z: maxZ + 1 } }
    })
  }

  function handleSendToBack() {
    if (!isImage) return
    const key = selection as ImageKey
    setImageStyles((prev) => {
      const minZ = Math.min(prev['imagem-principal'].z, prev['imagem-secundaria'].z, TEXT_Z)
      return { ...prev, [key]: { ...prev[key], z: minZ - 1 } }
    })
  }

  function handlePhotoPointerDown(photo: LibraryPhoto, event: ReactPointerEvent) {
    event.preventDefault()
    setDraggingPhoto(photo)
    setPointer({ x: event.clientX, y: event.clientY })
  }

  useEffect(() => {
    if (!draggingPhoto) return
    const photo = draggingPhoto

    function withinPage(clientX: number, clientY: number) {
      const rect = pageRef.current?.getBoundingClientRect()
      if (!rect) return null
      const inside =
        clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
      return inside ? rect : null
    }

    function handleMove(event: PointerEvent) {
      setPointer({ x: event.clientX, y: event.clientY })
      setIsOverPage(Boolean(withinPage(event.clientX, event.clientY)))
    }

    function handleUp(event: PointerEvent) {
      const rect = withinPage(event.clientX, event.clientY)
      if (rect) {
        setPlacedPhotos((prev) => [
          ...prev,
          {
            id: `placed-${Date.now()}`,
            photo,
            xPct: ((event.clientX - rect.left) / rect.width) * 100,
            yPct: ((event.clientY - rect.top) / rect.height) * 100,
          },
        ])
      }
      setDraggingPhoto(null)
      setIsOverPage(false)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [draggingPhoto])

  return (
    <div className="flex h-screen flex-col bg-white">
      {draggingPhoto ? (
        <div
          className="pointer-events-none fixed z-50 h-16 w-16 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-sm shadow-[0_16px_32px_rgba(0,0,0,0.28)] ring-2 ring-white"
          style={{ left: pointer.x, top: pointer.y }}
        >
          {draggingPhoto.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draggingPhoto.src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className={cn('h-full w-full bg-gradient-to-br', draggingPhoto.tone[0], draggingPhoto.tone[1])}
            />
          )}
        </div>
      ) : null}

      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="shrink-0 text-sm font-bold tracking-tight text-foreground">
            Seu<span className="text-accent">Álbum</span>
          </Link>
          <span className="hidden text-border sm:inline">/</span>
          <p className="hidden truncate text-sm text-muted-foreground sm:block">
            Casamento Marina &amp; Thiago{' '}
            <span className="text-foreground">— Página {ALBUM_PAGES[activePage].number}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="hidden text-xs text-muted-foreground sm:inline">100%</span>
          <Button variant="ghost" size="sm">
            Preview
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-border py-6 md:flex">
          {TOOLS.map((tool) => {
            const isImageTool = tool === 'Imagem'
            const isActive = isImageTool && activeTool === 'imagem'
            return (
              <button
                key={tool}
                type="button"
                onClick={isImageTool ? () => setActiveTool((t) => (t === 'imagem' ? null : 'imagem')) : undefined}
                className={cn(
                  'flex w-12 flex-col items-center gap-1.5 rounded-sm py-2 text-[10px] uppercase tracking-wide transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <span className="h-5 w-5 rounded-sm border border-current" aria-hidden="true" />
                {tool}
              </button>
            )
          })}
        </aside>

        {activeTool === 'imagem' ? (
          <MediaLibraryPanel
            onClose={() => setActiveTool(null)}
            onDragPhoto={handlePhotoPointerDown}
          />
        ) : null}

        <main className="relative flex flex-1 items-center justify-center overflow-auto bg-[#F3F2EF] p-4 sm:p-10 md:p-16">
          <ContextualToolbar
            label={CONTEXTUAL_LABEL[selection]}
            hasSelection={hasSelection}
            isImage={isImage}
            isText={isText}
            imageStyle={isImage ? imageStyles[selection as ImageKey] : undefined}
            onImageChange={handleImageStyleChange}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            textStyle={textStyle}
            onTextChange={(patch) => setTextStyle((prev) => ({ ...prev, ...patch }))}
            selectionKey={selection}
          />

          <div
            key={activePage}
            ref={pageRef}
            className={cn(
              'animate-page-in relative aspect-[3/2] w-full max-w-4xl rounded-sm bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-shadow duration-200',
              isOverPage && 'ring-2 ring-accent ring-offset-4 ring-offset-[#F3F2EF]',
            )}
            onClick={() => setSelection('none')}
          >
            {draggingPhoto ? (
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150',
                  isOverPage && 'opacity-40',
                )}
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
                aria-hidden="true"
              />
            ) : null}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setSelection('imagem-principal')
              }}
              aria-label="Imagem principal"
              style={{ zIndex: imageStyles['imagem-principal'].z }}
              className={cn(
                'absolute left-0 top-0 flex h-full w-[62%] items-center justify-center overflow-hidden rounded-l-sm bg-neutral-100 transition-shadow',
                selection === 'imagem-principal' && 'ring-2 ring-accent ring-offset-2',
              )}
            >
              <div
                style={{
                  transform: composeImageTransform(imageStyles['imagem-principal']),
                  opacity: imageStyles['imagem-principal'].opacity / 100,
                }}
                className={cn(
                  'bg-gradient-to-br from-neutral-300 to-neutral-400 transition-[transform,opacity,width,height] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  imageStyles['imagem-principal'].fit === 'contain' ? 'h-[80%] w-[80%] rounded-sm' : 'h-full w-full',
                )}
              />
              {imageStyles['imagem-principal'].showCropGuide ? <CropGuide /> : null}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setSelection('imagem-secundaria')
              }}
              aria-label="Imagem secundária"
              style={{ zIndex: imageStyles['imagem-secundaria'].z }}
              className={cn(
                'absolute bottom-[6%] right-[6%] flex h-[36%] w-[26%] items-center justify-center overflow-hidden rounded-sm bg-neutral-100 shadow-[0_10px_30px_rgba(0,0,0,0.1)] transition-shadow',
                selection === 'imagem-secundaria' && 'ring-2 ring-accent ring-offset-2',
              )}
            >
              <div
                style={{
                  transform: composeImageTransform(imageStyles['imagem-secundaria']),
                  opacity: imageStyles['imagem-secundaria'].opacity / 100,
                }}
                className={cn(
                  'bg-gradient-to-br from-neutral-200 to-neutral-300 transition-[transform,opacity,width,height] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  imageStyles['imagem-secundaria'].fit === 'contain' ? 'h-[80%] w-[80%] rounded-sm' : 'h-full w-full',
                )}
              />
              {imageStyles['imagem-secundaria'].showCropGuide ? <CropGuide /> : null}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setSelection('texto')
              }}
              aria-label="Bloco de texto"
              style={{ textAlign: textStyle.align, zIndex: TEXT_Z }}
              className={cn(
                'absolute right-[6%] top-[6%] max-w-[42%] rounded-sm px-2 py-1 transition-shadow',
                selection === 'texto' && 'ring-2 ring-accent ring-offset-2',
              )}
            >
              <p
                className="transition-[color,font-size,letter-spacing] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  fontFamily:
                    textStyle.font === 'display'
                      ? 'var(--font-display), Georgia, serif'
                      : 'var(--font-open-sans), Helvetica, Arial, sans-serif',
                  fontSize: `clamp(1rem, 5vw, ${textStyle.size}px)`,
                  fontWeight: textStyle.weight,
                  letterSpacing: `${textStyle.tracking / 100}em`,
                  color: textStyle.color,
                  lineHeight: 1.15,
                }}
              >
                Marina &amp; Thiago
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground sm:text-xs">
                12 . 09 . 2026
              </p>
            </button>

            {placedPhotos.map((item) => (
              <div
                key={item.id}
                className="animate-drop-in pointer-events-none absolute h-[22%] w-[16%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-sm shadow-[0_10px_24px_rgba(0,0,0,0.15)]"
                style={{ left: `${item.xPct}%`, top: `${item.yPct}%` }}
              >
                {item.photo.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photo.src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className={cn('h-full w-full bg-gradient-to-br', item.photo.tone[0], item.photo.tone[1])} />
                )}
              </div>
            ))}
          </div>
        </main>

        <PropertiesPanel
          hasSelection={hasSelection}
          label={CONTEXTUAL_LABEL[selection]}
          isImage={isImage}
          isText={isText}
          imageStyle={isImage ? imageStyles[selection as ImageKey] : undefined}
          onImageChange={handleImageStyleChange}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          textStyle={textStyle}
          onTextChange={(patch) => setTextStyle((prev) => ({ ...prev, ...patch }))}
          selectionKey={selection}
        />
      </div>

      <PageFilmstrip activeIndex={activePage} onSelect={handleSelectPage} />
    </div>
  )
}
