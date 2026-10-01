'use client'

import { useState } from 'react'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { createPagina, deletePagina, type PaginaInput, updatePagina } from '@/lib/actions/paginas'
import { formatDate } from '@/lib/utils'
import type { PaginaConteudo } from '@/types/platform'

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const EMPTY_FORM: PaginaInput = { slug: '', titulo: '', conteudoHtml: '', seoDescription: '', status: 'rascunho' }

/**
 * CMS no-code de páginas do site (seção "CMS No-Code Avançado"). Sem rota
 * dedicada de edição de propósito — o formulário completo (com o editor
 * rich-text) abre inline, substituindo a listagem, para não precisar de mais
 * uma tela só para isso.
 */
export function PaginasManager({ initialPaginas }: { initialPaginas: PaginaConteudo[] }) {
  const [paginas, setPaginas] = useState(initialPaginas)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<PaginaInput>(EMPTY_FORM)
  const [slugTocado, setSlugTocado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PaginaConteudo | null>(null)

  function startAdd() {
    setForm(EMPTY_FORM)
    setSlugTocado(false)
    setErro(null)
    setEditingId('new')
  }

  function startEdit(pagina: PaginaConteudo) {
    setForm({ slug: pagina.slug, titulo: pagina.titulo, conteudoHtml: pagina.conteudoHtml, seoDescription: pagina.seoDescription ?? '', status: pagina.status })
    setSlugTocado(true)
    setErro(null)
    setEditingId(pagina.id)
  }

  function cancel() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function save() {
    if (!form.titulo.trim() || !form.slug.trim()) return
    setSalvando(true)
    setErro(null)
    try {
      if (editingId === 'new') {
        const id = await createPagina(form)
        setPaginas((prev) => [{ id, ...form, seoDescription: form.seoDescription || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev])
      } else if (editingId) {
        await updatePagina(editingId, form)
        setPaginas((prev) =>
          prev.map((p) => (p.id === editingId ? { ...p, ...form, seoDescription: form.seoDescription || null, updatedAt: new Date().toISOString() } : p)),
        )
      }
      cancel()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a página.')
    } finally {
      setSalvando(false)
    }
  }

  function remove(pagina: PaginaConteudo) {
    setPaginas((prev) => prev.filter((p) => p.id !== pagina.id))
    deletePagina(pagina.id, pagina.slug).catch(() => {})
  }

  if (editingId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{editingId === 'new' ? 'Nova página' : 'Editar página'}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancel}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={save} disabled={!form.titulo.trim() || !form.slug.trim() || salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>

        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pg-titulo">Título</Label>
            <Input
              id="pg-titulo"
              value={form.titulo}
              onChange={(e) => {
                const titulo = e.target.value
                setForm((f) => ({ ...f, titulo, slug: slugTocado ? f.slug : slugify(titulo) }))
              }}
              placeholder="Como funciona"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pg-slug">
              Slug — a página fica em <code className="text-xs">/p/{form.slug || '...'}</code>
            </Label>
            <Input
              id="pg-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTocado(true)
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }))
              }}
              placeholder="como-funciona"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pg-seo">Descrição para SEO</Label>
            <Input
              id="pg-seo"
              value={form.seoDescription}
              onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
              placeholder="Aparece nos resultados de busca e ao compartilhar o link."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pg-status">Status</Label>
            <select
              id="pg-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PaginaInput['status'] }))}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="rascunho">Rascunho</option>
              <option value="publicado">Publicado</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Conteúdo</Label>
          <RichTextEditor key={editingId} initialValue={form.conteudoHtml} onChange={(html) => setForm((f) => ({ ...f, conteudoHtml: html }))} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Páginas do site</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {paginas.length} {paginas.length === 1 ? 'página' : 'páginas'} — criadas sem precisar mexer em código.
          </p>
        </div>
        <Button size="sm" variant="brand" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova página
        </Button>
      </div>

      {paginas.length === 0 ? (
        <EmptyState title="Nenhuma página criada ainda" description="Crie a primeira página institucional, como 'Como funciona' ou 'Termos de uso'." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Título</th>
                <th scope="col" className="px-4 py-3 font-semibold">Slug</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Atualizado</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginas.map((pagina) => (
                <tr key={pagina.id}>
                  <td className="px-4 py-3 font-medium">{pagina.titulo}</td>
                  <td className="px-4 py-3 text-muted-foreground">/p/{pagina.slug}</td>
                  <td className="px-4 py-3">
                    <Badge variant={pagina.status === 'publicado' ? 'success' : 'muted'}>
                      {pagina.status === 'publicado' ? 'Publicado' : 'Rascunho'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(pagina.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {pagina.status === 'publicado' ? (
                        <Button asChild variant="ghost" size="icon" aria-label="Ver página">
                          <a href={`/p/${pagina.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="icon" onClick={() => startEdit(pagina)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(pagina)} aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Excluir página?"
        description={`"${deleteTarget?.titulo}" sai do ar imediatamente se estiver publicada.`}
      />
    </div>
  )
}
