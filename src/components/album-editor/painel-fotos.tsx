'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, FolderPlus, LayoutGrid, Plus, Search, Star, Trash2, UploadCloud } from 'lucide-react'
import { MIME_FOTO, urlParaMiniatura } from '@/components/album-editor/tipos'
import { createClient } from '@/lib/supabase/client'
import { listarFotosDoEditor, registrarFotosAlbum } from '@/lib/actions/album-editor'
import { registerFoto } from '@/lib/actions/projetos'
import { uploadProjetoFoto } from '@/lib/upload-projeto-foto'
import { gerarDerivados, registrarDerivados } from '@/lib/album/derivados'
import type { FotoDoEditor } from '@/lib/supabase/queries'
import type { DerivadoFoto } from '@/types/database'
import { cn } from '@/lib/utils'
// randomUUID só existe em HTTPS/localhost; este funciona também pelo IP da rede.
import { novoUuid } from '@/store/usePedidoWizardStore'

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']
const UPLOADS_SIMULTANEOS = 3
const EXPIRACAO_SEGUNDOS = 8 * 60 * 60

export type Prioridade = 'principal' | 'secundaria' | 'complementar'
export type MetaFoto = { pasta?: string | null; favorita?: boolean; prioridade?: Prioridade | null }
type Filtro = 'todas' | 'nao-usadas' | 'usadas' | 'favoritas'
type Orientacao = 'todas' | 'horizontal' | 'vertical' | 'quadrada' | 'panoramica'
type Ordem = 'nome' | 'captura' | 'orientacao' | 'envio'

const ROTULO_PRIORIDADE: Record<Prioridade, string> = { principal: 'Principal', secundaria: 'Secundária', complementar: 'Complementar' }

function nomeSeguro(nome: string) {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(-80) || 'foto'
  )
}

function orientacaoDe(f: FotoDoEditor): Exclude<Orientacao, 'todas'> | null {
  if (!f.largura || !f.altura) return null
  const a = f.largura / f.altura
  if (a >= 2.1) return 'panoramica'
  if (a > 1.05) return 'horizontal'
  if (a < 0.95) return 'vertical'
  return 'quadrada'
}

const NOME_ORIENTACAO: Record<Exclude<Orientacao, 'todas'>, string> = { horizontal: 'Horizontal', vertical: 'Vertical', quadrada: 'Quadrada', panoramica: 'Panorâmica' }

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

/**
 * Biblioteca de fotos do editor. Envio (botão, arquivos ou pastas inteiras
 * arrastadas) roda em segundo plano, 3 por vez, sem travar a edição, e já
 * gera as versões leves. Organização: pastas, favoritas e prioridade
 * (principal / secundária / complementar — o Smart Layout dá mais destaque).
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
  onVerLayouts,
  onCriarPagina,
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
  onVerLayouts: () => void
  onCriarPagina: () => void
  onMeta: (ids: string[], patch: MetaFoto) => void
  onCriarPasta: (nome: string) => string | null
}) {
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial ?? 'todas')
  const [orientacao, setOrientacao] = useState<Orientacao>('todas')
  const [pasta, setPasta] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('envio')
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false)
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
              const { storagePath, url, meta: exif } = await uploadProjetoFoto(projetoId, file)
              await registerFoto({ projetoId, storagePath, url, grupo: 'Enviadas no editor', capturadaEm: exif.capturadaEm, camera: exif.camera })
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
      const supabase = createClient()
      const prontas: { id: string; path: string; nome: string; largura: number | null; altura: number | null }[] = []
      const derivados: Record<string, DerivadoFoto> = {}
      const locais = new Map<string, { urlMini: string; urlPreview: string; estouro: number | null; fx: number; fy: number }>()
      await Promise.all(
        Array.from({ length: UPLOADS_SIMULTANEOS }, async () => {
          while (fila.length > 0) {
            const file = fila.shift()
            if (!file) break
            const id = novoUuid()
            const path = `${albumId}/${id}-${nomeSeguro(file.name)}`
            const { error } = await supabase.storage.from('albuns_fotos').upload(path, file, { cacheControl: '3600', contentType: file.type })
            if (error) {
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
          const { data } = await supabase.storage.from('albuns_fotos').createSignedUrls(prontas.map((p) => p.path), EXPIRACAO_SEGUNDOS)
          const url = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
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
  const selecaoMeta = selecionadas.length > 0 ? selecionadas : []

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col', arrastandoArquivo && 'bg-sky-500/10')}
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
      <div className="space-y-2 border-b border-white/10 p-3">
        <div className="grid grid-cols-4 gap-1 text-[10px]" role="radiogroup" aria-label="Filtrar fotos">
          {(
            [
              ['todas', 'Todas'],
              ['usadas', 'Usadas'],
              ['nao-usadas', 'Não usadas'],
              ['favoritas', 'Favoritas'],
            ] as const
          ).map(([v, r]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={filtro === v}
              onClick={() => setFiltro(v)}
              className={cn('rounded-md px-1 py-1 leading-tight', filtro === v ? 'bg-white text-[#171717]' : 'bg-white/10 text-white/80 hover:bg-white/20')}
            >
              {r}
              <span className="block tabular-nums opacity-70">{contagem[v]}</span>
            </button>
          ))}
        </div>
        <label className="relative block">
          <span className="sr-only">Pesquisar fotos</span>
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar arquivo" className="w-full rounded-md border border-white/20 bg-white/5 py-1.5 pl-7 pr-2 text-xs text-white" />
        </label>
        <div className="grid grid-cols-3 gap-1">
          <select value={orientacao} onChange={(e) => setOrientacao(e.target.value as Orientacao)} className="rounded-md border border-white/20 bg-[#1c1c1c] px-1 py-1 text-[11px] text-white" aria-label="Orientação">
            <option value="todas">Orientação</option>
            <option value="horizontal">Horizontais</option>
            <option value="vertical">Verticais</option>
            <option value="quadrada">Quadradas</option>
            <option value="panoramica">Panorâmicas</option>
          </select>
          <select value={pasta} onChange={(e) => setPasta(e.target.value)} className="rounded-md border border-white/20 bg-[#1c1c1c] px-1 py-1 text-[11px] text-white" aria-label="Pasta">
            <option value="">Pastas</option>
            <option value="__sem">Sem pasta</option>
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="rounded-md border border-white/20 bg-[#1c1c1c] px-1 py-1 text-[11px] text-white" aria-label="Ordenar">
            <option value="envio">Envio</option>
            <option value="nome">Nome</option>
            <option value="captura">Captura</option>
            <option value="orientacao">Orientação</option>
          </select>
        </div>
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
              <div className="space-y-1 rounded-lg bg-white/5 p-2 text-[11px] text-white/80" role="status">
                <p>Enviando fotos… pode continuar editando</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="tabular-nums">
                  {pct}% · {progresso.feitas} de {progresso.total} fotos
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-white/30 px-2 py-2.5 text-xs text-white/80 hover:bg-white/10"
              >
                <UploadCloud className="h-5 w-5" aria-hidden />
                Arraste fotos ou pastas, ou clique para enviar
              </button>
            )}
          </>
        ) : null}
        {erro ? (
          <p role="alert" className="text-xs text-red-300">
            {erro}
          </p>
        ) : null}
      </div>

      {selecionadas.length > 0 ? (
        <div className="space-y-1.5 border-b border-white/10 bg-sky-500/10 p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">{selecionadas.length} selecionada(s)</span>
            <button type="button" onClick={onLimparSelecao} className="text-white/70 underline">
              Limpar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" disabled={somenteLeitura} onClick={onCriarPagina} className="flex items-center justify-center gap-1 rounded-md bg-white px-2 py-1.5 font-semibold text-[#171717] disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Criar página
            </button>
            <button type="button" onClick={onVerLayouts} className="flex items-center justify-center gap-1 rounded-md bg-white/15 px-2 py-1.5 hover:bg-white/25">
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Composições
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button type="button" onClick={() => onMeta(selecaoMeta, { favorita: !selecionadas.every((id) => meta(id).favorita) })} className="rounded-md bg-white/10 px-1 py-1 hover:bg-white/20">
              ★ Favoritar
            </button>
            <select
              value=""
              onChange={(e) => onMeta(selecaoMeta, { prioridade: (e.target.value || null) as Prioridade | null })}
              className="rounded-md border-0 bg-white/10 px-1 py-1 text-white"
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
                  const nome = window.prompt('Nome da pasta')
                  const nova = nome ? onCriarPasta(nome) : null
                  if (nova) onMeta(selecaoMeta, { pasta: nova })
                } else onMeta(selecaoMeta, { pasta: e.target.value === '__sem' ? null : e.target.value })
              }}
              className="rounded-md border-0 bg-white/10 px-1 py-1 text-white"
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
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-white/60">
          <span>Clique para selecionar · arraste para a lâmina</span>
          <button
            type="button"
            onClick={() => {
              const nome = window.prompt('Nome da pasta')
              if (nome) onCriarPasta(nome)
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10"
            aria-label="Nova pasta"
          >
            <FolderPlus className="h-3.5 w-3.5" aria-hidden /> Pasta
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visiveis.length > 0 ? (
          <button type="button" onClick={() => onSelecionarVarias(visiveis.map((f) => f.id))} className="mb-1.5 text-[11px] text-white/60 underline">
            Selecionar as {Math.min(visiveis.length, 12)} primeiras visíveis
          </button>
        ) : null}
        {visiveis.length === 0 ? (
          <p className="p-4 text-center text-xs text-white/50">
            {fotos.length === 0 ? 'Envie as fotos do álbum para começar.' : 'Nenhuma foto neste filtro.'}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {visiveis.map((f) => {
              const n = usos.get(f.id) ?? 0
              const m = meta(f.id)
              const marcada = selecionadas.includes(f.id)
              const o = orientacaoDe(f)
              return (
                <li key={f.id} className="group relative">
                  <button
                    type="button"
                    draggable={!somenteLeitura}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(MIME_FOTO, f.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => onAlternarSelecao(f.id)}
                    aria-pressed={marcada}
                    aria-label={`${f.nome}${n ? `, usada ${n} vez(es)` : ', não utilizada'}`}
                    className={cn('relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-white/5', marcada && 'ring-2 ring-sky-400')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- versão leve da foto (Storage). */}
                    <img src={urlParaMiniatura(f)} alt="" loading="lazy" draggable={false} className={cn('h-full w-full object-cover', n > 0 && !marcada && 'opacity-60')} />
                    <span
                      className={cn(
                        'absolute bottom-1 left-1 flex items-center gap-0.5 rounded px-1 text-[10px] font-semibold',
                        n > 0 ? 'bg-emerald-500 text-white' : 'bg-black/70 text-white/90',
                      )}
                    >
                      {n > 0 ? (
                        <>
                          <Check className="h-2.5 w-2.5" aria-hidden />
                          Usada{n > 1 ? ` ${n}×` : ''}
                        </>
                      ) : (
                        'Não utilizada'
                      )}
                    </span>
                    {m.prioridade ? (
                      <span className="absolute right-1 bottom-1 rounded bg-violet-500 px-1 text-[9px] font-semibold text-white">{ROTULO_PRIORIDADE[m.prioridade]}</span>
                    ) : null}
                    {marcada ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-400 text-[10px] font-bold text-[#0A0A0A]">
                        {selecionadas.indexOf(f.id) + 1}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMeta([f.id], { favorita: !m.favorita })}
                    className={cn('absolute left-1 top-1 rounded bg-black/60 p-0.5', m.favorita ? 'text-amber-300' : 'hidden text-white/80 group-hover:block')}
                    aria-label={m.favorita ? 'Tirar dos favoritos' : 'Favoritar'}
                    aria-pressed={Boolean(m.favorita)}
                  >
                    <Star className="h-3.5 w-3.5" fill={m.favorita ? 'currentColor' : 'none'} />
                  </button>
                  <p className="mt-0.5 truncate text-[10px] text-white/70" title={f.nome}>
                    {f.nome}
                  </p>
                  <p className="text-[10px] tabular-nums text-white/40">
                    {f.largura && f.altura ? `${f.largura}×${f.altura}` : '…'}
                    {o ? ` · ${NOME_ORIENTACAO[o]}` : ''}
                  </p>
                  {!projetoId && n === 0 && !somenteLeitura ? (
                    <button
                      type="button"
                      onClick={() => onRemoverFoto(f.id)}
                      className="absolute right-1 top-7 hidden rounded bg-black/70 p-1 text-white group-hover:block"
                      aria-label={`Remover ${f.nome} do álbum`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
