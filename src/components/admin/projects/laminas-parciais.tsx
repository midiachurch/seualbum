'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, ImagePlus, Loader2, Plus, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react'
import { MODAL_ACOES } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dimensoes } from '@/lib/dimensoes-imagem'
import { criarVersaoComLaminas } from '@/lib/actions/projetos'
import { enviarLaminaR2 } from '@/lib/upload-lamina'
import { cn } from '@/lib/utils'
import { DPI_MINIMO, dpiEfetivo, type FormatoAlbum } from '@/lib/resolucao'
import { novoUuid } from '@/store/usePedidoWizardStore'
import type { Lamina } from '@/types/platform'

export type VersaoBase = { id: string; numero: number; laminas: Lamina[] }

type Arquivo = { id: string; file: File; preview: string; largura: number | null; altura: number | null; chave?: string }

const UPLOADS_SIMULTANEOS = 3
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Versão parcial (migration 0032): o designer parte da versão mais recente e
 * mexe só no que o cliente pediu — substitui a lâmina N, remove, ou acrescenta
 * no fim. As outras são herdadas sem reenviar nada. Só os arquivos novos sobem
 * para o R2; a Server Action monta a versão completa.
 */
export function LaminasParciais({
  projetoId,
  album,
  versaoBase,
  onOcupado,
  onConcluido,
  onCancelar,
}: {
  projetoId: string
  album: FormatoAlbum | null
  versaoBase: VersaoBase
  onOcupado: (ocupado: boolean) => void
  onConcluido: (versao: { versaoId: string; numero: number; laminas: number; comentarios: string | null }) => void
  onCancelar: () => void
}) {
  const loteRef = useRef(novoUuid())
  const trocaRef = useRef<HTMLInputElement>(null)
  const novaRef = useRef<HTMLInputElement>(null)
  const ordemAlvo = useRef<number | null>(null)
  const [trocas, setTrocas] = useState<Record<number, Arquivo>>({})
  const [removidas, setRemovidas] = useState<Set<number>>(new Set())
  const [adicionadas, setAdicionadas] = useState<Arquivo[]>([])
  const [comentarios, setComentarios] = useState('')
  const [fase, setFase] = useState<'montando' | 'enviando' | 'registrando'>('montando')
  const [enviadas, setEnviadas] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  const ocupado = fase !== 'montando'
  useEffect(() => onOcupado(ocupado), [ocupado, onOcupado])

  // Libera as prévias (object URLs) ao desmontar.
  const vivos = useRef<Arquivo[]>([])
  vivos.current = [...Object.values(trocas), ...adicionadas]
  useEffect(() => () => vivos.current.forEach((a) => URL.revokeObjectURL(a.preview)), [])

  const laminas = [...versaoBase.laminas].sort((a, b) => a.ordem - b.ordem)
  const novosArquivos = [...Object.values(trocas), ...adicionadas]
  const totalMudancas = novosArquivos.length + removidas.size
  const totalFinal = laminas.length - removidas.size + adicionadas.length

  async function arquivo(file: File): Promise<Arquivo> {
    return { id: novoUuid(), file, preview: URL.createObjectURL(file), ...(await dimensoes(file)) }
  }

  async function aoEscolherTroca(files: FileList | null) {
    const file = files?.[0]
    const ordem = ordemAlvo.current
    if (!file || ordem === null) return
    if (file.type !== 'image/jpeg') return setErro('As lâminas precisam ser JPG.')
    setErro(null)
    const novo = await arquivo(file)
    setTrocas((t) => {
      if (t[ordem]) URL.revokeObjectURL(t[ordem].preview)
      return { ...t, [ordem]: novo }
    })
    setRemovidas((r) => {
      const n = new Set(r)
      n.delete(ordem)
      return n
    })
  }

  async function aoAdicionar(files: FileList | null) {
    const lista = Array.from(files ?? []).filter((f) => f.type === 'image/jpeg')
    if (files && lista.length < files.length) setErro('Só JPG é aceito — os outros arquivos foram ignorados.')
    const novos = await Promise.all(lista.map(arquivo))
    setAdicionadas((a) => [...a, ...novos])
  }

  function desfazer(ordem: number) {
    setTrocas((t) => {
      const { [ordem]: saiu, ...resto } = t
      if (saiu) URL.revokeObjectURL(saiu.preview)
      return resto
    })
    setRemovidas((r) => {
      const n = new Set(r)
      n.delete(ordem)
      return n
    })
  }

  function remover(ordem: number) {
    desfazer(ordem)
    setRemovidas((r) => new Set(r).add(ordem))
  }

  const dpiDe = (a: Arquivo) => (album && a.largura && a.altura ? dpiEfetivo(a.largura, a.altura, album) : null)
  const abaixoDoMinimo = novosArquivos.filter((a) => (dpiDe(a) ?? DPI_MINIMO) < DPI_MINIMO).length

  async function enviar() {
    if (totalMudancas === 0 || ocupado) return
    if (DEMO_MODE) return setErro('Upload indisponível em modo de demonstração.')
    setErro(null)
    setFase('enviando')

    // Só sobe o que ainda não subiu (tentar de novo reaproveita o lote).
    const fila = novosArquivos.filter((a) => !a.chave)
    const chaves = new Map(novosArquivos.filter((a) => a.chave).map((a) => [a.id, a.chave!]))
    setEnviadas(chaves.size)
    let ultimoErro: string | null = null
    await Promise.all(
      Array.from({ length: UPLOADS_SIMULTANEOS }, async () => {
        while (fila.length > 0) {
          const a = fila.shift()!
          try {
            const chave = await enviarLaminaR2({ projetoId, lote: loteRef.current, arquivo: a.file, nome: a.file.name })
            a.chave = chave
            chaves.set(a.id, chave)
            setEnviadas(chaves.size)
          } catch (e) {
            ultimoErro = e instanceof Error ? e.message : 'falha no envio'
          }
        }
      }),
    )
    if (chaves.size !== novosArquivos.length) {
      setFase('montando')
      setErro(`${novosArquivos.length - chaves.size} lâmina(s) não subiram (${ultimoErro}). Toque em "Tentar de novo".`)
      return
    }

    setFase('registrando')
    try {
      const versao = await criarVersaoComLaminas({
        projetoId,
        lote: loteRef.current,
        comentarios: comentarios.trim() || null,
        parcial: {
          baseVersaoId: versaoBase.id,
          substituir: Object.entries(trocas).map(([ordem, a]) => ({
            ordem: Number(ordem),
            storagePath: chaves.get(a.id)!,
            largura: a.largura,
            altura: a.altura,
          })),
          remover: [...removidas],
          adicionar: adicionadas.map((a) => ({ storagePath: chaves.get(a.id)!, largura: a.largura, altura: a.altura })),
        },
      })
      onConcluido({ versaoId: versao.versaoId, numero: versao.numero, laminas: versao.laminas, comentarios: comentarios.trim() || null })
    } catch (e) {
      setFase('montando')
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar a versão.')
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={trocaRef}
        type="file"
        accept="image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void aoEscolherTroca(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={novaRef}
        type="file"
        accept="image/jpeg"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void aoAdicionar(e.target.files)
          e.target.value = ''
        }}
      />

      <p className="text-xs text-muted-foreground">
        Versão {versaoBase.numero} · {laminas.length} {laminas.length === 1 ? 'lâmina' : 'lâminas'}. Toque em
        &quot;Substituir&quot; nas que mudaram; as outras seguem iguais para a versão {versaoBase.numero + 1}.
      </p>

      <ol className="grid max-h-[28rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
        {laminas.map((l) => {
          const troca = trocas[l.ordem]
          const saiu = removidas.has(l.ordem)
          const dpi = troca ? dpiDe(troca) : null
          return (
            <li
              key={l.id}
              className={cn(
                'overflow-hidden rounded-xl border',
                troca && 'border-emerald-500 ring-1 ring-emerald-500',
                saiu && 'border-destructive/50 opacity-60',
              )}
            >
              <div className="relative aspect-[3/2] bg-[#F5F5F5]">
                {/* eslint-disable-next-line @next/next/no-img-element -- lâmina via link assinado / prévia local. */}
                <img src={troca?.preview ?? l.url} alt={`Lâmina ${l.ordem}`} loading="lazy" className={cn('h-full w-full object-contain', saiu && 'grayscale')} />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {l.ehCapa && l.ordem === 1 ? 'Capa' : l.ordem}
                </span>
                {troca ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">Nova</span>
                ) : saiu ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-white">Sai</span>
                ) : null}
              </div>
              {dpi !== null && dpi < DPI_MINIMO ? (
                <p className="bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900">{dpi} DPI — baixa resolução</p>
              ) : null}
              <div className="flex flex-wrap gap-1 p-1.5">
                {troca || saiu ? (
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => desfazer(l.ordem)} disabled={ocupado}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Desfazer
                  </Button>
                ) : null}
                {!saiu ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    disabled={ocupado}
                    onClick={() => {
                      ordemAlvo.current = l.ordem
                      trocaRef.current?.click()
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    {troca ? 'Trocar' : 'Substituir'}
                  </Button>
                ) : null}
                {!saiu && !troca ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-destructive"
                    disabled={ocupado}
                    onClick={() => remover(l.ordem)}
                    aria-label={`Remover lâmina ${l.ordem}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
        {adicionadas.map((a, i) => (
          <li key={a.id} className="overflow-hidden rounded-xl border border-emerald-500 ring-1 ring-emerald-500">
            <div className="relative aspect-[3/2] bg-[#F5F5F5]">
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (object URL). */}
              <img src={a.preview} alt="" className="h-full w-full object-contain" />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                {laminas.length - removidas.size + i + 1}
              </span>
              <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">Acrescentada</span>
            </div>
            <div className="p-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={ocupado}
                onClick={() => {
                  URL.revokeObjectURL(a.preview)
                  setAdicionadas((lista) => lista.filter((x) => x.id !== a.id))
                }}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Tirar
              </Button>
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => novaRef.current?.click()}
            disabled={ocupado}
            className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs text-muted-foreground hover:bg-secondary disabled:opacity-60"
          >
            <Plus className="h-5 w-5" aria-hidden />
            Acrescentar no fim
          </button>
        </li>
      </ol>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {totalMudancas === 0
          ? 'Nenhuma alteração ainda.'
          : [
              Object.keys(trocas).length ? `${Object.keys(trocas).length} substituída(s)` : null,
              removidas.size ? `${removidas.size} removida(s)` : null,
              adicionadas.length ? `${adicionadas.length} acrescentada(s)` : null,
            ]
              .filter(Boolean)
              .join(' · ') + ` · versão ${versaoBase.numero + 1} com ${totalFinal} ${totalFinal === 1 ? 'lâmina' : 'lâminas'}`}
        {fase === 'enviando' ? ` · ${enviadas} de ${novosArquivos.length} enviadas` : ''}
      </p>

      {abaixoDoMinimo > 0 ? (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {abaixoDoMinimo === 1 ? '1 lâmina nova está' : `${abaixoDoMinimo} lâminas novas estão`} abaixo de {DPI_MINIMO} DPI. Dá para enviar mesmo assim.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="lam-parcial-comentarios">O que mudou (vai para a revisão interna)</Label>
        <Input
          id="lam-parcial-comentarios"
          value={comentarios}
          onChange={(e) => setComentarios(e.target.value)}
          placeholder="Ex.: lâminas 3 e 7 refeitas conforme os apontamentos"
          disabled={ocupado}
        />
      </div>

      {erro ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : null}

      <div className={MODAL_ACOES}>
        <Button variant="outline" size="sm" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button size="sm" variant="brand" onClick={enviar} disabled={totalMudancas === 0 || ocupado}>
          {fase === 'enviando' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Enviando {enviadas}/{novosArquivos.length}…
            </>
          ) : fase === 'registrando' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Registrando versão…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" aria-hidden />
              Enviar versão {versaoBase.numero + 1} para revisão interna
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
