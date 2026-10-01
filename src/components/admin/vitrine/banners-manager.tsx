'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { MediaPickerModal } from '@/components/admin/media/media-picker-modal'
import { createBanner, deleteBanner, reorderBanners, toggleBannerActive, updateBanner } from '@/lib/actions/vitrine'
import { cn } from '@/lib/utils'
import type { Banner, MediaAsset } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

interface FormState {
  imagemId: string
  titulo: string
  subtitulo: string
  linkCta: string
}

const EMPTY_FORM: FormState = { imagemId: '', titulo: '', subtitulo: '', linkCta: '' }

/**
 * Gestão de banners (seção 19). Reordenar arrasta e solta (HTML5 drag nativo,
 * sem lib) — as setas ficam como alternativa acessível pra quem não usa mouse.
 */
export function BannersManager({ initialBanners, assets }: { initialBanners: Banner[]; assets: MediaAsset[] }) {
  const [banners, setBanners] = useState<Banner[]>(() => [...initialBanners].sort((a, b) => a.ordem - b.ordem))
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const assetOf = (id: string) => assets.find((a) => a.id === id)

  function renumber(list: Banner[]) {
    return list.map((b, i) => ({ ...b, ordem: i + 1 }))
  }

  function startAdd() {
    setForm(EMPTY_FORM)
    setEditingId('new')
  }

  function startEdit(banner: Banner) {
    setForm({ imagemId: banner.imagemId, titulo: banner.titulo, subtitulo: banner.subtitulo, linkCta: banner.linkCta })
    setEditingId(banner.id)
  }

  function cancel() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function persistOrder(list: Banner[]) {
    if (!DEMO_MODE) reorderBanners(list.map((b) => b.id)).catch(() => {})
  }

  function save() {
    if (!form.titulo.trim() || !form.imagemId) return
    if (editingId === 'new') {
      const novo: Banner = {
        id: `banner-novo-${Date.now()}`,
        imagemId: form.imagemId,
        titulo: form.titulo,
        subtitulo: form.subtitulo,
        linkCta: form.linkCta,
        ativo: true,
        ordem: banners.length + 1,
      }
      setBanners((prev) => [...prev, novo])
      if (!DEMO_MODE) createBanner({ ...form, ordem: banners.length + 1 }).catch(() => {})
    } else if (editingId) {
      setBanners((prev) => prev.map((b) => (b.id === editingId ? { ...b, ...form } : b)))
      if (!DEMO_MODE) updateBanner(editingId, form).catch(() => {})
    }
    cancel()
  }

  function remove(id: string) {
    setBanners((prev) => renumber(prev.filter((b) => b.id !== id)))
    if (!DEMO_MODE) deleteBanner(id).catch(() => {})
  }

  function toggleActive(id: string) {
    const ativo = !banners.find((b) => b.id === id)?.ativo
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ativo } : b)))
    if (!DEMO_MODE) toggleBannerActive(id, Boolean(ativo)).catch(() => {})
  }

  function move(id: string, direction: -1 | 1) {
    setBanners((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      const swapIdx = idx + direction
      if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]]
      const renumerado = renumber(copy)
      persistOrder(renumerado)
      return renumerado
    })
  }

  function onDrop(overId: string) {
    if (!draggedId || draggedId === overId) {
      setDraggedId(null)
      return
    }
    setBanners((prev) => {
      const fromIdx = prev.findIndex((b) => b.id === draggedId)
      const toIdx = prev.findIndex((b) => b.id === overId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const copy = [...prev]
      const [moved] = copy.splice(fromIdx, 1)
      copy.splice(toIdx, 0, moved)
      const renumerado = renumber(copy)
      persistOrder(renumerado)
      return renumerado
    })
    setDraggedId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Banners</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste para reordenar a prioridade de exibição no site. {banners.length} banner(s).
          </p>
        </div>
        <Button size="sm" variant="brand" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Novo banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <EmptyState title="Nenhum banner cadastrado" description="Crie o primeiro banner da página inicial." />
      ) : (
        <ul className="space-y-3">
          {banners.map((banner) => {
            const asset = assetOf(banner.imagemId)
            return (
              <li
                key={banner.id}
                draggable
                onDragStart={() => setDraggedId(banner.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(banner.id)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border bg-card p-3 transition-opacity',
                  draggedId === banner.id && 'opacity-40',
                )}
              >
                <span className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden>
                  <GripVertical className="h-5 w-5" />
                </span>
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(banner.id, -1)} aria-label="Mover para cima">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(banner.id, 1)} aria-label="Mover para baixo">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  {asset ? (
                    // eslint-disable-next-line @next/next/no-img-element -- thumbnail mock/local (blob:) da biblioteca de mídia.
                    <img src={asset.url} alt={banner.titulo} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{banner.titulo}</p>
                  <p className="truncate text-sm text-muted-foreground">{banner.subtitulo}</p>
                  <p className="text-xs text-muted-foreground">CTA → {banner.linkCta || '—'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={banner.ativo}
                    onCheckedChange={() => toggleActive(banner.id)}
                    className="data-[state=checked]:bg-[#171717]"
                    aria-label={banner.ativo ? 'Desativar banner' : 'Ativar banner'}
                  />
                  <Button variant="ghost" size="icon" onClick={() => startEdit(banner)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(banner)} aria-label="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={editingId !== null} onClose={cancel} title={editingId === 'new' ? 'Novo banner' : 'Editar banner'}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Imagem</Label>
            {form.imagemId ? (
              <div className="relative h-32 w-full overflow-hidden rounded-xl bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview mock/local (blob:) da imagem escolhida. */}
                <img src={assetOf(form.imagemId)?.url} alt="" className="h-full w-full object-cover" />
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute bottom-2 right-2 bg-white"
                  onClick={() => setPickerOpen(true)}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setPickerOpen(true)}>
                <ImagePlus className="h-4 w-4" aria-hidden />
                Escolher da biblioteca de mídia
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="banner-titulo">Título</Label>
            <Input id="banner-titulo" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="banner-subtitulo">Subtítulo</Label>
            <Input id="banner-subtitulo" value={form.subtitulo} onChange={(e) => setForm((f) => ({ ...f, subtitulo: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="banner-link">Link de destino (CTA)</Label>
            <Input id="banner-link" value={form.linkCta} onChange={(e) => setForm((f) => ({ ...f, linkCta: e.target.value }))} placeholder="/precos" />
          </div>
          <div className={MODAL_ACOES}>
            <Button variant="outline" onClick={cancel}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={save} disabled={!form.titulo.trim() || !form.imagemId}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assets={assets}
        onSelect={([id]) => setForm((f) => ({ ...f, imagemId: id }))}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget.id)}
        title="Excluir banner?"
        description={`"${deleteTarget?.titulo}" deixará de aparecer no site imediatamente.`}
      />
    </div>
  )
}
