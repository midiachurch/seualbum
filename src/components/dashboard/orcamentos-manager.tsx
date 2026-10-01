'use client'

import { useState } from 'react'
import { Copy, ImageUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { createOrcamento, deleteOrcamento, markOrcamentoEnviado, updateFotografoLogo, updateOrcamento } from '@/lib/actions/orcamentos'
import { uploadFotografoLogo } from '@/lib/upload-fotografo-logo'
import { formatBRL, formatDate } from '@/lib/utils'
import type { ItemOrcamento, Orcamento, Produto } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

interface FormState {
  clienteFinalNome: string
  clienteFinalContato: string
  itens: ItemOrcamento[]
}

const EMPTY_FORM: FormState = { clienteFinalNome: '', clienteFinalContato: '', itens: [] }

/**
 * CRM de orçamentos do fotógrafo (seção "Upgrade B2B"). Ele escolhe produtos
 * do nosso catálogo mas define o próprio preço de venda (markup) — o valor
 * que a plataforma cobra dele nunca aparece aqui nem no link público.
 */
export function OrcamentosManager({
  fotografoId,
  initialOrcamentos,
  produtos,
  logoUrl,
  siteUrl,
}: {
  fotografoId: string
  initialOrcamentos: Orcamento[]
  produtos: Produto[]
  logoUrl: string | null
  siteUrl: string
}) {
  const [orcamentos, setOrcamentos] = useState(initialOrcamentos)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Orcamento | null>(null)
  const [logo, setLogo] = useState(logoUrl)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const total = form.itens.reduce((soma, item) => soma + item.quantidade * item.valorUnitario, 0)

  function startAdd() {
    setForm(EMPTY_FORM)
    setErro(null)
    setEditingId('new')
  }

  function startEdit(orcamento: Orcamento) {
    setForm({ clienteFinalNome: orcamento.clienteFinalNome, clienteFinalContato: orcamento.clienteFinalContato ?? '', itens: orcamento.itens })
    setErro(null)
    setEditingId(orcamento.id)
  }

  function cancel() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function addItem(produto?: Produto) {
    const novo: ItemOrcamento = produto
      ? { produtoId: produto.id, descricao: produto.nome, quantidade: 1, valorUnitario: produto.precoBase }
      : { produtoId: null, descricao: '', quantidade: 1, valorUnitario: 0 }
    setForm((f) => ({ ...f, itens: [...f.itens, novo] }))
  }

  function updateItem(index: number, patch: Partial<ItemOrcamento>) {
    setForm((f) => ({ ...f, itens: f.itens.map((item, i) => (i === index ? { ...item, ...patch } : item)) }))
  }

  function removeItem(index: number) {
    setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== index) }))
  }

  async function save() {
    if (!form.clienteFinalNome.trim() || form.itens.length === 0) return
    setSalvando(true)
    setErro(null)
    try {
      if (editingId === 'new') {
        const { id } = await createOrcamento(form)
        setOrcamentos((prev) => [
          { id, fotografoId, clienteFinalNome: form.clienteFinalNome, clienteFinalContato: form.clienteFinalContato || null, itens: form.itens, valorTotal: total, hashPublico: id, status: 'rascunho', createdAt: new Date().toISOString() },
          ...prev,
        ])
      } else if (editingId) {
        await updateOrcamento(editingId, form)
        setOrcamentos((prev) =>
          prev.map((o) =>
            o.id === editingId
              ? { ...o, clienteFinalNome: form.clienteFinalNome, clienteFinalContato: form.clienteFinalContato || null, itens: form.itens, valorTotal: total }
              : o,
          ),
        )
      }
      cancel()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o orçamento.')
    } finally {
      setSalvando(false)
    }
  }

  function remove(orcamento: Orcamento) {
    setOrcamentos((prev) => prev.filter((o) => o.id !== orcamento.id))
    if (!DEMO_MODE) deleteOrcamento(orcamento.id).catch(() => {})
  }

  function copyLink(orcamento: Orcamento) {
    const url = `${siteUrl}/orcamento/${orcamento.hashPublico}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedId(orcamento.id)
    setTimeout(() => setCopiedId(null), 2000)
    if (orcamento.status === 'rascunho' && !DEMO_MODE) {
      markOrcamentoEnviado(orcamento.id).catch(() => {})
      setOrcamentos((prev) => prev.map((o) => (o.id === orcamento.id ? { ...o, status: 'enviado' } : o)))
    }
  }

  async function handleLogoUpload(file: File) {
    try {
      const url = await uploadFotografoLogo(fotografoId, file)
      setLogo(url)
      if (!DEMO_MODE) await updateFotografoLogo(url)
    } catch {
      // upload de logo é cosmético — falha silenciosa não trava o fluxo principal de orçamentos.
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus orçamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monte propostas para os seus clientes com o seu próprio preço de venda, prontas pra enviar no WhatsApp.
          </p>
        </div>
        <Button size="sm" variant="brand" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Novo orçamento
        </Button>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo do estúdio, URL pública dinâmica do Storage.
            <img src={logo} alt="Logo do estúdio" className="h-full w-full object-contain" />
          ) : (
            <ImageUp className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Logo do estúdio</p>
          <p className="text-xs text-muted-foreground">Aparece na tela pública dos seus orçamentos.</p>
        </div>
        <label className="cursor-pointer">
          <span className="inline-flex h-9 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-secondary">
            {logo ? 'Trocar' : 'Enviar logo'}
          </span>
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleLogoUpload(file)
            }}
          />
        </label>
      </div>

      {orcamentos.length === 0 ? (
        <EmptyState title="Nenhum orçamento criado ainda" description="Monte o primeiro orçamento pra mandar pro seu próximo cliente." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Cliente</th>
                <th scope="col" className="px-4 py-3 font-semibold">Valor</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Criado em</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orcamentos.map((orcamento) => (
                <tr key={orcamento.id}>
                  <td className="px-4 py-3 font-medium">{orcamento.clienteFinalNome}</td>
                  <td className="px-4 py-3">{formatBRL(orcamento.valorTotal)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={orcamento.status === 'enviado' ? 'success' : 'muted'}>
                      {orcamento.status === 'enviado' ? 'Enviado' : 'Rascunho'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(orcamento.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => copyLink(orcamento)}>
                        <Copy className="h-4 w-4" aria-hidden />
                        {copiedId === orcamento.id ? 'Copiado!' : 'Copiar link'}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(orcamento)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(orcamento)} aria-label="Excluir">
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

      <Modal open={editingId !== null} onClose={cancel} title={editingId === 'new' ? 'Novo orçamento' : 'Editar orçamento'}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="orc-nome">Nome do cliente</Label>
              <Input
                id="orc-nome"
                value={form.clienteFinalNome}
                onChange={(e) => setForm((f) => ({ ...f, clienteFinalNome: e.target.value }))}
                placeholder="Ex.: Ana & Pedro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orc-contato">Contato (WhatsApp)</Label>
              <Input
                id="orc-contato"
                value={form.clienteFinalContato}
                onChange={(e) => setForm((f) => ({ ...f, clienteFinalContato: e.target.value }))}
                placeholder="(11) 90000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens</Label>
              <div className="flex gap-1.5">
                {produtos.map((produto) => (
                  <Button key={produto.id} type="button" size="sm" variant="outline" onClick={() => addItem(produto)}>
                    + {produto.nome}
                  </Button>
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => addItem()}>
                  + Item livre
                </Button>
              </div>
            </div>

            {form.itens.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Nenhum item ainda — adicione um produto do catálogo ou um item livre.
              </p>
            ) : (
              <div className="space-y-2">
                {form.itens.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border p-2">
                    <Input
                      value={item.descricao}
                      onChange={(e) => updateItem(i, { descricao: e.target.value })}
                      placeholder="Descrição"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) => updateItem(i, { quantidade: Number(e.target.value) || 1 })}
                      className="w-16"
                      aria-label="Quantidade"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.valorUnitario}
                      onChange={(e) => updateItem(i, { valorUnitario: Number(e.target.value) || 0 })}
                      className="w-28"
                      aria-label="Valor unitário"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeItem(i)} aria-label="Remover item">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end border-t pt-2 text-sm font-semibold">Total: {formatBRL(total)}</div>
          </div>

          {erro ? (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          ) : null}

          <div className={MODAL_ACOES}>
            <Button variant="outline" onClick={cancel}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={save} disabled={!form.clienteFinalNome.trim() || form.itens.length === 0 || salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Excluir orçamento?"
        description={`O link público de "${deleteTarget?.clienteFinalNome}" para de funcionar imediatamente.`}
      />
    </div>
  )
}
