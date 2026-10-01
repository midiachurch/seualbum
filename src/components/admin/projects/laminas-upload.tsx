'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ImagePlus, Loader2, UploadCloud, X } from 'lucide-react'
import { MODAL_ACOES } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { criarVersaoComLaminas } from '@/lib/actions/projetos'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarTamanho } from '@/lib/utils'
// randomUUID só existe em HTTPS/localhost; este funciona também pelo IP da rede.
import { novoUuid } from '@/store/usePedidoWizardStore'

// Inlined (não importado de '@/lib/demo-mode'): roda no navegador.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL
const UPLOADS_SIMULTANEOS = 3
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']

type Status = 'pronta' | 'enviando' | 'enviada' | 'erro'

interface Item {
  id: string
  file: File
  preview: string
  largura: number | null
  altura: number | null
  status: Status
  storagePath?: string
}

/** "lamina-2" antes de "lamina-10": é como o designer numera os arquivos. */
const ordemNatural = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

function nomeSeguro(nome: string) {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(-80) || 'lamina'
  )
}

async function dimensoes(file: File): Promise<{ largura: number | null; altura: number | null }> {
  try {
    const bitmap = await createImageBitmap(file)
    const d = { largura: bitmap.width, altura: bitmap.height }
    bitmap.close()
    return d
  } catch {
    return { largura: null, altura: null }
  }
}

/**
 * Upload em massa das lâminas de uma nova versão (Fase 3, migration 0018).
 * Sobe direto do navegador para `projetos_fotos/{projetoId}/versoes/{lote}/`
 * e, com tudo no Storage, cria a versão + lâminas numa Server Action.
 * O `lote` é fixo por tentativa: reenviar reaproveita o que já subiu.
 */
export function LaminasUpload({
  projetoId,
  onConcluido,
  onCancelar,
}: {
  projetoId: string
  onConcluido: (versao: { versaoId: string; numero: number; laminas: number; comentarios: string | null }) => void
  onCancelar: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const loteRef = useRef<string>(novoUuid())
  const [itens, setItens] = useState<Item[]>([])
  const [comentarios, setComentarios] = useState('')
  // A capa aparece na prova mas NÃO conta na franquia de lâminas do plano.
  const [primeiraEhCapa, setPrimeiraEhCapa] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [fase, setFase] = useState<'montando' | 'enviando' | 'registrando'>('montando')
  const [erro, setErro] = useState<string | null>(null)
  const [ignorados, setIgnorados] = useState(0)

  // Libera as prévias (object URLs) ao desmontar.
  const itensRef = useRef(itens)
  itensRef.current = itens
  useEffect(() => () => itensRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), [])

  async function receber(files: FileList | File[] | null) {
    if (!files) return
    const lista = Array.from(files)
    const aceitos = lista.filter((f) => TIPOS_ACEITOS.includes(f.type))
    setIgnorados(lista.length - aceitos.length)
    const novos: Item[] = []
    for (const file of aceitos) {
      novos.push({ id: novoUuid(), file, preview: URL.createObjectURL(file), ...(await dimensoes(file)), status: 'pronta' })
    }
    setItens((atual) => [...atual, ...novos].sort((a, b) => ordemNatural.compare(a.file.name, b.file.name)))
  }

  function mover(indice: number, delta: -1 | 1) {
    setItens((atual) => {
      const alvo = indice + delta
      if (alvo < 0 || alvo >= atual.length) return atual
      const copia = [...atual]
      ;[copia[indice], copia[alvo]] = [copia[alvo], copia[indice]]
      return copia
    })
  }

  function remover(id: string) {
    setItens((atual) => {
      const item = atual.find((i) => i.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return atual.filter((i) => i.id !== id)
    })
  }

  async function enviar() {
    if (itens.length === 0 || fase !== 'montando') return
    setErro(null)
    setFase('enviando')

    // A ordem vale a partir daqui: vira o prefixo do arquivo e a coluna `ordem`.
    const ordenados = itens.map((item, i) => ({ ...item, ordem: i + 1 }))
    const supabase = createClient()
    const pasta = `${projetoId}/versoes/${loteRef.current}`
    const resultado = new Map<string, string>() // id → storagePath

    const fila = ordenados.filter((i) => i.status !== 'enviada' || !i.storagePath)
    ordenados.filter((i) => i.status === 'enviada' && i.storagePath).forEach((i) => resultado.set(i.id, i.storagePath!))

    async function subir(item: (typeof ordenados)[number]) {
      const path = `${pasta}/${String(item.ordem).padStart(3, '0')}-${nomeSeguro(item.file.name)}`
      setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, status: 'enviando' } : i)))
      const { error } = await supabase.storage
        .from('projetos_fotos')
        .upload(path, item.file, { cacheControl: '3600', upsert: true, contentType: item.file.type })
      if (error) {
        setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, status: 'erro' } : i)))
        return
      }
      resultado.set(item.id, path)
      setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, status: 'enviada', storagePath: path } : i)))
    }

    if (!DEMO_MODE) {
      const trabalhadores = Array.from({ length: UPLOADS_SIMULTANEOS }, async () => {
        while (fila.length > 0) {
          const proximo = fila.shift()
          if (proximo) await subir(proximo)
        }
      })
      await Promise.all(trabalhadores)
    }

    if (DEMO_MODE || resultado.size !== ordenados.length) {
      setFase('montando')
      setErro(
        DEMO_MODE
          ? 'Upload indisponível em modo de demonstração.'
          : `${ordenados.length - resultado.size} lâmina(s) não subiram. Toque em "Tentar de novo".`,
      )
      return
    }

    setFase('registrando')
    try {
      const versao = await criarVersaoComLaminas({
        projetoId,
        lote: loteRef.current,
        comentarios: comentarios.trim() || null,
        primeiraEhCapa,
        laminas: ordenados.map((i) => ({ storagePath: resultado.get(i.id)!, ordem: i.ordem, largura: i.largura, altura: i.altura })),
      })
      onConcluido({ ...versao, laminas: ordenados.length, comentarios: comentarios.trim() || null })
    } catch (e) {
      setFase('montando')
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar a versão.')
    }
  }

  const enviadas = itens.filter((i) => i.status === 'enviada').length
  const pesoTotal = itens.reduce((s, i) => s + i.file.size, 0)
  const ocupado = fase !== 'montando'
  const temErro = itens.some((i) => i.status === 'erro')

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Nova versão — lâminas</p>
        <Button variant="ghost" size="icon" onClick={onCancelar} disabled={ocupado} aria-label="Cancelar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={TIPOS_ACEITOS.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void receber(e.target.files)
          e.target.value = ''
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!ocupado) setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          if (!ocupado) void receber(e.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
          arrastando ? 'border-foreground bg-secondary' : 'border-input',
        )}
      >
        <UploadCloud className="h-7 w-7 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Arraste as lâminas (JPG, PNG ou WebP)</p>
        <p className="text-xs text-muted-foreground">A ordem segue o nome do arquivo — dá para ajustar abaixo.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={ocupado}>
          <ImagePlus className="h-4 w-4" aria-hidden />
          Selecionar arquivos
        </Button>
      </div>

      {ignorados > 0 ? (
        <p className="text-xs text-muted-foreground">
          {ignorados} {ignorados === 1 ? 'arquivo ignorado' : 'arquivos ignorados'} (formato não aceito).
        </p>
      ) : null}

      {itens.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {primeiraEhCapa ? `Capa + ${itens.length - 1}` : itens.length} {itens.length - (primeiraEhCapa ? 1 : 0) === 1 ? 'lâmina' : 'lâminas'} ·{' '}
            {formatarTamanho(pesoTotal)}
            {fase === 'enviando' ? ` · ${enviadas} de ${itens.length} enviadas` : ''}
          </p>
          <ol className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {itens.map((item, i) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl border p-2">
                <span className="w-7 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (object URL) antes do upload. */}
                <img src={item.preview} alt="" loading="lazy" className="h-12 w-20 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm">
                    {primeiraEhCapa && i === 0 ? (
                      <span className="shrink-0 rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Capa</span>
                    ) : null}
                    <span className="truncate">{item.file.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.largura && item.altura ? `${item.largura}×${item.altura} · ` : ''}
                    {formatarTamanho(item.file.size)}
                  </p>
                </div>
                {item.status === 'enviando' ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Enviando" /> : null}
                {item.status === 'enviada' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Enviada" /> : null}
                {item.status === 'erro' ? <AlertCircle className="h-4 w-4 text-destructive" aria-label="Falhou" /> : null}
                {!ocupado ? (
                  <div className="flex shrink-0">
                    <Button type="button" variant="ghost" size="icon" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir lâmina ${i + 1}`}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => mover(i, 1)} disabled={i === itens.length - 1} aria-label={`Descer lâmina ${i + 1}`}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remover(item.id)} aria-label={`Remover lâmina ${i + 1}`}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      ) : null}

      <div className="space-y-1.5">
        <label className="mb-3 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
          <input
            type="checkbox"
            checked={primeiraEhCapa}
            onChange={(e) => setPrimeiraEhCapa(e.target.checked)}
            disabled={ocupado || itens.length === 0}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#171717]"
          />
          <span>
            <span className="font-medium">A 1ª imagem é a capa</span>
            <span className="block text-xs text-muted-foreground">A capa aparece na prova, mas não conta nas lâminas do plano do cliente.</span>
          </span>
        </label>
        <Label htmlFor="lam-comentarios">Comentários para a revisão interna</Label>
        <Input id="lam-comentarios" value={comentarios} onChange={(e) => setComentarios(e.target.value)} disabled={ocupado} />
      </div>

      {erro ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : null}

      {/* Também roda dentro do modal da fila de design: no celular empilha. */}
      <div className={MODAL_ACOES}>
        <Button variant="outline" size="sm" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button size="sm" variant="brand" onClick={enviar} disabled={itens.length === 0 || ocupado}>
          {fase === 'enviando' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Enviando {enviadas}/{itens.length}…
            </>
          ) : fase === 'registrando' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Registrando versão…
            </>
          ) : temErro ? (
            'Tentar de novo'
          ) : (
            'Enviar para revisão interna'
          )}
        </Button>
      </div>
    </div>
  )
}
