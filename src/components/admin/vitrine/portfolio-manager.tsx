'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { MediaPickerModal } from '@/components/admin/media/media-picker-modal'
import { createCollection, deleteCollection, updateCollection } from '@/lib/actions/vitrine'
import type { MediaAsset, PortfolioCollection } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

interface FormState {
  nome: string
  descricao: string
  status: PortfolioCollection['status']
  capaImagemId: string | null
}

const EMPTY_FORM: FormState = { nome: '', descricao: '', status: 'rascunho', capaImagemId: null }

/** Coleções do portfólio (seção 19) — a listagem; a gestão das fotos de cada uma vive em [id]. */
export function PortfolioManager({
  initialCollections,
  assets,
}: {
  initialCollections: PortfolioCollection[]
  assets: MediaAsset[]
}) {
  const [collections, setCollections] = useState<PortfolioCollection[]>(
    () => [...initialCollections].sort((a, b) => a.ordem - b.ordem),
  )
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PortfolioCollection | null>(null)

  const assetOf = (id: string | null) => assets.find((a) => a.id === id)

  function startAdd() {
    setForm(EMPTY_FORM)
    setEditingId('new')
  }

  function startEdit(collection: PortfolioCollection) {
    setForm({
      nome: collection.nome,
      descricao: collection.descricao,
      status: collection.status,
      capaImagemId: collection.capaImagemId,
    })
    setEditingId(collection.id)
  }

  function cancel() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function save() {
    if (!form.nome.trim()) return
    if (editingId === 'new') {
      const nova: PortfolioCollection = {
        id: `colecao-nova-${Date.now()}`,
        nome: form.nome,
        descricao: form.descricao,
        capaImagemId: form.capaImagemId,
        status: form.status,
        ordem: collections.length + 1,
        itens: [],
      }
      setCollections((prev) => [...prev, nova])
      if (!DEMO_MODE) createCollection({ ...form, ordem: collections.length + 1 }).catch(() => {})
    } else if (editingId) {
      setCollections((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...form } : c)))
      if (!DEMO_MODE) updateCollection(editingId, form).catch(() => {})
    }
    cancel()
  }

  function remove(id: string) {
    setCollections((prev) => prev.filter((c) => c.id !== id))
    if (!DEMO_MODE) deleteCollection(id).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfólio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {collections.length} {collections.length === 1 ? 'coleção' : 'coleções'}.
          </p>
        </div>
        <Button size="sm" variant="brand" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova coleção
        </Button>
      </div>

      {collections.length === 0 ? (
        <EmptyState title="Nenhuma coleção ainda" description="Crie a primeira coleção para começar a vender seu trabalho." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => {
            const capa = assetOf(collection.capaImagemId)
            return (
              <div key={collection.id} className="overflow-hidden rounded-2xl border bg-card">
                <div className="relative aspect-video bg-secondary">
                  {capa ? (
                    // eslint-disable-next-line @next/next/no-img-element -- thumbnail mock/local (blob:) da biblioteca de mídia.
                    <img src={capa.url} alt={collection.nome} className="h-full w-full object-cover" />
                  ) : null}
                  <Badge
                    variant={collection.status === 'publicado' ? 'success' : 'muted'}
                    className="absolute left-2 top-2"
                  >
                    {collection.status === 'publicado' ? 'Publicado' : 'Rascunho'}
                  </Badge>
                </div>
                <div className="p-4">
                  <p className="font-semibold">{collection.nome}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{collection.descricao}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {collection.itens.length} {collection.itens.length === 1 ? 'foto' : 'fotos'}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Button asChild size="sm" variant="brand">
                      <Link href={`/admin/vitrine/portfolio/${collection.id}`}>
                        <ImagePlus className="h-4 w-4" aria-hidden />
                        Gerenciar fotos
                      </Link>
                    </Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(collection)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(collection)} aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={editingId !== null} onClose={cancel} title={editingId === 'new' ? 'Nova coleção' : 'Editar coleção'}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Capa</Label>
            {form.capaImagemId ? (
              <div className="relative h-32 w-full overflow-hidden rounded-xl bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview mock/local (blob:) da imagem escolhida. */}
                <img src={assetOf(form.capaImagemId)?.url} alt="" className="h-full w-full object-cover" />
                <Button size="sm" variant="outline" className="absolute bottom-2 right-2 bg-white" onClick={() => setPickerOpen(true)}>
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
            <Label htmlFor="colecao-nome">Nome</Label>
            <Input id="colecao-nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Casamentos" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="colecao-descricao">Descrição</Label>
            <Input id="colecao-descricao" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="colecao-status">Status</Label>
            <select
              id="colecao-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FormState['status'] }))}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="rascunho">Rascunho</option>
              <option value="publicado">Publicado</option>
            </select>
          </div>
          <div className={MODAL_ACOES}>
            <Button variant="outline" onClick={cancel}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={save} disabled={!form.nome.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assets={assets}
        onSelect={([id]) => setForm((f) => ({ ...f, capaImagemId: id }))}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget.id)}
        title="Excluir coleção?"
        description={`"${deleteTarget?.nome}" e suas ${deleteTarget?.itens.length ?? 0} fotos serão removidas do portfólio público.`}
      />
    </div>
  )
}
