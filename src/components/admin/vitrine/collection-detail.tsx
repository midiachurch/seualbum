'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ImagePlus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { MediaPickerModal } from '@/components/admin/media/media-picker-modal'
import { addPortfolioItems, removePortfolioItem, setCollectionCover } from '@/lib/actions/vitrine'
import { cn } from '@/lib/utils'
import type { MediaAsset, PortfolioCollection, PortfolioItem } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

/** Gestão das fotos de uma coleção — adicionar da biblioteca e escolher a capa. */
export function CollectionDetail({
  collection: initialCollection,
  assets,
}: {
  collection: PortfolioCollection
  assets: MediaAsset[]
}) {
  const [collection, setCollection] = useState(initialCollection)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<PortfolioItem | null>(null)

  const assetOf = (id: string) => assets.find((a) => a.id === id)
  const availableAssets = assets.filter((a) => !collection.itens.some((item) => item.imagemId === a.id))

  function addItems(ids: string[]) {
    const novosItens: PortfolioItem[] = ids.map((imagemId) => ({
      id: `item-novo-${Date.now()}-${imagemId}`,
      imagemId,
      legenda: null,
    }))
    setCollection((prev) => ({
      ...prev,
      itens: [...prev.itens, ...novosItens],
      capaImagemId: prev.capaImagemId ?? novosItens[0]?.imagemId ?? null,
    }))
    if (!DEMO_MODE) addPortfolioItems(collection.id, ids).catch(() => {})
  }

  function removeItem(itemId: string) {
    setCollection((prev) => {
      const item = prev.itens.find((i) => i.id === itemId)
      const itens = prev.itens.filter((i) => i.id !== itemId)
      const capaImagemId = item && item.imagemId === prev.capaImagemId ? (itens[0]?.imagemId ?? null) : prev.capaImagemId
      return { ...prev, itens, capaImagemId }
    })
    if (!DEMO_MODE) removePortfolioItem(itemId, collection.id).catch(() => {})
  }

  function setCapa(imagemId: string) {
    setCollection((prev) => ({ ...prev, capaImagemId: imagemId }))
    if (!DEMO_MODE) setCollectionCover(collection.id, imagemId).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/admin/vitrine/portfolio">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para o portfólio
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{collection.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{collection.descricao}</p>
        </div>
        <Badge variant={collection.status === 'publicado' ? 'success' : 'muted'}>
          {collection.status === 'publicado' ? 'Publicado' : 'Rascunho'}
        </Badge>
      </div>

      <Button size="sm" variant="brand" onClick={() => setPickerOpen(true)}>
        <ImagePlus className="h-4 w-4" aria-hidden />
        Adicionar fotos da biblioteca
      </Button>

      {collection.itens.length === 0 ? (
        <EmptyState title="Nenhuma foto nesta coleção ainda" description="Adicione fotos da biblioteca de mídia para montar a galeria." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {collection.itens.map((item) => {
            const asset = assetOf(item.imagemId)
            const isCapa = item.imagemId === collection.capaImagemId
            return (
              <div key={item.id} className="group relative overflow-hidden rounded-xl border bg-card">
                <div className="aspect-square overflow-hidden bg-secondary">
                  {asset ? (
                    // eslint-disable-next-line @next/next/no-img-element -- thumbnail mock/local (blob:) da biblioteca de mídia.
                    <img src={asset.url} alt={item.legenda ?? ''} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                {isCapa ? (
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold">
                    Capa
                  </span>
                ) : null}
                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-8 w-8 bg-black/50 text-white hover:bg-black/70 hover:text-white', isCapa && 'text-yellow-400')}
                    onClick={() => setCapa(item.imagemId)}
                    aria-label="Definir como capa"
                    disabled={isCapa}
                  >
                    <Star className={cn('h-4 w-4', isCapa && 'fill-yellow-400')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-black/50 text-white hover:bg-black/70 hover:text-white"
                    onClick={() => setRemoveTarget(item)}
                    aria-label="Remover da coleção"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {item.legenda ? <p className="truncate px-2 py-1 text-xs text-muted-foreground">{item.legenda}</p> : null}
              </div>
            )
          })}
        </div>
      )}

      <MediaPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} assets={availableAssets} multi onSelect={addItems} />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeItem(removeTarget.id)}
        title="Remover foto da coleção?"
        description="A imagem continua disponível na biblioteca de mídia, só sai desta galeria."
        confirmLabel="Remover"
      />
    </div>
  )
}
