'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ChevronDown, ChevronUp, Gift, ImagePlus, Pencil, Plus, TrendingUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { MediaPickerModal } from '@/components/admin/media/media-picker-modal'
import {
  alternarAdicionalAtivo,
  atualizarAdicional,
  criarAdicional,
  reordenarAdicionais,
} from '@/lib/actions/adicionais-admin'
import { lerPreco, precoParaTexto } from '@/lib/preco'
import { cn, formatBRL } from '@/lib/utils'
import type { AdicionalAdmin } from '@/lib/supabase/queries'
import type { MediaAsset } from '@/types/platform'

interface FormState {
  nome: string
  descricao: string
  imagemUrl: string | null
  custo: string
  sugerido: string
}

const EMPTY_FORM: FormState = { nome: '', descricao: '', imagemUrl: null, custo: '', sugerido: '' }

/** Margem do estúdio ao vender pelo preço sugerido. */
function margemSugerida(custo: number, sugerido: number) {
  const valor = sugerido - custo
  return { valor, pct: sugerido > 0 ? Math.round((valor / sugerido) * 100) : null }
}

/**
 * Catálogo de adicionais (Upsell B2B2C, 0026) do lado da operação: o que o
 * estúdio paga (custo) e o preço de revenda sugerido ao casal. O estúdio
 * ajusta a própria revenda em /dashboard/catalogo; o casal nunca vê o custo.
 */
export function AdicionaisManager({ itens, assets }: { itens: AdicionalAdmin[]; assets: MediaAsset[] }) {
  const router = useRouter()
  const [lista, setLista] = useState<AdicionalAdmin[]>(itens)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)

  // A lista local acompanha o servidor depois de cada router.refresh().
  const [itensAnteriores, setItensAnteriores] = useState(itens)
  if (itens !== itensAnteriores) {
    setItensAnteriores(itens)
    setLista(itens)
  }

  const custo = lerPreco(form.custo)
  const sugerido = lerPreco(form.sugerido)
  const precosValidos = typeof custo === 'number' && typeof sugerido === 'number'
  const formValido = form.nome.trim().length >= 2 && form.nome.trim().length <= 80 && precosValidos
  const previa = precosValidos ? margemSugerida(custo, sugerido) : null

  function startAdd() {
    setForm(EMPTY_FORM)
    setErroForm(null)
    setEditingId('new')
  }

  function startEdit(item: AdicionalAdmin) {
    setForm({
      nome: item.nome,
      descricao: item.descricao ?? '',
      imagemUrl: item.imagemUrl,
      custo: precoParaTexto(item.custo),
      sugerido: precoParaTexto(item.sugerido),
    })
    setErroForm(null)
    setEditingId(item.id)
  }

  function cancel() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function save() {
    if (!formValido || typeof custo !== 'number' || typeof sugerido !== 'number') return
    setSalvando(true)
    setErroForm(null)
    const dados = { nome: form.nome, descricao: form.descricao, imagemUrl: form.imagemUrl, custo, sugerido }
    const r = editingId === 'new' ? await criarAdicional(dados) : await atualizarAdicional(String(editingId), dados)
    setSalvando(false)
    if (!r.ok) {
      setErroForm(r.erro)
      return
    }
    cancel()
    router.refresh()
  }

  async function toggleAtivo(item: AdicionalAdmin) {
    setErroLista(null)
    setLista((prev) => prev.map((a) => (a.id === item.id ? { ...a, ativo: !item.ativo } : a)))
    const r = await alternarAdicionalAtivo(item.id, !item.ativo)
    if (!r.ok) {
      setErroLista(r.erro)
      setLista((prev) => prev.map((a) => (a.id === item.id ? { ...a, ativo: item.ativo } : a)))
    }
  }

  async function move(id: string, direction: -1 | 1) {
    const idx = lista.findIndex((a) => a.id === id)
    const swapIdx = idx + direction
    if (idx === -1 || swapIdx < 0 || swapIdx >= lista.length) return
    const anterior = lista
    const copy = [...lista]
    ;[copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]]
    setErroLista(null)
    setLista(copy)
    const r = await reordenarAdicionais(copy.map((a) => a.id))
    if (!r.ok) {
      setErroLista(r.erro)
      setLista(anterior)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Adicionais</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Itens que o casal pode incluir ao aprovar a prova. O estúdio paga o custo e revende pelo preço dele —
            o sugerido é o padrão até ele mudar. Desativar tira o item do catálogo dos estúdios e das novas aprovações.
          </p>
        </div>
        <Button size="sm" variant="brand" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Novo adicional
        </Button>
      </div>

      {erroLista ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erroLista}
        </p>
      ) : null}

      {lista.length === 0 ? (
        <EmptyState title="Nenhum adicional cadastrado" description="Crie o primeiro item para os estúdios oferecerem aos clientes." />
      ) : (
        <ul className="space-y-3">
          {lista.map((item, idx) => {
            const m = margemSugerida(item.custo, item.sugerido)
            return (
              <li
                key={item.id}
                className={cn('flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4', !item.ativo && 'bg-[#FAFAFA]')}
              >
                <div className="flex flex-col" aria-label="Ordem">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(item.id, -1)} disabled={idx === 0} aria-label={`Subir ${item.nome}`}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => move(item.id, 1)}
                    disabled={idx === lista.length - 1}
                    aria-label={`Descer ${item.nome}`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#F5F0EA] to-[#E8E1D8]', !item.ativo && 'opacity-60')}>
                  {item.imagemUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- imagem do catálogo (URL pública da biblioteca).
                    <img src={item.imagemUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Gift className="h-6 w-6 text-[#8A7B6A]" aria-hidden />
                  )}
                </span>

                <div className={cn('min-w-0 flex-1 basis-48', !item.ativo && 'opacity-60')}>
                  <p className="break-words font-semibold">{item.nome}</p>
                  {item.descricao ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.descricao}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.vendidos} vendido(s)
                    {item.estudiosSemOferta > 0 ? ` · ${item.estudiosSemOferta} estúdio(s) não oferecem` : ''}
                  </p>
                </div>

                <dl className={cn('grid grid-cols-3 gap-4 text-sm tabular-nums', !item.ativo && 'opacity-60')}>
                  <div>
                    <dt className="text-xs text-muted-foreground">Custo</dt>
                    <dd className="font-semibold">{formatBRL(item.custo)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Sugerido</dt>
                    <dd className="font-semibold">{formatBRL(item.sugerido)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Margem do estúdio</dt>
                    <dd className={cn('font-semibold', m.valor < 0 ? 'text-red-700' : m.valor > 0 ? 'text-emerald-700' : '')}>
                      {formatBRL(m.valor)}
                      {m.pct !== null ? <span className="ml-1 text-xs font-medium">({m.pct}%)</span> : null}
                    </dd>
                  </div>
                </dl>

                <div className="flex items-center gap-2">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium">
                    <Switch
                      checked={item.ativo}
                      onCheckedChange={() => toggleAtivo(item)}
                      aria-label={`${item.ativo ? 'Desativar' : 'Ativar'} ${item.nome}`}
                      className="data-[state=checked]:bg-[#171717]"
                    />
                    <span className={item.ativo ? 'text-[#171717]' : 'text-muted-foreground'}>{item.ativo ? 'Ativo' : 'Inativo'}</span>
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => startEdit(item)} aria-label={`Editar ${item.nome}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={editingId !== null} onClose={cancel} title={editingId === 'new' ? 'Novo adicional' : 'Editar adicional'}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Imagem</Label>
            {form.imagemUrl ? (
              <div className="relative h-32 w-full overflow-hidden rounded-xl bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia da imagem escolhida na biblioteca. */}
                <img src={form.imagemUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <Button size="sm" variant="outline" className="bg-white" onClick={() => setForm((f) => ({ ...f, imagemUrl: null }))}>
                    <X className="h-4 w-4" aria-hidden />
                    Remover
                  </Button>
                  <Button size="sm" variant="outline" className="bg-white" onClick={() => setPickerOpen(true)}>
                    Trocar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setPickerOpen(true)}>
                <ImagePlus className="h-4 w-4" aria-hidden />
                Escolher da biblioteca de mídia
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adicional-nome">Nome</Label>
            <Input
              id="adicional-nome"
              value={form.nome}
              maxLength={80}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Cópia para os pais (20×20)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adicional-descricao">Descrição (o casal vê)</Label>
            <textarea
              id="adicional-descricao"
              value={form.descricao}
              maxLength={300}
              rows={3}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              className="block w-full resize-y rounded-xl border border-[#D4D4D4] bg-white px-3 py-2 text-sm placeholder:text-[#AAAAAA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="adicional-custo">Custo para o estúdio (R$)</Label>
              <Input
                id="adicional-custo"
                inputMode="decimal"
                autoComplete="off"
                value={form.custo}
                onChange={(e) => setForm((f) => ({ ...f, custo: e.target.value }))}
                placeholder="150,00"
                aria-invalid={custo === 'invalido'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adicional-sugerido">Preço sugerido ao casal (R$)</Label>
              <Input
                id="adicional-sugerido"
                inputMode="decimal"
                autoComplete="off"
                value={form.sugerido}
                onChange={(e) => setForm((f) => ({ ...f, sugerido: e.target.value }))}
                placeholder="350,00"
                aria-invalid={sugerido === 'invalido'}
              />
            </div>
          </div>
          <div
            className={cn(
              'rounded-xl p-3 text-sm',
              previa && previa.valor < 0 ? 'bg-red-50' : previa && previa.valor > 0 ? 'bg-emerald-50' : 'bg-[#F5F5F5]',
            )}
            aria-live="polite"
          >
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              Margem do estúdio no preço sugerido
            </p>
            <p className="mt-0.5 font-semibold tabular-nums">
              {previa ? formatBRL(previa.valor) : '—'}
              {previa?.pct != null ? <span className="ml-1 text-xs font-medium">({previa.pct}%)</span> : null}
            </p>
            {custo === 'invalido' || sugerido === 'invalido' ? (
              <p className="text-[11px] font-medium text-red-700">Use só números, ex.: 350,00</p>
            ) : previa && previa.valor < 0 ? (
              <p className="text-[11px] font-medium text-red-700">Sugerido abaixo do custo: o estúdio perderia dinheiro.</p>
            ) : null}
          </div>

          {erroForm ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {erroForm}
            </p>
          ) : null}

          <div className={MODAL_ACOES}>
            <Button variant="outline" onClick={cancel}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={save} disabled={!formValido || salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assets={assets}
        onSelect={([id]) => {
          const url = assets.find((a) => a.id === id)?.url
          if (url) setForm((f) => ({ ...f, imagemUrl: url }))
        }}
      />
    </div>
  )
}
