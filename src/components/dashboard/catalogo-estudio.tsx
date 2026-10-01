'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Eye, Gift, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { salvarCatalogoEstudio } from '@/lib/actions/catalogo-estudio'
import { cn, formatBRL } from '@/lib/utils'
import type { ItemCatalogoEstudio } from '@/lib/supabase/queries'

type Rascunho = { oferecer: boolean; preco: string }

/** "350", "350,5", "1.350,00", "350.00" → número; vazio → null (usa o sugerido). */
function lerPreco(texto: string): number | null | 'invalido' {
  const t = texto.trim()
  if (t === '') return null
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return 'invalido'
  return Number(normal)
}

function paraTexto(v: number | null) {
  return v === null ? '' : v.toFixed(2).replace('.', ',')
}

/**
 * Catálogo do estúdio (Upsell B2B2C, 0026): o fotógrafo escolhe o que oferece
 * aos clientes dele e por quanto vende. A margem aparece enquanto digita. É
 * exatamente o que o casal vê no modal de oferta da prova.
 */
export function CatalogoEstudio({ itens }: { itens: ItemCatalogoEstudio[] }) {
  const router = useRouter()
  const inicial = useMemo(
    () => Object.fromEntries(itens.map((i) => [i.id, { oferecer: i.oferecer, preco: paraTexto(i.precoVenda) }])) as Record<string, Rascunho>,
    [itens],
  )
  const [rascunho, setRascunho] = useState<Record<string, Rascunho>>(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  const alterado = itens.some(
    (i) => rascunho[i.id].oferecer !== inicial[i.id].oferecer || rascunho[i.id].preco.trim() !== inicial[i.id].preco,
  )
  const invalidos = itens.filter((i) => lerPreco(rascunho[i.id].preco) === 'invalido')

  function atualizar(id: string, patch: Partial<Rascunho>) {
    setSalvo(false)
    setErro(null)
    setRascunho((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
  }

  async function salvar() {
    if (invalidos.length > 0) return
    setSalvando(true)
    setErro(null)
    const r = await salvarCatalogoEstudio(
      itens.map((i) => {
        const preco = lerPreco(rascunho[i.id].preco)
        return { adicionalId: i.id, oferecer: rascunho[i.id].oferecer, precoVenda: preco === 'invalido' ? null : preco }
      }),
    )
    setSalvando(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    setSalvo(true)
    router.refresh()
  }

  if (itens.length === 0) {
    return <p className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">Nenhum adicional disponível no momento.</p>
  }

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      <ul className="space-y-4">
        {itens.map((item) => {
          const r = rascunho[item.id]
          const lido = lerPreco(r.preco)
          const precoEfetivo = lido === 'invalido' ? null : (lido ?? item.sugerido)
          const margem = precoEfetivo === null ? null : precoEfetivo - item.custo
          const abaixoDoCusto = margem !== null && margem < 0
          const campo = `preco-${item.id}`
          return (
            <li
              key={item.id}
              className={cn('rounded-2xl border bg-white p-4 transition-opacity sm:p-5', !r.oferecer && 'bg-[#FAFAFA]')}
            >
              <div className="flex items-start gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#F5F0EA] to-[#E8E1D8]">
                  {item.imagemUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- imagem do catálogo (URL pública).
                    <img src={item.imagemUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Gift className="h-7 w-7 text-[#8A7B6A]" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-semibold">{item.nome}</h2>
                      {item.descricao ? <p className="mt-0.5 text-sm text-muted-foreground">{item.descricao}</p> : null}
                    </div>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium">
                      <Switch
                        checked={r.oferecer}
                        onCheckedChange={(v) => atualizar(item.id, { oferecer: v })}
                        aria-label={`Oferecer ${item.nome} aos meus clientes`}
                        className="data-[state=checked]:bg-[#171717]"
                      />
                      <span className={r.oferecer ? 'text-[#171717]' : 'text-muted-foreground'}>
                        {r.oferecer ? 'Oferecendo' : 'Não oferecer'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className={cn('mt-4 grid gap-3 sm:grid-cols-3', !r.oferecer && 'opacity-60')}>
                <div className="rounded-xl bg-[#F5F5F5] p-3">
                  <p className="text-xs text-muted-foreground">Custo Seu Álbum</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatBRL(item.custo)}</p>
                </div>
                <div className="rounded-xl border p-3 focus-within:ring-2 focus-within:ring-[#171717]">
                  <label htmlFor={campo} className="text-xs text-muted-foreground">
                    Seu preço de venda
                  </label>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-lg font-semibold text-muted-foreground">R$</span>
                    <input
                      id={campo}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={r.preco}
                      onChange={(e) => atualizar(item.id, { preco: e.target.value })}
                      placeholder={paraTexto(item.sugerido)}
                      aria-describedby={`${campo}-dica`}
                      aria-invalid={lido === 'invalido'}
                      className="min-h-[36px] w-full min-w-0 bg-transparent text-lg font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-[#9A9A9A]"
                    />
                  </div>
                  <p id={`${campo}-dica`} className="text-[11px] text-muted-foreground">
                    {lido === null ? `Vazio = sugerido (${formatBRL(item.sugerido)})` : `Sugerido: ${formatBRL(item.sugerido)}`}
                  </p>
                </div>
                <div
                  className={cn(
                    'rounded-xl p-3',
                    abaixoDoCusto ? 'bg-red-50' : margem !== null && margem > 0 ? 'bg-emerald-50' : 'bg-[#F5F5F5]',
                  )}
                  aria-live="polite"
                >
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    Sua margem de lucro
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 text-lg font-semibold tabular-nums',
                      abaixoDoCusto ? 'text-red-700' : margem !== null && margem > 0 ? 'text-emerald-700' : '',
                    )}
                  >
                    {margem === null ? '—' : formatBRL(margem)}
                    {margem !== null && precoEfetivo ? (
                      <span className="ml-1 text-xs font-medium">({Math.round((margem / precoEfetivo) * 100)}%)</span>
                    ) : null}
                  </p>
                  {abaixoDoCusto ? <p className="text-[11px] font-medium text-red-700">Abaixo do custo: você paga a diferença.</p> : null}
                  {lido === 'invalido' ? <p className="text-[11px] font-medium text-red-700">Use só números, ex.: 350,00</p> : null}
                </div>
              </div>

              {r.oferecer && precoEfetivo !== null ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Seu cliente vê: &quot;{item.nome}&quot; por {formatBRL(precoEfetivo)} — o custo nunca aparece para ele.
                </p>
              ) : !r.oferecer ? (
                <p className="mt-3 text-xs text-muted-foreground">Seus clientes não verão este item na aprovação. Você ainda pode incluí-lo.</p>
              ) : null}
            </li>
          )
        })}
      </ul>

      {erro ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : null}

      {/* Barra de salvar: fixa no rodapé do celular, alinhada à direita no desktop. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex items-center justify-end gap-3">
          {salvo && !alterado ? (
            <span role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4" aria-hidden />
              Salvo — já vale na próxima aprovação.
            </span>
          ) : null}
          <Button
            variant="brand"
            className="h-12 w-full text-base sm:w-auto"
            onClick={salvar}
            disabled={!alterado || salvando || invalidos.length > 0}
          >
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </div>
    </div>
  )
}
