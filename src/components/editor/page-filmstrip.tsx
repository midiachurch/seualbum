'use client'

import { cn } from '@/lib/utils'

export type PageLayout = 'cover' | 'image-text' | 'spread' | 'split' | 'band' | 'full'

export interface AlbumPageSummary {
  number: number
  layout: PageLayout
}

export const ALBUM_PAGES: AlbumPageSummary[] = [
  { number: 1, layout: 'cover' },
  { number: 2, layout: 'image-text' },
  { number: 3, layout: 'spread' },
  { number: 4, layout: 'split' },
  { number: 5, layout: 'band' },
  { number: 6, layout: 'full' },
]

function MiniLayout({ layout }: { layout: PageLayout }) {
  switch (layout) {
    case 'cover':
      return <div className="absolute inset-0 bg-gradient-to-br from-neutral-300 to-neutral-400" />
    case 'image-text':
      return (
        <>
          <div className="absolute inset-y-0 left-0 w-3/5 bg-gradient-to-br from-neutral-300 to-neutral-400" />
          <div className="absolute right-2 top-2.5 h-0.5 w-6 bg-neutral-300" />
          <div className="absolute right-2 top-4 h-0.5 w-4 bg-neutral-200" />
        </>
      )
    case 'spread':
      return (
        <>
          <div className="absolute inset-y-0 left-0 w-3/5 bg-gradient-to-br from-neutral-300 to-neutral-400" />
          <div className="absolute right-1.5 top-1.5 h-1.5 w-8 bg-neutral-300" />
          <div className="absolute bottom-1.5 right-1.5 h-3 w-4 bg-neutral-200" />
        </>
      )
    case 'split':
      return (
        <>
          <div className="absolute inset-y-0 left-0 w-[46%] bg-gradient-to-br from-neutral-300 to-neutral-400" />
          <div className="absolute inset-y-0 right-0 w-[46%] bg-gradient-to-br from-neutral-200 to-neutral-300" />
        </>
      )
    case 'band':
      return (
        <>
          <div className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-br from-neutral-300 to-neutral-400" />
          <div className="absolute bottom-1.5 left-2 h-0.5 w-8 bg-neutral-300" />
        </>
      )
    case 'full':
      return <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 to-neutral-400" />
  }
}

interface PageFilmstripProps {
  activeIndex: number
  onSelect: (index: number) => void
}

/**
 * Navegação por thumbnails do álbum — cada item é uma miniatura real do
 * layout da página (diretriz 10), não texto. Número e ações contextuais só
 * aparecem no hover (diretriz 11), com transição curta e easing natural
 * (diretriz 12).
 */
export function PageFilmstrip({ activeIndex, onSelect }: PageFilmstripProps) {
  return (
    <footer className="flex h-28 shrink-0 items-center gap-4 overflow-x-auto border-t border-border px-4 sm:px-6">
      {ALBUM_PAGES.map((page, index) => {
        const isActive = index === activeIndex

        return (
          <button
            key={page.number}
            type="button"
            onClick={() => onSelect(index)}
            aria-label={`Página ${page.number}`}
            aria-current={isActive}
            className={cn(
              'group relative h-16 w-24 shrink-0 overflow-hidden rounded-sm bg-white transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
              'hover:-translate-y-1 hover:scale-[1.05] hover:shadow-[0_12px_24px_rgba(0,0,0,0.12)]',
              isActive
                ? 'shadow-[0_8px_20px_rgba(0,0,0,0.1)] ring-1 ring-accent'
                : 'shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-border',
            )}
          >
            <MiniLayout layout={page.layout} />

            {isActive ? (
              <span className="absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-foreground transition-opacity duration-150 group-hover:opacity-0">
                {page.number}
              </span>
            ) : null}

            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/85 opacity-0 backdrop-blur-[1px] transition-opacity duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
              aria-hidden="true"
            >
              <span className="text-sm font-medium text-foreground">{page.number}</span>
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="transition-colors hover:text-foreground">Editar</span>
                <span className="h-2.5 w-px bg-border" />
                <span className="transition-colors hover:text-destructive">Excluir</span>
              </span>
            </div>
          </button>
        )
      })}
    </footer>
  )
}
