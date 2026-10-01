'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import type { MediaAsset } from '@/types/platform'

/** Seletor de imagens da biblioteca de mídia, reusado por Banners e Portfólio. */
export function MediaPickerModal({
  open,
  onClose,
  assets,
  multi = false,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  assets: MediaAsset[]
  multi?: boolean
  onSelect: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return assets.filter((a) => !term || a.nome.toLowerCase().includes(term))
  }, [assets, search])

  function toggle(id: string) {
    if (!multi) {
      onSelect([id])
      onClose()
      return
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  function confirm() {
    if (selected.length === 0) return
    onSelect(selected)
    setSelected([])
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Escolher da biblioteca de mídia" className="max-w-2xl">
      <div className="space-y-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome…" />
        <div className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
          {filtered.map((asset) => {
            const isSelected = selected.includes(asset.id)
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => toggle(asset.id)}
                className={cn(
                  'group relative overflow-hidden rounded-xl border-2 text-left',
                  isSelected ? 'border-foreground' : 'border-transparent hover:border-border',
                )}
              >
                <div className="aspect-square overflow-hidden bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element -- seletor mock/local (blob:) da biblioteca de mídia. */}
                  <img src={asset.url} alt={asset.nome} className="h-full w-full object-cover" />
                </div>
                {isSelected ? (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : null}
                <p className="truncate px-1.5 py-1 text-[11px]">{asset.nome}</p>
              </button>
            )
          })}
        </div>
        {multi ? (
          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">{selected.length} selecionada(s)</p>
            <Button variant="brand" onClick={confirm} disabled={selected.length === 0}>
              Adicionar
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
