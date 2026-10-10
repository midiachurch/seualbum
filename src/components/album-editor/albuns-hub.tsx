'use client'

import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, BookOpen, FolderKanban, Loader2, MoreVertical, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ROTULO_STATUS } from '@/components/album-editor/aprovacao-painel'
import { arquivarAlbum, atualizarDadosAlbum, criarAlbumAvulso, duplicarAlbum, excluirAlbumAvulso } from '@/lib/actions/album-editor'
import { ESTILOS, MODELOS_DE_ALBUM, estiloPorId, type EstiloId } from '@/lib/album/modelos'
import { laminaEmCm } from '@/lib/resolucao'
import type { AlbumResumo } from '@/lib/supabase/queries'
import { PROJECT_STATUS_LABEL, type AlbumOrientationValue, type ProjectStatus } from '@/types/platform'
import { cn } from '@/lib/utils'

type Filtro = 'todos' | 'edicao' | 'aprovacao' | 'aprovados' | 'finalizados' | 'arquivados'
type Ordem = 'recentes' | 'antigos' | 'nome' | 'edicao'
type Grupo = 'edicao' | 'aprovacao' | 'aprovados' | 'finalizados'

const STATUS_PROJETO_APROVACAO = ['aguardando_aprovacao_cliente', 'alteracoes_solicitadas']
const STATUS_PROJETO_APROVADO = ['aprovado_aguardando_pagamento', 'aprovado']
const STATUS_PROJETO_FINAL = ['enviado', 'finalizado', 'arquivado']

/** Em que grupo o álbum cai: avulso pelo status próprio; de projeto pelo status do projeto. */
function grupoDe(a: AlbumResumo): Grupo {
  if (a.projeto) {
    if (STATUS_PROJETO_FINAL.includes(a.projeto.status)) return 'finalizados'
    if (STATUS_PROJETO_APROVADO.includes(a.projeto.status)) return 'aprovados'
    if (STATUS_PROJETO_APROVACAO.includes(a.projeto.status)) return 'aprovacao'
    return 'edicao'
  }
  if (a.status === 'finalizado' || a.status === 'em_producao') return 'finalizados'
  if (a.status === 'aprovado') return 'aprovados'
  if (a.status === 'enviado_aprovacao' || a.status === 'alteracoes_solicitadas') return 'aprovacao'
  return 'edicao'
}

function rotuloStatus(a: AlbumResumo) {
  return a.projeto ? (PROJECT_STATUS_LABEL[a.projeto.status as ProjectStatus] ?? a.projeto.status) : ROTULO_STATUS[a.status]
}

function haQuanto(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} hora${h > 1 ? 's' : ''}`
  const d = Math.round(h / 24)
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`
  return `em ${new Date(iso).toLocaleDateString('pt-BR')}`
}

const COR_GRUPO: Record<Grupo, string> = {
  edicao: 'bg-sky-100 text-sky-900',
  aprovacao: 'bg-amber-100 text-amber-900',
  aprovados: 'bg-emerald-100 text-emerald-800',
  finalizados: 'bg-violet-100 text-violet-900',
}

const CHAVE_ULTIMO = 'seualbum:ultimo-album'

// Último álbum aberto, lido do localStorage sem efeito (null no servidor e sem armazenamento).
function assinarArmazenamento(aviso: () => void) {
  window.addEventListener('storage', aviso)
  return () => window.removeEventListener('storage', aviso)
}
function lerUltimo(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_ULTIMO)
  } catch {
    return null
  }
}

/**
 * Projetos → Álbuns: todos os álbuns do editor (avulsos e de projeto). Os
 * avulsos são criados aqui; os de projeto nascem ao abrir o editor pela fila
 * de design ou pela página do projeto.
 */
export function AlbunsHub({ albuns, podeEditar, semTabelas = false }: { albuns: AlbumResumo[]; podeEditar: boolean; semTabelas?: boolean }) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [cliente, setCliente] = useState('')
  const [periodo, setPeriodo] = useState<'' | '7' | '30' | '90'>('')
  const [ordem, setOrdem] = useState<Ordem>('edicao')
  const [novo, setNovo] = useState(false)
  const [excluir, setExcluir] = useState<AlbumResumo | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // Instante de corte do filtro de data, calculado ao escolher o período (render puro).
  const [limite, setLimite] = useState<number | null>(null)
  const ultimo = useSyncExternalStore(assinarArmazenamento, lerUltimo, () => null)

  const hrefDe = (a: AlbumResumo) => (a.projeto ? `/admin/projetos/${a.projeto.id}/editor` : `/admin/albuns/${a.id}`)
  const abrir = (a: AlbumResumo, extra = '') => {
    try {
      window.localStorage.setItem(CHAVE_ULTIMO, a.id)
    } catch {
      // sem armazenamento local
    }
    router.push(hrefDe(a) + extra)
  }

  const clientes = useMemo(() => [...new Set(albuns.map((a) => a.clienteNome).filter((c): c is string => Boolean(c)))].sort(), [albuns])
  const ativos = albuns.filter((a) => !a.arquivado)
  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todos: ativos.length, edicao: 0, aprovacao: 0, aprovados: 0, finalizados: 0, arquivados: albuns.length - ativos.length }
    for (const a of ativos) c[grupoDe(a)]++
    return c
  }, [albuns, ativos])
  const continuar = albuns.find((a) => a.id === ultimo && !a.arquivado) ?? null

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const filtrada = albuns.filter((a) => {
      if (filtro === 'arquivados' ? !a.arquivado : a.arquivado) return false
      if (filtro !== 'todos' && filtro !== 'arquivados' && grupoDe(a) !== filtro) return false
      if (cliente && a.clienteNome !== cliente) return false
      if (limite && new Date(a.atualizadoEm).getTime() < limite) return false
      if (termo && ![a.nome, a.clienteNome, a.projeto?.nome, a.projeto ? `#${a.projeto.numero}` : ''].some((v) => v?.toLowerCase().includes(termo))) return false
      return true
    })
    return [...filtrada].sort((x, y) => {
      if (ordem === 'nome') return x.nome.localeCompare(y.nome, 'pt-BR')
      if (ordem === 'antigos') return x.criadoEm.localeCompare(y.criadoEm)
      if (ordem === 'recentes') return y.criadoEm.localeCompare(x.criadoEm)
      return y.atualizadoEm.localeCompare(x.atualizadoEm)
    })
  }, [albuns, filtro, busca, cliente, limite, ordem])

  async function acao(a: AlbumResumo, tipo: 'renomear' | 'duplicar' | 'arquivar') {
    setMenu(null)
    setErro(null)
    if (tipo === 'renomear') {
      const novoNome = window.prompt('Novo nome do álbum', a.nome)?.trim()
      if (!novoNome || novoNome === a.nome) return
      const r = await atualizarDadosAlbum(a.id, { nome: novoNome })
      if (!r.ok) setErro(r.erro)
      router.refresh()
      return
    }
    setOcupado(a.id)
    const r = tipo === 'duplicar' ? await duplicarAlbum(a.id) : await arquivarAlbum(a.id, !a.arquivado)
    setOcupado(null)
    if (!r.ok) setErro(r.erro)
    if (tipo === 'duplicar' && r.ok && 'id' in r) router.push(`/admin/albuns/${r.id}`)
    else router.refresh()
  }

  const FILTROS: { chave: Filtro; rotulo: string }[] = [
    { chave: 'todos', rotulo: 'Todos' },
    { chave: 'edicao', rotulo: 'Em edição' },
    { chave: 'aprovacao', rotulo: 'Aguardando aprovação' },
    { chave: 'aprovados', rotulo: 'Aprovados' },
    { chave: 'finalizados', rotulo: 'Finalizados' },
    { chave: 'arquivados', rotulo: 'Arquivados' },
  ]

  return (
    <div className="space-y-6" onClick={() => menu && setMenu(null)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Projetos</p>
          <h1 className="text-2xl font-bold tracking-tight">Álbuns</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Os álbuns avulsos, criados aqui, e os dos projetos da esteira.</p>
        </div>
        {podeEditar ? (
          <Button variant="brand" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Novo Álbum
          </Button>
        ) : null}
      </div>

      {semTabelas ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          O editor ainda não está ativo neste banco: aplique a migration 0027 (supabase/migrations/0027_album_layouts.sql) no SQL Editor do Supabase. Até lá, não
          dá para criar nem abrir álbuns.
        </p>
      ) : null}

      {continuar ? (
        <button type="button" onClick={() => abrir(continuar)} className="flex w-full items-center gap-3 rounded-2xl border bg-secondary/40 p-3 text-left hover:bg-secondary">
          {continuar.miniatura ? (
            // eslint-disable-next-line @next/next/no-img-element -- capa gerada pelo editor (data URL).
            <img src={continuar.miniatura} alt="" className="h-12 w-24 rounded object-cover" />
          ) : (
            <BookOpen className="h-8 w-8 text-[#8A7B6A]" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Seu projeto foi salvo automaticamente</span>
            <span className="block truncate font-semibold">{continuar.nome}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold">
            Continuar edição <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </button>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist">
        {FILTROS.map((f) => (
          <button
            key={f.chave}
            type="button"
            role="tab"
            aria-selected={filtro === f.chave}
            onClick={() => setFiltro(f.chave)}
            className={cn('min-h-[40px] rounded-full px-4 text-sm font-medium', filtro === f.chave ? 'bg-[#171717] text-white' : 'bg-secondary hover:bg-secondary/70')}
          >
            {f.rotulo}
            <span className="ml-1.5 tabular-nums opacity-70">{contagem[f.chave]}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Buscar álbum</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar álbum..." className="pl-9" />
        </label>
        <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Filtrar por cliente">
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={periodo} onChange={(e) => {
            const p = e.target.value as typeof periodo
            setPeriodo(p)
            setLimite(p ? Date.now() - Number(p) * 86_400_000 : null)
          }} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Filtrar por data">
          <option value="">Qualquer data</option>
          <option value="7">Editados nos últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Ordenar">
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="nome">Nome</option>
          <option value="edicao">Última edição</option>
        </select>
      </div>

      {erro ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : null}

      {lista.length === 0 ? (
        <EmptyState
          title={albuns.length === 0 ? 'Nenhum álbum ainda' : 'Nada encontrado'}
          description={albuns.length === 0 ? 'Crie um álbum ou abra o editor a partir de um projeto.' : 'Ajuste a busca ou os filtros.'}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((a) => {
            const grupo = grupoDe(a)
            return (
              <li key={a.id} className="relative flex flex-col overflow-hidden rounded-2xl border bg-card">
                <button type="button" onClick={() => abrir(a)} className="relative block aspect-[2/1] bg-[#F5F0EA]" aria-label={`Abrir ${a.nome}`}>
                  {a.miniatura ? (
                    // eslint-disable-next-line @next/next/no-img-element -- capa gerada pelo editor (data URL).
                    <img src={a.miniatura} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center">
                      <BookOpen className="h-10 w-10 text-[#8A7B6A]" aria-hidden />
                    </span>
                  )}
                </button>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate font-semibold">{a.nome}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenu((m) => (m === a.id ? null : a.id))
                      }}
                      className="-mr-1 rounded p-1 hover:bg-secondary"
                      aria-label={`Ações de ${a.nome}`}
                      aria-expanded={menu === a.id}
                    >
                      {ocupado === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {a.laminas * 2} páginas · {a.fotos} fotos
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {a.projeto ? (
                      <span className="inline-flex items-center gap-1">
                        <FolderKanban className="h-3.5 w-3.5" aria-hidden /> Projeto #{a.projeto.numero}
                      </span>
                    ) : (
                      <>Cliente: {a.clienteNome ?? '—'}</>
                    )}
                  </p>
                  {/* Tempo relativo depende do relógio: servidor e navegador divergem no minuto. */}
                  <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                    Editado {haQuanto(a.atualizadoEm)}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', COR_GRUPO[grupo])}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                      {rotuloStatus(a)}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => abrir(a)}>
                      Abrir
                    </Button>
                  </div>
                </div>
                {menu === a.id ? (
                  <ul className="absolute right-3 top-[calc(50%+0.5rem)] z-10 w-48 overflow-hidden rounded-xl border bg-white py-1 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
                    {!a.projeto && podeEditar ? (
                      <li>
                        <button type="button" onClick={() => acao(a, 'renomear')} className="block w-full px-3 py-2 text-left hover:bg-secondary">
                          Renomear
                        </button>
                      </li>
                    ) : null}
                    {podeEditar ? (
                      <li>
                        <button type="button" onClick={() => acao(a, 'duplicar')} className="block w-full px-3 py-2 text-left hover:bg-secondary">
                          Duplicar
                        </button>
                      </li>
                    ) : null}
                    <li>
                      <button type="button" onClick={() => abrir(a, '?abrir=compartilhar')} className="block w-full px-3 py-2 text-left hover:bg-secondary">
                        Compartilhar
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => abrir(a, '?abrir=visualizar')} className="block w-full px-3 py-2 text-left hover:bg-secondary">
                        Ver versão
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => abrir(a, '?abrir=historico')} className="block w-full px-3 py-2 text-left hover:bg-secondary">
                        Histórico
                      </button>
                    </li>
                    {podeEditar ? (
                      <li>
                        <button type="button" onClick={() => acao(a, 'arquivar')} className="block w-full px-3 py-2 text-left hover:bg-secondary">
                          {a.arquivado ? 'Desarquivar' : 'Arquivar'}
                        </button>
                      </li>
                    ) : null}
                    {!a.projeto && podeEditar ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            setMenu(null)
                            setExcluir(a)
                          }}
                          className="block w-full px-3 py-2 text-left text-destructive hover:bg-secondary"
                        >
                          Excluir
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <NovoAlbum
        aberto={novo}
        onFechar={() => setNovo(false)}
        onCriado={(id) => {
          try {
            window.localStorage.setItem(CHAVE_ULTIMO, id)
          } catch {
            // sem armazenamento local
          }
          router.push(`/admin/albuns/${id}`)
        }}
      />

      <ConfirmDialog
        open={Boolean(excluir)}
        onClose={() => setExcluir(null)}
        onConfirm={async () => {
          if (!excluir) return
          const r = await excluirAlbumAvulso(excluir.id)
          if (!r.ok) setErro(r.erro)
          router.refresh()
        }}
        title="Excluir álbum?"
        description={`"${excluir?.nome}", as fotos enviadas para ele e os links de aprovação serão apagados. Não dá para desfazer.`}
      />
    </div>
  )
}

const TIPOS = ['Casamento', 'Infantil', 'Família', '15 anos', 'Formatura', 'Corporativo', 'Viagem', 'Evento', 'Ensaio', 'Outro']
const FORMATOS = [
  { valor: '20x20', rotulo: '20 × 20 cm' },
  { valor: '25x25', rotulo: '25 × 25 cm' },
  { valor: '30x30', rotulo: '30 × 30 cm' },
  { valor: '20x30', rotulo: '20 × 30 cm' },
  { valor: '30x40', rotulo: '30 × 40 cm' },
]
const ORIENTACOES: { valor: AlbumOrientationValue; rotulo: string }[] = [
  { valor: 'quadrado', rotulo: 'Quadrado' },
  { valor: 'vertical', rotulo: 'Retrato' },
  { valor: 'horizontal', rotulo: 'Paisagem' },
]
/** Categoria de modelo mais próxima de cada tipo de álbum. */
const CATEGORIA_DO_TIPO: Record<string, string> = { Evento: 'Eventos', Ensaio: 'Família', Outro: 'Clássico' }

function NovoAlbum({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: (id: string) => void }) {
  const [nome, setNome] = useState('')
  const [cliente, setCliente] = useState('')
  const [tipo, setTipo] = useState('Casamento')
  const [formato, setFormato] = useState('30x30')
  const [personalizado, setPersonalizado] = useState(false)
  const [orientacao, setOrientacao] = useState<AlbumOrientationValue>('quadrado')
  const [estilo, setEstilo] = useState<EstiloId | 'personalizado'>('classico')
  const [paginas, setPaginas] = useState('30')
  const [paginasTocadas, setPaginasTocadas] = useState(false)
  const [fotosEstimadas, setFotosEstimadas] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const primeiroCampo = useRef<HTMLInputElement>(null)

  const cm = laminaEmCm({ formato, orientacao })
  const nPaginas = Math.floor(Number(paginas))
  const laminas = Math.max(1, Math.ceil(nPaginas / 2))
  const valido = nome.trim().length >= 2 && cm !== null && nPaginas >= 2 && nPaginas <= 400

  // Fotos estimadas → sugestão de páginas pelo ritmo do estilo (até o designer mexer nas páginas).
  // Roda nos handlers de fotos e de estilo, não num efeito.
  function sugerirPaginas(fotos: string, est: EstiloId | 'personalizado') {
    const n = Number(fotos)
    if (paginasTocadas || !(n > 0)) return
    const ritmo = estiloPorId(est === 'personalizado' ? 'classico' : est).ritmo
    const media = ritmo.reduce((a, b) => a + b, 0) / ritmo.length
    setPaginas(String(Math.max(2, Math.min(400, Math.ceil(n / media) * 2))))
  }
  function escolherEstilo(est: EstiloId | 'personalizado') {
    setEstilo(est)
    sugerirPaginas(fotosEstimadas, est)
  }

  const modelo = useMemo(() => {
    if (estilo === 'personalizado') return null
    const categoria = CATEGORIA_DO_TIPO[tipo] ?? tipo
    return MODELOS_DE_ALBUM.find((m) => m.estilo === estilo && m.categoria === categoria) ?? MODELOS_DE_ALBUM.find((m) => m.estilo === estilo) ?? null
  }, [estilo, tipo])

  async function criar() {
    if (!valido) return
    setCriando(true)
    setErro(null)
    const r = await criarAlbumAvulso({
      nome,
      clienteNome: cliente,
      tipo,
      formato,
      orientacao,
      laminasIniciais: laminas,
      modeloId: modelo?.id ?? null,
      fotosEstimadas: fotosEstimadas ? Math.floor(Number(fotosEstimadas)) : null,
    })
    setCriando(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    onCriado(r.id)
  }

  const chip = (ativo: boolean) => cn('min-h-[40px] rounded-full border px-4 text-sm', ativo ? 'border-[#171717] bg-[#171717] text-white' : 'hover:bg-secondary')

  return (
    <Modal open={aberto} onClose={() => !criando && onFechar()} title="Novo Álbum" className="sm:max-w-xl">
      <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sa-nome">Nome do álbum</Label>
            <Input ref={primeiroCampo} id="sa-nome" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} placeholder="Casamento Ana & João" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-cliente">Cliente</Label>
            <Input id="sa-cliente" value={cliente} maxLength={120} onChange={(e) => setCliente(e.target.value)} placeholder="Ana & João" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Tipo de álbum</Label>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)} className={chip(tipo === t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Formato</Label>
          <div className="flex flex-wrap gap-2">
            {FORMATOS.map((o) => (
              <button
                key={o.valor}
                type="button"
                onClick={() => {
                  setFormato(o.valor)
                  setPersonalizado(false)
                }}
                className={chip(!personalizado && formato === o.valor)}
              >
                {o.rotulo}
              </button>
            ))}
            <button type="button" onClick={() => setPersonalizado(true)} className={chip(personalizado)}>
              Personalizado
            </button>
          </div>
          {personalizado ? (
            <Input
              aria-label="Formato personalizado"
              value={formato}
              onChange={(e) => setFormato(e.target.value.toLowerCase().replace('×', 'x').replace(/\s|cm/g, ''))}
              placeholder="largura x altura em cm, ex.: 24x30"
              className="w-60"
            />
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label>Orientação</Label>
          <div className="flex flex-wrap gap-2">
            {ORIENTACOES.map((o) => (
              <button key={o.valor} type="button" onClick={() => setOrientacao(o.valor)} className={chip(orientacao === o.valor)}>
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Modelo inicial</Label>
          <div className="flex flex-wrap gap-2">
            {ESTILOS.map((e) => (
              <button key={e.id} type="button" onClick={() => escolherEstilo(e.id)} className={chip(estilo === e.id)} title={e.descricao}>
                {e.nome}
              </button>
            ))}
            <button type="button" onClick={() => escolherEstilo('personalizado')} className={chip(estilo === 'personalizado')}>
              Personalizado
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {modelo ? `${modelo.nome}: ${modelo.descricao} As páginas já vêm com capa, abertura e quadros posicionados.` : 'Personalizado: começa com páginas em branco.'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sa-fotos">Quantidade aproximada de fotos</Label>
            <Input id="sa-fotos" type="number" min={0} value={fotosEstimadas} onChange={(e) => {
                setFotosEstimadas(e.target.value)
                sugerirPaginas(e.target.value, estilo)
              }} placeholder="120" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-paginas">Quantidade inicial de páginas</Label>
            <Input
              id="sa-paginas"
              type="number"
              min={2}
              max={400}
              step={2}
              value={paginas}
              onChange={(e) => {
                setPaginas(e.target.value)
                setPaginasTocadas(true)
              }}
            />
            <p className="text-xs text-muted-foreground">
              {laminas} lâmina(s) de página dupla{modelo?.capa ? ' + capa' : ''}
              {fotosEstimadas && !paginasTocadas ? ' · sugerido pelas fotos' : ''}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {cm ? `Lâmina aberta: ${cm.largura} × ${cm.altura} cm, com 3 mm de sangria e área segura de 5 mm.` : 'Informe o formato como largura x altura, em cm (ex.: 24x30).'}
        </p>
        {erro ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {erro}
          </p>
        ) : null}
        <div className={MODAL_ACOES}>
          <Button variant="outline" onClick={onFechar} disabled={criando}>
            Cancelar
          </Button>
          <Button variant="brand" onClick={criar} disabled={!valido || criando}>
            {criando ? 'Criando…' : 'Criar Álbum'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
