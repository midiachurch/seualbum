'use client'

import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Ellipsis, ImagePlus, ListChecks, Plus, Search, SlidersHorizontal, Star, Trash2, WandSparkles, X } from 'lucide-react'
import { MIME_FOTO, urlParaMiniatura } from '@/components/album-editor/tipos'
import { listarFotosDoEditor, registrarFotosAlbum } from '@/lib/actions/album-editor'
import { uploadProjetoFoto } from '@/lib/upload-projeto-foto'
import { gerarDerivados, registrarDerivados } from '@/lib/album/derivados'
import { enviarArquivoAlbum } from '@/lib/upload-album'
import type { FotoDoEditor } from '@/lib/supabase/queries'
import type { DerivadoFoto } from '@/types/database'
import { MAX_FOTOS_POR_LAMINA } from '@/lib/album/modelos'
import { cn } from '@/lib/utils'
// randomUUID só existe em HTTPS/localhost; este funciona também pelo IP da rede.
import { novoUuid } from '@/store/usePedidoWizardStore'

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']
const UPLOADS_SIMULTANEOS = 3

export type Prioridade = 'principal' | 'secundaria' | 'complementar'
export type MetaFoto = { pasta?: string | null; favorita?: boolean; prioridade?: Prioridade | null; foco?: { fx: number; fy: number } | null }
type Filtro = 'todas' | 'nao-usadas' | 'usadas' | 'favoritas'
type Orientacao = 'todas' | 'horizontal' | 'vertical' | 'quadrada' | 'panoramica'
type Ordem = 'nome' | 'captura' | 'orientacao' | 'envio'

const ROTULO_PRIORIDADE: Record<Prioridade, string> = { principal: 'Principal', secundaria: 'Secundária', complementar: 'Complementar' }
const ROTULO_FILTRO: Record<Filtro, string> = { todas: 'Todas', 'nao-usadas': 'Não usadas', usadas: 'Usadas', favoritas: 'Favoritas' }

function orientacaoDe(f: FotoDoEditor): Exclude<Orientacao, 'todas'> | null {
  if (!f.largura || !f.altura) return null
  const a = f.largura / f.altura
  if (a >= 2.1) return 'panoramica'
  if (a > 1.05) return 'horizontal'
  if (a < 0.95) return 'vertical'
  return 'quadrada'
}

const NOME_ORIENTACAO: Record<Exclude<Orientacao, 'todas'>, string> = { horizontal: 'Horizontal', vertical: 'Vertical', quadrada: 'Quadrada', panoramica: 'Panorâmica' }

/* Tamanho das miniaturas da bandeja: lembrado no navegador (localStorage pode
 * falhar em aba anônima/bloqueado — aí vale só a memória desta aba). */
const TAMANHO_MIN = 72
const TAMANHO_MAX = 200
const TAMANHO_PADRAO = 112
const CHAVE_TAMANHO = 'seualbum:editor:tamanho-miniatura'
let tamanhoEmMemoria: number | null = null
const ouvintesTamanho = new Set<() => void>()

function limitarTamanho(v: number) {
  return Math.min(TAMANHO_MAX, Math.max(TAMANHO_MIN, Math.round(v)))
}

function lerTamanho(): number {
  if (tamanhoEmMemoria !== null) return tamanhoEmMemoria
  try {
    const salvo = Number(window.localStorage.getItem(CHAVE_TAMANHO))
    if (Number.isFinite(salvo) && salvo > 0) return limitarTamanho(salvo)
  } catch {
    // Sem acesso ao localStorage: usa o padrão.
  }
  return TAMANHO_PADRAO
}

function gravarTamanho(v: number) {
  tamanhoEmMemoria = limitarTamanho(v)
  try {
    window.localStorage.setItem(CHAVE_TAMANHO, String(tamanhoEmMemoria))
  } catch {
    // Fica só na memória desta aba.
  }
  ouvintesTamanho.forEach((o) => o())
}

function assinarTamanho(ouvinte: () => void) {
  ouvintesTamanho.add(ouvinte)
  return () => {
    ouvintesTamanho.delete(ouvinte)
  }
}

/** Pastas e arquivos soltos de um "arrastar e soltar" (inclui pastas inteiras). */
async function arquivosDoArrasto(dt: DataTransfer): Promise<File[]> {
  const entradas = Array.from(dt.items ?? [])
    .map((i) => (typeof i.webkitGetAsEntry === 'function' ? i.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => Boolean(e))
  if (entradas.length === 0) return Array.from(dt.files)
  const saida: File[] = []
  const ler = async (e: FileSystemEntry): Promise<void> => {
    if (e.isFile) {
      await new Promise<void>((resolve) => (e as FileSystemFileEntry).file((f) => (saida.push(f), resolve()), () => resolve()))
    } else if (e.isDirectory) {
      const leitor = (e as FileSystemDirectoryEntry).createReader()
      // readEntries devolve em lotes: lê até acabar.
      for (;;) {
        const lote = await new Promise<FileSystemEntry[]>((resolve) => leitor.readEntries(resolve, () => resolve([])))
        if (lote.length === 0) break
        for (const filho of lote) await ler(filho)
      }
    }
  }
  for (const e of entradas) await ler(e)
  return saida
}

function pedirNovaPasta(onCriarPasta: (nome: string) => string | null): string | null {
  const nome = window.prompt('Nome da pasta')
  return nome ? onCriarPasta(nome) : null
}

const CLASSE_SELECT = 'h-7 rounded-md border border-[#DDDDDD] bg-white px-1.5 text-[11px] text-[#171717]'
const CLASSE_BOTAO = 'flex h-7 items-center gap-1 rounded-md px-2 text-[11px] disabled:opacity-50'

/**
 * Biblioteca de fotos do editor, em forma de bandeja larga embaixo da lâmina
 * (a altura vem do pai). Envio (botão, arquivos ou pastas inteiras arrastadas)
 * roda em segundo plano, 3 por vez, sem travar a edição, e já gera as versões
 * leves. Organização: pastas, favoritas e prioridade (principal / secundária /
 * complementar — o Smart Layout dá mais destaque).
 */
export function PainelFotos({
  albumId,
  projetoId,
  fotos,
  usos,
  selecionadas,
  pastas,
  meta,
  filtroInicial,
  somenteLeitura,
  onAlternarSelecao,
  onSelecionarVarias,
  onLimparSelecao,
  onFotosNovas,
  onRemoverFoto,
  onCriarPagina,
  onMontarAutomatico,
  onMeta,
  onCriarPasta,
}: {
  albumId: string
  projetoId: string | null
  fotos: FotoDoEditor[]
  usos: Map<string, number>
  selecionadas: string[]
  pastas: { id: string; nome: string }[]
  meta: (id: string) => MetaFoto
  filtroInicial?: 'todas' | 'nao-usadas'
  somenteLeitura: boolean
  onAlternarSelecao: (id: string) => void
  onSelecionarVarias: (ids: string[]) => void
  onLimparSelecao: () => void
  /** Avulso: as fotos novas; projeto: a lista inteira recarregada. */
  onFotosNovas: (fotos: FotoDoEditor[], substituir: boolean) => void
  onRemoverFoto: (id: string) => void
  /** Sem uso na bandeja; mantido para o pai continuar compilando. */
  onVerLayouts?: () => void
  onCriarPagina: () => void
  /** Monta o álbum com as fotos (só aparece se informado). */
  onMontarAutomatico?: () => void
  onMeta: (ids: string[], patch: MetaFoto) => void
  onCriarPasta: (nome: string) => string | null
}) {
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial ?? 'todas')
  const [orientacao, setOrientacao] = useState<Orientacao>('todas')
  const [pasta, setPasta] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [ordem, setOrdem] = useState<Ordem>('envio')
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false)
  // Menu "⋯" de uma foto: posição fixa na tela (a bandeja rola e cortaria um menu absoluto).
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; paraCima: boolean } | null>(null)
  // Popover "Filtros" (orientação, pastas, ordem): também em posição fixa.
  const [filtros, setFiltros] = useState<{ x: number; y: number; paraCima: boolean } | null>(null)
  const filtrosAlterados = orientacao !== 'todas' || pasta !== '' || ordem !== 'envio'
  const tamanho = useSyncExternalStore(assinarTamanho, lerTamanho, () => TAMANHO_PADRAO)
  const inputRef = useRef<HTMLInputElement>(null)

  const contagem = useMemo(
    () => ({
      todas: fotos.length,
      usadas: fotos.filter((f) => usos.get(f.id)).length,
      'nao-usadas': fotos.filter((f) => !usos.get(f.id)).length,
      favoritas: fotos.filter((f) => meta(f.id).favorita).length,
    }),
    [fotos, usos, meta],
  )

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = fotos.filter((f) => {
      const m = meta(f.id)
      if (filtro === 'usadas' && !usos.get(f.id)) return false
      if (filtro === 'nao-usadas' && usos.get(f.id)) return false
      if (filtro === 'favoritas' && !m.favorita) return false
      if (orientacao !== 'todas' && orientacaoDe(f) !== orientacao) return false
      if (pasta === '__sem' ? Boolean(m.pasta) : pasta && m.pasta !== pasta) return false
      if (termo && !f.nome.toLowerCase().includes(termo)) return false
      return true
    })
    if (ordem === 'nome') lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
    if (ordem === 'captura') lista.sort((a, b) => (a.capturadaEm ?? '9').localeCompare(b.capturadaEm ?? '9'))
    if (ordem === 'orientacao') lista.sort((a, b) => (orientacaoDe(a) ?? 'z').localeCompare(orientacaoDe(b) ?? 'z'))
    return lista
  }, [fotos, usos, meta, filtro, orientacao, pasta, busca, ordem])

  async function enviar(lista: File[]) {
    if (somenteLeitura || progresso) return
    const arquivos = lista.filter((f) => TIPOS_ACEITOS.includes(f.type))
    if (arquivos.length === 0) {
      setErro('Envie JPG, PNG ou WebP.')
      return
    }
    setErro(null)
    setProgresso({ feitas: 0, total: arquivos.length })
    const fila = [...arquivos]
    let falhas = 0
    const avancar = () => setProgresso((p) => (p ? { ...p, feitas: p.feitas + 1 } : p))

    if (projetoId) {
      await Promise.all(
        Array.from({ length: UPLOADS_SIMULTANEOS }, async () => {
          while (fila.length > 0) {
            const file = fila.shift()
            if (!file) break
            try {
              await uploadProjetoFoto(projetoId, file, 'Enviadas no editor')
            } catch {
              falhas++
            }
            avancar()
          }
        }),
      )
      // As versões leves das fotos novas do projeto são geradas pelo editor em segundo plano.
      const r = await listarFotosDoEditor(albumId)
      if (r.ok) onFotosNovas(r.fotos, true)
    } else {
      const prontas: { id: string; path: string; nome: string; largura: number | null; altura: number | null }[] = []
      const derivados: Record<string, DerivadoFoto> = {}
      const locais = new Map<string, { urlMini: string; urlPreview: string; estouro: number | null; fx: number; fy: number }>()
      await Promise.all(
        Array.from({ length: UPLOADS_SIMULTANEOS }, async () => {
          while (fila.length > 0) {
            const file = fila.shift()
            if (!file) break
            const id = novoUuid()
            // Original no Cloudflare R2 (albuns/{albumId}/…); registrado abaixo, depois de conferido no R2.
            let path: string
            try {
              path = await enviarArquivoAlbum(albumId, { destino: 'foto', idArquivo: id, nome: file.name }, file)
            } catch {
              falhas++
              avancar()
              continue
            }
            let largura: number | null = null
            let altura: number | null = null
            try {
              const bitmap = await createImageBitmap(file)
              largura = bitmap.width
              altura = bitmap.height
              const d = await gerarDerivados(albumId, id, bitmap)
              bitmap.close()
              derivados[id] = { mini: d.mini, preview: d.preview, largura: d.largura, altura: d.altura, estouro: d.estouro, fx: d.fx, fy: d.fy }
              locais.set(id, { urlMini: d.urlMini, urlPreview: d.urlPreview, estouro: d.estouro, fx: d.fx, fy: d.fy })
            } catch {
              // Sem versões leves: o editor gera depois, em segundo plano.
            }
            prontas.push({ id, path, nome: file.name, largura, altura })
            avancar()
          }
        }),
      )
      if (prontas.length > 0) {
        const r = await registrarFotosAlbum(albumId, prontas)
        if (!r.ok) setErro(r.erro)
        else {
          if (Object.keys(derivados).length > 0) await registrarDerivados(albumId, derivados)
          const url = new Map(Object.entries(r.urls))
          onFotosNovas(
            prontas.map((p) => ({
              id: p.id,
              url: url.get(p.path) ?? '',
              nome: p.nome,
              largura: p.largura,
              altura: p.altura,
              ...(locais.get(p.id) ?? {}),
              temDerivados: locais.has(p.id),
            })),
            false,
          )
        }
      }
    }
    if (falhas > 0) setErro(`${falhas} foto(s) não subiram. Tente de novo.`)
    setProgresso(null)
  }

  const pct = progresso ? Math.round((progresso.feitas / progresso.total) * 100) : 0
  const fotoDoMenu = menu ? fotos.find((f) => f.id === menu.id) : undefined
  const metaDoMenu = fotoDoMenu ? meta(fotoDoMenu.id) : null

  return (
    <div
      className={cn('relative flex h-full min-h-0 flex-col', arrastandoArquivo && 'bg-sky-50')}
      onDragOver={(e) => {
        if (somenteLeitura || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setArrastandoArquivo(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setArrastandoArquivo(false)
      }}
      onDrop={async (e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setArrastandoArquivo(false)
        void enviar(await arquivosDoArrasto(e.dataTransfer))
      }}
    >
      {/* Barra de ferramentas: uma linha (quebra em telas estreitas). */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#EAEAEA] bg-white px-2 py-1.5">
        {!somenteLeitura ? (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={TIPOS_ACEITOS.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                void enviar(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            {progresso ? (
              <div className="flex h-7 items-center gap-2 rounded-md bg-[#F5F5F5] px-2 text-[11px] text-[#6B6B6B]" role="status" title="Enviando fotos… pode continuar editando">
                <span className="whitespace-nowrap">Enviando…</span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#EAEAEA]">
                  <div className="h-full bg-[#171717] transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="whitespace-nowrap tabular-nums">
                  {progresso.feitas}/{progresso.total}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={cn(CLASSE_BOTAO, 'border border-[#DDDDDD] bg-white font-semibold text-[#171717] hover:bg-[#F5F5F5]')}
                aria-label="Importar fotos (ou arraste fotos e pastas para a bandeja)"
                title="Importar fotos — ou arraste fotos e pastas para cá"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden /> Importar fotos
              </button>
            )}
          </>
        ) : null}
        {onMontarAutomatico ? (
          <button
            type="button"
            onClick={onMontarAutomatico}
            disabled={somenteLeitura || fotos.length === 0}
            className={cn(CLASSE_BOTAO, 'bg-[#171717] font-semibold text-white hover:bg-[#171717]/90')}
            aria-label="Montar álbum automaticamente"
          >
            <WandSparkles className="h-3.5 w-3.5" aria-hidden /> Montar automático
          </button>
        ) : null}

        <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className={CLASSE_SELECT} aria-label="Filtrar fotos">
          {(['todas', 'nao-usadas', 'usadas', 'favoritas'] as const).map((v) => (
            <option key={v} value={v}>
              {ROTULO_FILTRO[v]} ({contagem[v]})
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={(e) => {
            if (filtros) return setFiltros(null)
            const r = e.currentTarget.getBoundingClientRect()
            const paraCima = r.bottom + 240 > window.innerHeight
            setFiltros({ x: Math.min(r.left, window.innerWidth - 272), y: paraCima ? window.innerHeight - r.top + 4 : r.bottom + 4, paraCima })
          }}
          className={cn(CLASSE_BOTAO, 'relative border border-[#DDDDDD] bg-white text-[#171717] hover:bg-[#F5F5F5]', filtros && 'bg-[#F5F5F5]')}
          aria-haspopup="dialog"
          aria-expanded={Boolean(filtros)}
          aria-label={filtrosAlterados ? 'Filtros (com filtros ativos)' : 'Filtros'}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Filtros
          {filtrosAlterados ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#171717] ring-2 ring-white" aria-hidden /> : null}
        </button>

        {buscaAberta || busca ? (
          <label className="relative block">
            <span className="sr-only">Pesquisar fotos</span>
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9A9A9A]" aria-hidden />
            <input
              // Abre por clique na lupa: o foco vai para onde o usuário pediu.
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onBlur={() => setBuscaAberta(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setBusca('')
                  setBuscaAberta(false)
                }
              }}
              placeholder="Pesquisar arquivo"
              className="h-7 w-40 rounded-md border border-[#DDDDDD] bg-white pl-7 pr-2 text-xs text-[#171717] placeholder:text-[#9A9A9A]"
            />
          </label>
        ) : (
          <button type="button" onClick={() => setBuscaAberta(true)} className={cn(CLASSE_BOTAO, 'px-1.5 text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#171717]')} aria-label="Pesquisar fotos" title="Pesquisar">
            <Search className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}

        {visiveis.length > 0 ? (
          <button
            type="button"
            onClick={() => onSelecionarVarias(visiveis.map((f) => f.id))}
            className={cn(CLASSE_BOTAO, 'px-1.5 text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#171717]')}
            aria-label={`Selecionar as ${Math.min(visiveis.length, MAX_FOTOS_POR_LAMINA)} primeiras visíveis`}
            title={`Selecionar as ${Math.min(visiveis.length, MAX_FOTOS_POR_LAMINA)} primeiras visíveis`}
          >
            <ListChecks className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}

        {erro ? (
          <p role="alert" className="max-w-60 truncate rounded bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700" title={erro}>
            {erro}
          </p>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {selecionadas.length > 0 ? (
            <div className="flex items-center gap-0.5 rounded-md border border-[#EAEAEA] bg-[#F5F5F5] p-0.5 text-[11px] text-[#171717]">
              <button
                type="button"
                disabled={somenteLeitura}
                onClick={onCriarPagina}
                className={cn(CLASSE_BOTAO, 'h-6 bg-[#171717] font-semibold text-white hover:bg-[#171717]/90')}
                aria-label={`Criar lâmina com ${selecionadas.length} foto(s)`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Criar lâmina com {selecionadas.length}
              </button>
              <button
                type="button"
                onClick={() => onMeta(selecionadas, { favorita: !selecionadas.every((id) => meta(id).favorita) })}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#6B6B6B] hover:bg-white hover:text-[#171717]"
                aria-label="Favoritar selecionadas"
                title="Favoritar selecionadas"
              >
                <Star className="h-3.5 w-3.5" aria-hidden />
              </button>
              <select
                value=""
                onChange={(e) => onMeta(selecionadas, { prioridade: (e.target.value || null) as Prioridade | null })}
                className="h-6 w-[5.5rem] rounded-md border border-[#DDDDDD] bg-white px-1 text-[11px] text-[#171717]"
                aria-label="Prioridade das selecionadas"
              >
                <option value="">Prioridade…</option>
                <option value="principal">Principal</option>
                <option value="secundaria">Secundária</option>
                <option value="complementar">Complementar</option>
              </select>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value === '__nova') {
                    const nova = pedirNovaPasta(onCriarPasta)
                    if (nova) onMeta(selecionadas, { pasta: nova })
                  } else if (e.target.value) onMeta(selecionadas, { pasta: e.target.value === '__sem' ? null : e.target.value })
                }}
                className="h-6 w-[4.5rem] rounded-md border border-[#DDDDDD] bg-white px-1 text-[11px] text-[#171717]"
                aria-label="Mover selecionadas para pasta"
              >
                <option value="">Pasta…</option>
                {pastas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
                <option value="__sem">Sem pasta</option>
                <option value="__nova">+ Nova pasta</option>
              </select>
              <button
                type="button"
                onClick={onLimparSelecao}
                className="flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[#6B6B6B] hover:bg-white hover:text-[#171717]"
                aria-label="Limpar seleção"
              >
                <X className="h-3 w-3" aria-hidden /> Limpar
              </button>
            </div>
          ) : null}
          <label className="flex items-center gap-1.5 text-[11px] text-[#9A9A9A]">
            <span className="sr-only">Tamanho das miniaturas</span>
            <span aria-hidden className="text-[9px]">▪</span>
            <input
              type="range"
              min={TAMANHO_MIN}
              max={TAMANHO_MAX}
              step={4}
              value={tamanho}
              onChange={(e) => gravarTamanho(Number(e.target.value))}
              className="w-24 accent-[#171717]"
              aria-valuetext={`${tamanho} pixels`}
            />
            <span aria-hidden className="text-sm">■</span>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visiveis.length === 0 ? (
          <p className="p-4 text-center text-xs text-[#9A9A9A]">
            {fotos.length === 0 ? (somenteLeitura ? 'Nenhuma foto no álbum.' : 'Importe ou arraste as fotos do álbum para começar.') : 'Nenhuma foto neste filtro.'}
          </p>
        ) : (
          <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tamanho}px, 1fr))` }} aria-label="Fotos do álbum">
            {visiveis.map((f) => {
              const n = usos.get(f.id) ?? 0
              const m = meta(f.id)
              const ordemSelecao = selecionadas.indexOf(f.id)
              const marcada = ordemSelecao >= 0
              const o = orientacaoDe(f)
              const detalhes = `${f.nome}${f.largura && f.altura ? ` · ${f.largura}×${f.altura}` : ''}${o ? ` · ${NOME_ORIENTACAO[o]}` : ''}`
              return (
                <li key={f.id} className="group relative min-w-0">
                  <button
                    type="button"
                    draggable={!somenteLeitura}
                    onDragStart={(e) => {
                      // Arrastar uma foto da seleção leva a seleção inteira (na ordem em que foi marcada).
                      e.dataTransfer.setData(MIME_FOTO, marcada ? selecionadas.join(',') : f.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => onAlternarSelecao(f.id)}
                    aria-pressed={marcada}
                    aria-label={`${f.nome}${n ? `, usada ${n} vez(es)` : ', não utilizada'}`}
                    title={detalhes}
                    className={cn('relative block aspect-[5/4] w-full overflow-hidden rounded-md bg-[#F5F5F5]', marcada && 'ring-2 ring-[#171717] ring-offset-1 ring-offset-white')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- versão leve da foto (Storage). */}
                    <img src={urlParaMiniatura(f)} alt="" loading="lazy" draggable={false} className={cn('h-full w-full object-cover', n > 0 && !marcada && 'opacity-50')} />
                    {n > 0 ? (
                      <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1 text-[10px] font-semibold tabular-nums text-emerald-700 shadow">✓ {n}x</span>
                    ) : null}
                    {m.prioridade ? (
                      <span className="absolute bottom-1 right-1 rounded bg-white/90 px-1 text-[9px] font-semibold text-violet-700 shadow">{ROTULO_PRIORIDADE[m.prioridade]}</span>
                    ) : null}
                    {marcada ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#171717] text-[10px] font-bold text-white shadow ring-2 ring-white">{ordemSelecao + 1}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMeta([f.id], { favorita: !m.favorita })}
                    className={cn(
                      'absolute left-1 top-1 rounded bg-white/90 p-0.5 shadow',
                      m.favorita ? 'text-amber-500' : 'text-[#6B6B6B] opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
                    )}
                    aria-label={m.favorita ? `Tirar ${f.nome} dos favoritos` : `Favoritar ${f.nome}`}
                    aria-pressed={Boolean(m.favorita)}
                  >
                    <Star className="h-3.5 w-3.5" fill={m.favorita ? 'currentColor' : 'none'} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (menu?.id === f.id) return setMenu(null)
                      const r = e.currentTarget.getBoundingClientRect()
                      const paraCima = r.bottom + 260 > window.innerHeight
                      setMenu({ id: f.id, x: Math.min(r.left, window.innerWidth - 200), y: paraCima ? window.innerHeight - r.top + 4 : r.bottom + 4, paraCima })
                    }}
                    className={cn(
                      'absolute top-1 rounded bg-white/90 p-0.5 text-[#171717] shadow hover:bg-white',
                      marcada ? 'right-7' : 'right-1',
                      menu?.id === f.id ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
                    )}
                    aria-label={`Mais ações para ${f.nome}`}
                    aria-haspopup="menu"
                    aria-expanded={menu?.id === f.id}
                  >
                    <Ellipsis className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <p className="mt-0.5 truncate text-[10px] text-[#6B6B6B]" title={detalhes}>
                    {f.nome}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {menu && fotoDoMenu && metaDoMenu ? (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Fechar menu" onClick={() => setMenu(null)} />
          <div
            role="menu"
            aria-label={`Ações de ${fotoDoMenu.nome}`}
            className="fixed z-50 w-48 rounded-lg border border-[#EAEAEA] bg-white p-1 text-xs text-[#171717] shadow-lg"
            style={menu.paraCima ? { left: menu.x, bottom: menu.y } : { left: menu.x, top: menu.y }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMenu(null)
            }}
          >
            <p className="truncate px-2 pb-1 pt-0.5 text-[10px] text-[#9A9A9A]" title={fotoDoMenu.nome}>
              {fotoDoMenu.nome}
            </p>
            <p className="px-2 pt-1 text-[10px] uppercase tracking-wide text-[#9A9A9A]">Prioridade</p>
            {([null, 'principal', 'secundaria', 'complementar'] as const).map((p) => (
              <button
                key={p ?? 'nenhuma'}
                type="button"
                role="menuitemradio"
                aria-checked={(metaDoMenu.prioridade ?? null) === p}
                onClick={() => {
                  onMeta([fotoDoMenu.id], { prioridade: p })
                  setMenu(null)
                }}
                className={cn('block w-full rounded px-2 py-1 text-left hover:bg-[#F5F5F5]', (metaDoMenu.prioridade ?? null) === p && 'bg-[#171717] text-white hover:bg-[#171717]')}
              >
                {p ? ROTULO_PRIORIDADE[p] : 'Nenhuma'}
              </button>
            ))}
            <p className="border-t border-[#EAEAEA] px-2 pt-1.5 text-[10px] uppercase tracking-wide text-[#9A9A9A]">Mover para pasta</p>
            {[...pastas, { id: '__sem', nome: 'Sem pasta' }].map((p) => {
              const atual = p.id === '__sem' ? !metaDoMenu.pasta : metaDoMenu.pasta === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={atual}
                  onClick={() => {
                    onMeta([fotoDoMenu.id], { pasta: p.id === '__sem' ? null : p.id })
                    setMenu(null)
                  }}
                  className={cn('block w-full truncate rounded px-2 py-1 text-left hover:bg-[#F5F5F5]', atual && 'bg-[#171717] text-white hover:bg-[#171717]')}
                >
                  {p.nome}
                </button>
              )
            })}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const nova = pedirNovaPasta(onCriarPasta)
                if (nova) onMeta([fotoDoMenu.id], { pasta: nova })
                setMenu(null)
              }}
              className="block w-full rounded px-2 py-1 text-left text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#171717]"
            >
              + Nova pasta
            </button>
            {!projetoId && !somenteLeitura && !usos.get(fotoDoMenu.id) ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onRemoverFoto(fotoDoMenu.id)
                  setMenu(null)
                }}
                className="mt-0.5 flex w-full items-center gap-1.5 rounded border-t border-[#EAEAEA] px-2 py-1 text-left text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" aria-hidden /> Remover do álbum
              </button>
            ) : null}
          </div>
        </>
      ) : null}
      {filtros ? (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Fechar filtros" onClick={() => setFiltros(null)} />
          <div
            role="dialog"
            aria-label="Filtros da bandeja"
            className="fixed z-50 w-64 space-y-2.5 rounded-lg border border-[#EAEAEA] bg-white p-2.5 text-xs text-[#171717] shadow-lg"
            style={filtros.paraCima ? { left: filtros.x, bottom: filtros.y } : { left: filtros.x, top: filtros.y }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setFiltros(null)
            }}
          >
            <label className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wide text-[#9A9A9A]">Orientação</span>
              <select
                // Abre por clique no botão: o foco entra no popover (e o Esc fecha).
                autoFocus
                value={orientacao}
                onChange={(e) => setOrientacao(e.target.value as Orientacao)}
                className={cn(CLASSE_SELECT, 'w-32')}
              >
                <option value="todas">Todas</option>
                <option value="horizontal">Horizontais</option>
                <option value="vertical">Verticais</option>
                <option value="quadrada">Quadradas</option>
                <option value="panoramica">Panorâmicas</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wide text-[#9A9A9A]">Ordenar por</span>
              <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className={cn(CLASSE_SELECT, 'w-32')}>
                <option value="envio">Envio</option>
                <option value="nome">Nome</option>
                <option value="captura">Captura</option>
                <option value="orientacao">Orientação</option>
              </select>
            </label>
            <div>
              <p className="pb-1 text-[10px] uppercase tracking-wide text-[#9A9A9A]">Pasta</p>
              <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Pastas">
                {[{ id: '', nome: 'Todas' }, ...pastas, { id: '__sem', nome: 'Sem pasta' }].map((p) => (
                  <button
                    key={p.id || '__todas'}
                    type="button"
                    role="radio"
                    aria-checked={pasta === p.id}
                    onClick={() => setPasta(p.id)}
                    className={cn(
                      'h-6 max-w-32 truncate rounded-full border px-2 text-[11px]',
                      pasta === p.id ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#DDDDDD] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#171717]',
                    )}
                  >
                    {p.nome}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const nova = pedirNovaPasta(onCriarPasta)
                    if (nova) setPasta(nova)
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-[#DDDDDD] text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#171717]"
                  aria-label="Nova pasta"
                  title="Nova pasta"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
            {filtrosAlterados ? (
              <button
                type="button"
                onClick={() => {
                  setOrientacao('todas')
                  setPasta('')
                  setOrdem('envio')
                }}
                className="w-full rounded-md border-t border-[#EAEAEA] px-2 pt-2 text-left text-[11px] text-[#6B6B6B] hover:text-[#171717]"
              >
                Restaurar padrão
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
