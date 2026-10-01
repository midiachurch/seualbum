'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatBRL } from '@/lib/utils'
import type { AlbumOption } from '@/types/catalog'

const SEED_CATALOG: AlbumOption[] = [
  {
    id: 'formato-20x20',
    name: '20 × 20',
    description: 'Compacto e versátil — ideal para ensaios, mini álbuns e presentes.',
    image: 'https://picsum.photos/seed/album-20x20/960/540',
  },
  {
    id: 'formato-25x25',
    name: '25 × 25',
    description: 'O equilíbrio entre presença na estante e portabilidade no dia a dia.',
    image: 'https://picsum.photos/seed/album-25x25/960/540',
  },
  {
    id: 'formato-30x30',
    name: '30 × 30',
    description: 'Nosso formato mais escolhido para casamentos e grandes celebrações.',
    image: 'https://picsum.photos/seed/album-30x30/960/540',
  },
  {
    id: 'formato-30x40',
    name: '30 × 40',
    description: 'Para histórias que pedem mais espaço e impacto em cada lâmina.',
    image: 'https://picsum.photos/seed/album-30x40/960/540',
  },
]

interface FormState {
  name: string
  description: string
  image: string
  price: string
}

const EMPTY_FORM: FormState = { name: '', description: '', image: '', price: '' }

/**
 * Gestão da vitrine pública (/albuns). Prévia funcional com estado local —
 * ainda sem persistência: ao conectar o Supabase, os handlers viram server actions.
 */
export function CatalogManager() {
  const [items, setItems] = useState<AlbumOption[]>(SEED_CATALOG)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  function startAdd() {
    setForm(EMPTY_FORM)
    setEditingId('new')
  }

  function startEdit(item: AlbumOption) {
    setForm({
      name: item.name,
      description: item.description,
      image: item.image,
      price: item.price ? String(item.price) : '',
    })
    setEditingId(item.id)
  }

  function cancel() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function save() {
    if (!form.name.trim()) return
    const price = form.price.trim() ? Number(form.price) : undefined

    if (editingId === 'new') {
      const id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      setItems((prev) => [...prev, { id, name: form.name, description: form.description, image: form.image, price }])
    } else if (editingId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? { ...item, name: form.name, description: form.description, image: form.image, price }
            : item,
        ),
      )
    }
    cancel()
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
    if (editingId === id) cancel()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Vitrine — Álbuns</h2>
          <p className="text-sm text-muted-foreground">
            Itens exibidos publicamente em /albuns. {items.length} {items.length === 1 ? 'item' : 'itens'}.
          </p>
        </div>
        {editingId === null ? (
          <Button size="sm" variant="brand" onClick={startAdd}>
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar item
          </Button>
        ) : null}
      </div>

      {editingId !== null ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {editingId === 'new' ? 'Novo item' : 'Editar item'}
            </h3>
            <Button variant="ghost" size="icon" onClick={cancel} aria-label="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="catalog-name">Nome</Label>
              <Input
                id="catalog-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: 35 × 35"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="catalog-price">Preço (opcional)</Label>
              <Input
                id="catalog-price"
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="Deixe em branco para “A definir”"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="catalog-image">URL da imagem</Label>
              <Input
                id="catalog-image"
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="catalog-description">Descrição</Label>
              <Input
                id="catalog-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Frase curta sobre o item"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancel}>
              Cancelar
            </Button>
            <Button size="sm" variant="brand" onClick={save} disabled={!form.name.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 rounded-2xl border bg-card p-4">
            <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-secondary">
              <Image src={item.image} alt={item.name} fill unoptimized className="object-cover grayscale" />
            </div>
            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{item.name}</p>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(item)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(item.id)} aria-label="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              <p className="mt-auto pt-2 text-sm font-medium">
                {item.price ? formatBRL(item.price) : 'A definir'}
              </p>
            </div>
          </div>
        ))}

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground sm:col-span-2">
            Nenhum item na vitrine ainda.
          </p>
        ) : null}
      </div>
    </div>
  )
}
