'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { ImageUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { deleteMediaAsset, registerMediaAsset } from '@/lib/actions/vitrine'
import { uploadMediaAsset } from '@/lib/upload-media-asset'
import { formatDate } from '@/lib/utils'
import { MEDIA_TAGS, type MediaAsset, type MediaTag } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Biblioteca de mídia central (seção 20) — estilo WordPress/Shopify. Upload
 * lê dimensões e tamanho reais do arquivo (via `Image()` e `file.size`). Fora
 * do modo de demonstração, o arquivo sobe de verdade para o bucket público
 * `midia_vitrine` e vira uma linha em `media_assets`.
 */
export function MediaLibrary({ initialAssets }: { initialAssets: MediaAsset[] }) {
  const [assets, setAssets] = useState<MediaAsset[]>(initialAssets)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<'todas' | MediaTag>('todas')
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return assets.filter((asset) => {
      const matchesSearch = !term || asset.nome.toLowerCase().includes(term)
      const matchesTag = tagFilter === 'todas' || asset.tags.includes(tagFilter)
      return matchesSearch && matchesTag
    })
  }, [assets, search, tagFilter])

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return
    Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .forEach((file) => {
        const previewUrl = URL.createObjectURL(file)
        const img = new window.Image()
        img.onload = async () => {
          const larguraPx = img.naturalWidth
          const alturaPx = img.naturalHeight
          const tamanhoKb = Math.round(file.size / 1024)

          if (DEMO_MODE) {
            const novo: MediaAsset = {
              id: `media-novo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              url: previewUrl,
              nome: file.name,
              tags: ['Geral'],
              larguraPx,
              alturaPx,
              tamanhoKb,
              criadoEm: new Date().toISOString(),
            }
            setAssets((prev) => [novo, ...prev])
            return
          }

          try {
            const { storagePath, url } = await uploadMediaAsset(file)
            const id = await registerMediaAsset({ storagePath, url, nome: file.name, tags: ['Geral'], larguraPx, alturaPx, tamanhoKb })
            setAssets((prev) => [{ id, url, nome: file.name, tags: ['Geral'], larguraPx, alturaPx, tamanhoKb, criadoEm: new Date().toISOString() }, ...prev])
          } finally {
            URL.revokeObjectURL(previewUrl)
          }
        }
        img.src = previewUrl
      })
  }, [])

  function remove(asset: MediaAsset) {
    setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    setSelected(null)
    if (!DEMO_MODE) {
      const storagePath = asset.url.split('/midia_vitrine/')[1] ?? ''
      deleteMediaAsset(asset.id, storagePath).catch(() => {})
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Biblioteca de mídia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {assets.length} {assets.length === 1 ? 'arquivo' : 'arquivos'} — usados em banners, portfólio e páginas do site.
        </p>
      </div>

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
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragActive ? 'border-foreground bg-secondary/40' : 'border-border hover:border-foreground/40'
        }`}
      >
        <ImageUp className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">Arraste imagens aqui, ou clique para selecionar</p>
        <p className="text-sm text-muted-foreground">JPG, PNG ou WEBP</p>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome…" className="max-w-xs" />
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={tagFilter === 'todas' ? 'brand' : 'outline'} onClick={() => setTagFilter('todas')}>
            Todas
          </Button>
          {MEDIA_TAGS.map((tag) => (
            <Button key={tag} size="sm" variant={tagFilter === tag ? 'brand' : 'outline'} onClick={() => setTagFilter(tag)}>
              {tag}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum arquivo encontrado" description="Ajuste os filtros ou envie novas imagens." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelected(asset)}
              className="group overflow-hidden rounded-xl border bg-card text-left transition-shadow hover:shadow-md"
            >
              <div className="aspect-square overflow-hidden bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element -- galeria mock/local (blob:), next/image não serve blob e cache local corrompe no volume externo. */}
                <img src={asset.url} alt={asset.nome} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium">{asset.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {asset.larguraPx}×{asset.alturaPx}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.nome}>
        {selected ? (
          <div className="space-y-4">
            <div className="aspect-video overflow-hidden rounded-xl bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview de detalhe, mesma origem mock/local da galeria. */}
              <img src={selected.url} alt={selected.nome} className="h-full w-full object-contain" />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Dimensões</dt>
                <dd className="mt-0.5 font-medium">
                  {selected.larguraPx} × {selected.alturaPx} px
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tamanho</dt>
                <dd className="mt-0.5 font-medium">{selected.tamanhoKb} KB</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Enviado em</dt>
                <dd className="mt-0.5 font-medium">{formatDate(selected.criadoEm)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tags</dt>
                <dd className="mt-0.5 flex flex-wrap gap-1">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
                      {tag}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end">
              <Button
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setDeleteTarget(selected)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Excluir arquivo
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Excluir arquivo?"
        description={`"${deleteTarget?.nome}" será removido da biblioteca. Se estiver em uso num banner ou coleção, o espaço da imagem ficará vazio lá.`}
      />
    </div>
  )
}
