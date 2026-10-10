'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  Eye,
  GalleryHorizontal,
  History,
  Images,
  Info,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  Minus,
  PaintBucket,
  Plus,
  Redo2,
  Send,
  Settings,
  Shapes,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Type,
  Undo2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PainelFotos, type MetaFoto } from '@/components/album-editor/painel-fotos'
import { PainelLayouts, type PedidoPreenchimento } from '@/components/album-editor/painel-layouts'
import { PainelModelos } from '@/components/album-editor/painel-modelos'
import { PainelConfiguracoes, PainelElementos, PainelFundos, PainelPaginas, PainelTextos } from '@/components/album-editor/paineis-simples'
import { FitaLaminas } from '@/components/album-editor/fita-laminas'
import { InspetorForma, InspetorMultiplo, InspetorQuadro, InspetorTexto, type CaixaSelecionada, type DirecaoOrdem, type PatchDeLote } from '@/components/album-editor/inspetor'
import { BarraAlinhamento, InspetorLamina, PainelCamadas, type Alinhamento } from '@/components/album-editor/camadas'
import { Publicar } from '@/components/album-editor/publicar'
import { Visualizacao } from '@/components/album-editor/visualizacao'
import { Historico } from '@/components/album-editor/historico'
import { AprovacaoPainel, ROTULO_STATUS } from '@/components/album-editor/aprovacao-painel'
import type { FotoNoCanvas, Selecao } from '@/components/album-editor/tipos'
import {
  formaNova,
  geometria as calcularGeometria,
  normalizarDocumento,
  novaLamina,
  novoId,
  quadroNovo,
  recorteInicial,
  rotuloDaLamina,
  textoNovo,
  type DocumentoAlbum,
  type FonteChave,
  type FormaDoc,
  type FotoEditor,
  type LaminaDoc,
  type Quadro,
  type TextoDoc,
} from '@/lib/album/documento'
import {
  documentoDoModelo,
  estiloPorId,
  layoutsVazios,
  MAX_FOTOS_POR_LAMINA,
  modeloPorId,
  preencherAutomaticamente,
  preencherQuadrosVazios,
  temQuadrosVazios,
  variantesDeLayout,
  type ModeloAlbum,
  type Variante,
} from '@/lib/album/modelos'
import { verificarAlbum, type NivelProblema } from '@/lib/album/verificacao'
import { ajustarEspacamento, vaoAtual } from '@/lib/album/divisorias'
import { aplicarTemplate, assinaturaDasFotos, bibliotecaPadrao, reorganizacoes as calcularReorganizacoes, templateDaLamina, type TemplateLamina } from '@/lib/album/templates'
import { medirEstouro, medirFoco } from '@/lib/album/ajustes'
import { alturaDoTexto } from '@/lib/album/texto'
import { registrarFamilias } from '@/lib/album/fontes'
import { carregarImagem, miniaturaDataUrl } from '@/lib/album/exportar'
import { carregarOriginal, gerarDerivados, registrarDerivados } from '@/lib/album/derivados'
import {
  atualizarDadosAlbum,
  atualizarMiniatura,
  excluirTemplate,
  favoritarTemplate,
  finalizarAlbum,
  listarTemplates,
  registrarUsoTemplate,
  salvarTemplate,
  listarAprovacoesAlbum,
  removerFotoAlbum,
  resolverComentarioAlbum,
  salvarBiblioteca,
  salvarDocumentoAlbum,
} from '@/lib/actions/album-editor'
import type { AlbumParaEditor, AprovacaoDoAlbum, FotoDoEditor } from '@/lib/supabase/queries'
import type { AlbumTemplateRow, DerivadoFoto, StatusAlbum } from '@/types/database'
import { cn } from '@/lib/utils'

const CanvasLamina = dynamic(() => import('@/components/album-editor/canvas-lamina').then((m) => m.CanvasLamina), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-white/50">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      Carregando o canvas…
    </div>
  ),
})

const LIMITE_HISTORICO = 100
const AGRUPAR_MS = 800
const SALVAR_APOS_MS = 1200
const TENTAR_DE_NOVO_MS = 5000
const MINIATURA_APOS_MS = 4000
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3, 4]
const DESLOCAMENTO_COLAR_MM = 5

type Entrada = { doc: DocumentoAlbum; rotulo: string; em: number }
type Historico = { passado: Entrada[]; presente: Entrada; futuro: Entrada[] }
type EstadoSalvo = 'salvo' | 'pendente' | 'salvando' | 'erro' | 'conflito' | 'travado'
type PainelEsquerdo = 'fotos' | 'layouts' | 'modelos' | 'fundos' | 'textos' | 'elementos' | 'paginas' | 'config'
type PainelDireito = 'inspetor' | 'camadas' | 'verificacao' | 'comentarios'
type Copia = { revisao: number; documento: DocumentoAlbum; em: string }
type Biblioteca = { pastas: { id: string; nome: string }[]; fotos: Record<string, MetaFoto> }
type ElementoCopiado = { tipo: 'quadro'; e: Quadro } | { tipo: 'texto'; e: TextoDoc } | { tipo: 'forma'; e: FormaDoc }

const FERRAMENTAS: { chave: PainelEsquerdo; rotulo: string; icone: typeof Images }[] = [
  { chave: 'fotos', rotulo: 'Fotos', icone: Images },
  { chave: 'layouts', rotulo: 'Layouts', icone: LayoutGrid },
  { chave: 'modelos', rotulo: 'Modelos', icone: LayoutTemplate },
  { chave: 'fundos', rotulo: 'Fundos', icone: PaintBucket },
  { chave: 'textos', rotulo: 'Textos', icone: Type },
  { chave: 'elementos', rotulo: 'Elementos', icone: Shapes },
  { chave: 'paginas', rotulo: 'Páginas', icone: GalleryHorizontal },
  { chave: 'config', rotulo: 'Config.', icone: Settings },
]

const NIVEL: Record<NivelProblema, { rotulo: string; cor: string; icone: typeof AlertCircle }> = {
  erro: { rotulo: 'Erro', cor: 'text-red-400', icone: AlertCircle },
  aviso: { rotulo: 'Atenção', cor: 'text-amber-400', icone: AlertTriangle },
  info: { rotulo: 'Informação', cor: 'text-sky-400', icone: Info },
}

function trocarLamina(doc: DocumentoAlbum, indice: number, fn: (l: LaminaDoc) => LaminaDoc): DocumentoAlbum {
  return { ...doc, laminas: doc.laminas.map((l, i) => (i === indice ? fn(l) : l)) }
}

/** Cópia local do que ainda não foi salvo (fechar a aba sem conexão não perde o trabalho). */
const chaveCopia = (id: string) => `seualbum:rascunho:${id}`
function lerCopia(id: string): Copia | null {
  try {
    const bruto = window.localStorage.getItem(chaveCopia(id))
    return bruto ? (JSON.parse(bruto) as Copia) : null
  } catch {
    return null
  }
}
function gravarCopia(id: string, c: Copia | null) {
  try {
    if (c) window.localStorage.setItem(chaveCopia(id), JSON.stringify(c))
    else window.localStorage.removeItem(chaveCopia(id))
  } catch {
    // Sem armazenamento local (aba anônima, cota cheia): segue só com o servidor.
  }
}

export function EditorAlbum({
  album,
  familias,
  abrirInicial,
}: {
  album: AlbumParaEditor
  familias: Partial<Record<FonteChave, string>>
  /** Atalho da lista de álbuns: já abre numa janela. */
  abrirInicial?: string
}) {
  registrarFamilias(familias)
  const router = useRouter()
  const raizRef = useRef<HTMLDivElement>(null)
  const g = useMemo(
    () => calcularGeometria({ formato: album.formato, orientacao: album.orientacao, sangriaMm: album.sangriaMm, margemSeguraMm: album.margemSeguraMm }),
    [album.formato, album.orientacao, album.sangriaMm, album.margemSeguraMm],
  )

  const [hist, setHist] = useState<Historico>(() => ({
    passado: [],
    presente: { doc: normalizarDocumento(album.documento), rotulo: 'Álbum aberto', em: Date.now() },
    futuro: [],
  }))
  const doc = hist.presente.doc
  const [ativa, setAtiva] = useState(0)
  const [selecionados, setSelecionados] = useState<Selecao[]>([])
  const selecao = selecionados[selecionados.length - 1] ?? null
  const [recortando, setRecortando] = useState(false)
  // Montagem: escolher templates e trocar fotos (geometria fixa). Designer: editar a geometria.
  const [modo, setModo] = useState<'montagem' | 'designer'>('montagem')
  const [escolhendoFoco, setEscolhendoFoco] = useState(false)
  const [respeitarOrdem, setRespeitarOrdem] = useState(false)
  const [templatesEquipe, setTemplatesEquipe] = useState<AlbumTemplateRow[]>([])
  const [usoLocal, setUsoLocal] = useState<{ favoritos: string[]; recentes: Record<string, string> }>({ favoritos: [], recentes: {} })
  const [mostrarGuias, setMostrarGuias] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [painelEsq, setPainelEsq] = useState<PainelEsquerdo>('fotos')
  const [filtroFotos, setFiltroFotos] = useState<{ chave: number; filtro: 'todas' | 'nao-usadas' }>({ chave: 0, filtro: 'todas' })
  const [painelDir, setPainelDir] = useState<PainelDireito>('inspetor')
  const [modal, setModal] = useState<'publicar' | 'visualizar' | 'historico' | 'aprovacao' | null>(() =>
    abrirInicial === 'compartilhar' ? 'aprovacao' : abrirInicial === 'visualizar' ? 'visualizar' : abrirInicial === 'historico' ? 'historico' : null,
  )
  const [fotos, setFotos] = useState<FotoDoEditor[]>(album.fotos)
  const [biblioteca, setBiblioteca] = useState<Biblioteca>(() => ({
    pastas: album.pastas,
    fotos: Object.fromEntries(album.fotos.filter((f) => f.pasta || f.favorita || f.prioridade).map((f) => [f.id, { pasta: f.pasta ?? null, favorita: f.favorita, prioridade: f.prioridade ?? null }])),
  }))
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [nome, setNome] = useState(album.nome)
  const [status, setStatus] = useState<StatusAlbum>(album.status)
  const [estado, setEstado] = useState<EstadoSalvo>(album.travado ? 'travado' : 'salvo')
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [copiaEncontrada, setCopiaEncontrada] = useState<Copia | null>(null)
  const [online, setOnline] = useState(true)
  const [sincronizado, setSincronizado] = useState(false)
  const [telaCheia, setTelaCheia] = useState(false)
  const [boasVindas, setBoasVindas] = useState(album.revisao > 0)
  const [aprovacoes, setAprovacoes] = useState<AprovacaoDoAlbum[]>([])

  const travado = (album.projeto ? album.travado : false) || status === 'aprovado' || status === 'finalizado' || status === 'em_producao'
  const laminaIdx = Math.min(ativa, doc.laminas.length - 1)
  const lamina = doc.laminas[laminaIdx]
  const quadroSel = selecao?.tipo === 'quadro' ? (lamina.quadros.find((q) => q.id === selecao.id) ?? null) : null
  const textoSel = selecao?.tipo === 'texto' ? (lamina.textos.find((t) => t.id === selecao.id) ?? null) : null
  const formaSel = selecao?.tipo === 'forma' ? (lamina.formas.find((f) => f.id === selecao.id) ?? null) : null

  /* ---------------------------- histórico ---------------------------- */
  const ultimoGrupo = useRef<{ chave: string; em: number } | null>(null)
  const travadoRef = useRef(travado)
  travadoRef.current = travado
  const aplicar = useCallback((fn: (d: DocumentoAlbum) => DocumentoAlbum, rotulo: string, grupo?: string) => {
    if (travadoRef.current) return
    setHist((h) => {
      const novo = fn(h.presente.doc)
      if (novo === h.presente.doc) return h
      const agora = Date.now()
      const agrupa = grupo && ultimoGrupo.current?.chave === grupo && agora - ultimoGrupo.current.em < AGRUPAR_MS
      ultimoGrupo.current = grupo ? { chave: grupo, em: agora } : null
      const entrada = { doc: novo, rotulo, em: agora }
      if (agrupa) return { ...h, presente: entrada, futuro: [] }
      return { passado: [...h.passado, h.presente].slice(-LIMITE_HISTORICO), presente: entrada, futuro: [] }
    })
  }, [])

  const desfazer = useCallback((passos = 1) => {
    if (travadoRef.current) return
    ultimoGrupo.current = null
    setHist((h) => {
      let atual = h
      for (let i = 0; i < passos && atual.passado.length > 0; i++) {
        atual = { passado: atual.passado.slice(0, -1), presente: atual.passado[atual.passado.length - 1], futuro: [atual.presente, ...atual.futuro] }
      }
      return atual
    })
  }, [])
  const refazer = useCallback(() => {
    if (travadoRef.current) return
    ultimoGrupo.current = null
    setHist((h) => (h.futuro.length === 0 ? h : { passado: [...h.passado, h.presente], presente: h.futuro[0], futuro: h.futuro.slice(1) }))
  }, [])

  /* ------------------------ salvamento automático ------------------------ */
  const revisao = useRef(album.revisao)
  const salvoRef = useRef<DocumentoAlbum>(doc)
  const docRef = useRef(doc)
  docRef.current = doc
  const emVoo = useRef<Promise<boolean> | null>(null)
  const parado = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const salvar = useCallback(async (): Promise<boolean> => {
    if (parado.current) return false
    if (travadoRef.current) return docRef.current === salvoRef.current
    // `while`, não `if`: duas chamadas esperando o mesmo salvamento acordariam
    // juntas e mandariam a mesma revisão — a segunda viraria um falso conflito.
    while (emVoo.current) await emVoo.current
    if (parado.current) return false
    const alvo = docRef.current
    if (alvo === salvoRef.current) return true
    setEstado('salvando')
    const tarefa = (async () => {
      const r = await salvarDocumentoAlbum(album.id, alvo, revisao.current).catch(() => ({ ok: false as const, erro: 'Sem conexão — as alterações ficam guardadas neste navegador.' }))
      if (r.ok) {
        revisao.current = r.revisao
        salvoRef.current = alvo
        gravarCopia(album.id, docRef.current === alvo ? null : { revisao: r.revisao, documento: docRef.current, em: new Date().toISOString() })
        setEstado(docRef.current === alvo ? 'salvo' : 'pendente')
        setMensagem(null)
        return true
      }
      if ('conflito' in r && r.conflito) {
        parado.current = true
        setEstado('conflito')
      } else if ('travado' in r && r.travado) {
        parado.current = true
        setEstado('travado')
      } else {
        setEstado('erro')
      }
      setMensagem(r.erro)
      return false
    })()
    emVoo.current = tarefa
    const ok = await tarefa
    if (emVoo.current === tarefa) emVoo.current = null
    return ok
  }, [album.id])

  useEffect(() => {
    if (doc === salvoRef.current || parado.current) return
    gravarCopia(album.id, { revisao: revisao.current, documento: doc, em: new Date().toISOString() })
    setEstado((e) => (e === 'salvando' ? e : 'pendente'))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const ok = await salvar()
      if (!ok && !parado.current) timer.current = setTimeout(() => void salvar(), TENTAR_DE_NOVO_MS)
      else if (ok && docRef.current !== salvoRef.current) timer.current = setTimeout(() => void salvar(), SALVAR_APOS_MS)
    }, SALVAR_APOS_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [doc, salvar, album.id])

  // Conexão: perdeu → guarda local; voltou → sincroniza e avisa.
  useEffect(() => {
    setOnline(navigator.onLine)
    const caiu = () => setOnline(false)
    const voltou = async () => {
      setOnline(true)
      const ok = await salvar()
      if (ok) {
        setSincronizado(true)
        setTimeout(() => setSincronizado(false), 4000)
      }
    }
    window.addEventListener('offline', caiu)
    window.addEventListener('online', voltou)
    return () => {
      window.removeEventListener('offline', caiu)
      window.removeEventListener('online', voltou)
    }
  }, [salvar])

  // Cópia local de uma sessão anterior que não chegou ao servidor.
  useEffect(() => {
    try {
      window.localStorage.setItem('seualbum:ultimo-album', album.id)
    } catch {
      // sem armazenamento local
    }
    const c = lerCopia(album.id)
    if (c && c.revisao === album.revisao && JSON.stringify(c.documento) !== JSON.stringify(normalizarDocumento(album.documento))) setCopiaEncontrada(c)
    else gravarCopia(album.id, null)
    const t = setTimeout(() => setBoasVindas(false), 5000)
    return () => clearTimeout(t)
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Não deixa fechar a aba com alteração sem salvar.
  useEffect(() => {
    function antes(e: BeforeUnloadEvent) {
      if (docRef.current !== salvoRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', antes)
    return () => window.removeEventListener('beforeunload', antes)
  }, [])

  useEffect(() => {
    const ao = () => setTelaCheia(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', ao)
    return () => document.removeEventListener('fullscreenchange', ao)
  }, [])

  /* ------------------------------- fotos ------------------------------- */
  const metaDe = useCallback((id: string): MetaFoto => biblioteca.fotos[id] ?? {}, [biblioteca])
  const fotosParaLayout: FotoEditor[] = useMemo(
    () =>
      fotos.map((f) => {
        const m = metaDe(f.id)
        return {
          ...f,
          favorita: m.favorita ?? f.favorita,
          prioridade: m.prioridade ?? null,
          pasta: m.pasta ?? null,
          // Ponto focal definido à mão vence o medido.
          fx: m.foco?.fx ?? f.fx,
          fy: m.foco?.fy ?? f.fy,
        }
      }),
    [fotos, metaDe],
  )
  const fotosMapa = useMemo(
    () => new Map<string, FotoNoCanvas>(fotos.map((f) => [f.id, { url: f.url, urlMini: f.urlMini, urlPreview: f.urlPreview, largura: f.largura, altura: f.altura }])),
    [fotos],
  )
  const urlsOriginais = useMemo(() => new Map(fotos.map((f) => [f.id, f.url])), [fotos])
  const urlsPreview = useMemo(() => new Map(fotos.map((f) => [f.id, f.urlPreview ?? f.url])), [fotos])
  const dimensoes = useMemo(() => new Map(fotos.map((f) => [f.id, { largura: f.largura, altura: f.altura, estouro: f.estouro }])), [fotos])
  const aoDescobrirDimensoes = useCallback((fotoId: string, largura: number, altura: number) => {
    setFotos((lista) => lista.map((f) => (f.id === fotoId && (f.largura !== largura || f.altura !== altura) ? { ...f, largura, altura } : f)))
  }, [])

  // Versões leves (miniatura/prévia) + medidas das fotos que ainda não têm: em segundo plano, 2 por vez.
  const tentadas = useRef(new Set<string>())
  useEffect(() => {
    const pendentes = fotos.filter((f) => f.url && !f.temDerivados && !tentadas.current.has(f.id))
    if (pendentes.length === 0) return
    pendentes.forEach((f) => tentadas.current.add(f.id))
    let cancelado = false
    const fila = [...pendentes]
    const lote: Record<string, DerivadoFoto> = {}
    const gravar = async () => {
      const chaves = Object.keys(lote)
      if (chaves.length === 0) return
      const envio = Object.fromEntries(chaves.map((k) => [k, lote[k]]))
      chaves.forEach((k) => delete lote[k])
      await registrarDerivados(album.id, envio)
    }
    const trabalhar = async () => {
      while (fila.length > 0 && !cancelado) {
        const f = fila.shift()!
        try {
          const img = await carregarOriginal(f.url)
          try {
            const d = await gerarDerivados(album.id, f.id, img)
            lote[f.id] = { mini: d.mini, preview: d.preview, largura: d.largura, altura: d.altura, estouro: d.estouro, fx: d.fx, fy: d.fy, pb: d.pb }
            if (!cancelado)
              setFotos((lista) =>
                lista.map((x) =>
                  x.id === f.id
                    ? { ...x, largura: d.largura, altura: d.altura, estouro: d.estouro, fx: d.fx, fy: d.fy, monocromatica: d.pb, urlMini: d.urlMini, urlPreview: d.urlPreview, temDerivados: true }
                    : x,
                ),
              )
            if (Object.keys(lote).length >= 6) await gravar()
          } catch {
            // Sem como subir as versões leves: mede aqui mesmo e segue com o original.
            const { fx, fy } = medirFoco(img)
            if (!cancelado)
              setFotos((lista) =>
                lista.map((x) => (x.id === f.id ? { ...x, largura: img.naturalWidth, altura: img.naturalHeight, estouro: medirEstouro(img), fx, fy, temDerivados: true } : x)),
              )
          }
        } catch {
          if (!cancelado) setFotos((lista) => lista.map((x) => (x.id === f.id ? { ...x, estouro: null } : x)))
        }
      }
    }
    void Promise.all([trabalhar(), trabalhar()]).then(gravar)
    return () => {
      cancelado = true
      void gravar()
    }
    // Na carga e quando chegam fotos novas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos.length])

  // Organização da biblioteca: salva 1 s depois da última mudança.
  const primeiraBiblioteca = useRef(true)
  useEffect(() => {
    if (primeiraBiblioteca.current) {
      primeiraBiblioteca.current = false
      return
    }
    const t = setTimeout(() => void salvarBiblioteca(album.id, biblioteca), 1000)
    return () => clearTimeout(t)
  }, [biblioteca, album.id])

  function alterarMeta(ids: string[], patch: MetaFoto) {
    setBiblioteca((b) => ({ ...b, fotos: { ...b.fotos, ...Object.fromEntries(ids.map((id) => [id, { ...b.fotos[id], ...patch }])) } }))
  }
  function criarPasta(nomePasta: string) {
    const limpo = nomePasta.trim().slice(0, 60)
    if (!limpo) return null
    const id = novoId('p')
    setBiblioteca((b) => ({ ...b, pastas: [...b.pastas, { id, nome: limpo }] }))
    return id
  }

  const usos = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const l of doc.laminas) {
      for (const q of l.quadros) if (q.fotoId) mapa.set(q.fotoId, (mapa.get(q.fotoId) ?? 0) + 1)
      if (l.fundoImagem) mapa.set(l.fundoImagem.fotoId, (mapa.get(l.fundoImagem.fotoId) ?? 0) + 1)
    }
    return mapa
  }, [doc])

  /* ---------------------------- comentários ---------------------------- */
  const carregarComentarios = useCallback(async () => {
    if (album.projeto) return
    const r = await listarAprovacoesAlbum(album.id)
    if (r.ok) setAprovacoes(r.aprovacoes)
  }, [album.id, album.projeto])
  useEffect(() => {
    void carregarComentarios()
  }, [carregarComentarios])
  const aprovacaoAtual = aprovacoes.find((a) => a.status !== 'cancelado') ?? null
  const comentariosAbertos = useMemo(() => (aprovacaoAtual?.comentarios ?? []).filter((c) => c.origem === 'cliente' && !c.resolvido), [aprovacaoAtual])
  const comentariosPorLamina = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of comentariosAbertos) m.set(c.laminaIndice, (m.get(c.laminaIndice) ?? 0) + 1)
    return m
  }, [comentariosAbertos])

  /* ------------------------------ capa da lista ------------------------------ */
  const capaDoc = doc.laminas.find((l) => l.quadros.some((q) => q.fotoId) || l.textos.length > 0) ?? doc.laminas[0]
  const capaChave = JSON.stringify(capaDoc)
  const ultimaCapa = useRef<string | null>(null)
  useEffect(() => {
    if (!g || travado || capaChave === ultimaCapa.current) return
    const t = setTimeout(async () => {
      try {
        const cache = new Map<string, Promise<HTMLImageElement>>()
        const url = await miniaturaDataUrl(capaDoc, g, (id) => {
          const u = urlsPreview.get(id)
          if (!u) return Promise.reject(new Error('sem foto'))
          if (!cache.has(id)) cache.set(id, carregarImagem(u))
          return cache.get(id)!
        })
        const r = await atualizarMiniatura(album.id, url)
        if (r.ok) ultimaCapa.current = capaChave
      } catch {
        // Miniatura é só cosmética na listagem: tenta de novo na próxima mudança.
      }
    }, MINIATURA_APOS_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capaChave, g, travado])

  /* ------------------------------ edição ------------------------------ */
  const alterarNaLamina = useCallback(
    (fn: (l: LaminaDoc) => LaminaDoc, rotulo: string, grupo?: string) => aplicar((d) => trocarLamina(d, laminaIdx, fn), rotulo, grupo),
    [aplicar, laminaIdx],
  )
  const alterarQuadro = useCallback(
    (id: string, patch: Partial<Quadro>, rotulo = 'Alterada a foto', grupo?: string) =>
      alterarNaLamina((l) => ({ ...l, quadros: l.quadros.map((q) => (q.id === id ? { ...q, ...patch } : q)) }), rotulo, grupo),
    [alterarNaLamina],
  )
  const alterarTexto = useCallback(
    (id: string, patch: Partial<TextoDoc>, rotulo = 'Alterado o texto', grupo?: string) =>
      alterarNaLamina((l) => ({ ...l, textos: l.textos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }), rotulo, grupo),
    [alterarNaLamina],
  )
  const alterarForma = useCallback(
    (id: string, patch: Partial<FormaDoc>, rotulo = 'Alterado o elemento', grupo?: string) =>
      alterarNaLamina((l) => ({ ...l, formas: l.formas.map((f) => (f.id === id ? { ...f, ...patch } : f)) }), rotulo, grupo),
    [alterarNaLamina],
  )
  // Transformar vários selecionados de uma vez dispara um evento por elemento: viram um passo só.
  const grupoDoMovimento = (patch: object) => (selecionados.length > 1 && ('w' in patch || 'rotacao' in patch) ? `transformar-${selecionados.map((s) => s.id).join()}` : undefined)
  const rotuloDoMovimento = (patch: object) =>
    'rotacao' in patch ? 'Girado o elemento' : 'w' in patch ? 'Redimensionado o elemento' : 'recorte' in patch ? 'Ajustado o enquadramento' : 'Alterada posição'

  function selecionar(s: Selecao | null, aditivo = false) {
    if (s?.id !== selecao?.id) setRecortando(false)
    if (!s) setSelecionados([])
    else if (aditivo) setSelecionados((lista) => (lista.some((x) => x.id === s.id) ? lista.filter((x) => x.id !== s.id) : [...lista, s]))
    else setSelecionados([s])
    if (s) setPainelDir((p) => (p === 'verificacao' || p === 'comentarios' ? p : 'inspetor'))
  }

  const excluirSelecionados = useCallback(() => {
    if (selecionados.length === 0) return
    const ids = new Set(selecionados.map((s) => s.id))
    alterarNaLamina(
      (l) => ({ ...l, quadros: l.quadros.filter((q) => !ids.has(q.id)), textos: l.textos.filter((t) => !ids.has(t.id)), formas: l.formas.filter((f) => !ids.has(f.id)) }),
      selecionados.length > 1 ? `Excluídos ${selecionados.length} elementos` : 'Excluído o elemento',
    )
    setSelecionados([])
    setRecortando(false)
  }, [alterarNaLamina, selecionados])

  function mudarOrdem(direcao: DirecaoOrdem, alvo: Selecao | null = selecao) {
    if (!alvo) return
    const mover = <T extends { id: string }>(lista: T[]) => {
      const i = lista.findIndex((e) => e.id === alvo.id)
      if (i < 0) return lista
      const copia = [...lista]
      const [item] = copia.splice(i, 1)
      const destino = direcao === 'frente' ? copia.length : direcao === 'tras' ? 0 : direcao === 'avancar' ? Math.min(copia.length, i + 1) : Math.max(0, i - 1)
      copia.splice(destino, 0, item)
      return copia
    }
    alterarNaLamina(
      (l) => ({
        ...l,
        quadros: alvo.tipo === 'quadro' ? mover(l.quadros) : l.quadros,
        textos: alvo.tipo === 'texto' ? mover(l.textos) : l.textos,
        formas: alvo.tipo === 'forma' ? mover(l.formas) : l.formas,
      }),
      'Alterada a ordem das camadas',
    )
  }

  function alternarCamada(s: Selecao, campo: 'bloqueado' | 'oculto') {
    const atual = s.tipo === 'quadro' ? lamina.quadros.find((e) => e.id === s.id) : s.tipo === 'texto' ? lamina.textos.find((e) => e.id === s.id) : lamina.formas.find((e) => e.id === s.id)
    if (!atual) return
    const valor = !atual[campo]
    const rotulo = campo === 'oculto' ? (valor ? 'Ocultado o elemento' : 'Mostrado o elemento') : valor ? 'Bloqueado o elemento' : 'Desbloqueado o elemento'
    if (s.tipo === 'quadro') alterarQuadro(s.id, { [campo]: valor }, rotulo)
    else if (s.tipo === 'texto') alterarTexto(s.id, { [campo]: valor }, rotulo)
    else alterarForma(s.id, { [campo]: valor }, rotulo)
  }

  /* ---------------------- copiar / colar / duplicar ---------------------- */
  const area = useRef<ElementoCopiado[]>([])
  const copiar = useCallback(() => {
    area.current = selecionados
      .map((s): ElementoCopiado | null => {
        if (s.tipo === 'quadro') {
          const e = lamina.quadros.find((x) => x.id === s.id)
          return e ? { tipo: 'quadro', e } : null
        }
        if (s.tipo === 'texto') {
          const e = lamina.textos.find((x) => x.id === s.id)
          return e ? { tipo: 'texto', e } : null
        }
        const e = lamina.formas.find((x) => x.id === s.id)
        return e ? { tipo: 'forma', e } : null
      })
      .filter((x): x is ElementoCopiado => Boolean(x))
  }, [selecionados, lamina])

  const colar = useCallback(
    (itens: ElementoCopiado[] = area.current) => {
      if (itens.length === 0) return
      const novos: Selecao[] = []
      alterarNaLamina((l) => {
        const quadros = [...l.quadros]
        const textos = [...l.textos]
        const formas = [...l.formas]
        for (const it of itens) {
          const d = DESLOCAMENTO_COLAR_MM
          if (it.tipo === 'quadro') {
            const e = { ...it.e, id: novoId(), x: it.e.x + d, y: it.e.y + d }
            quadros.push(e)
            novos.push({ tipo: 'quadro', id: e.id })
          } else if (it.tipo === 'texto') {
            const e = { ...it.e, id: novoId('t'), x: it.e.x + d, y: it.e.y + d }
            textos.push(e)
            novos.push({ tipo: 'texto', id: e.id })
          } else {
            const e = { ...it.e, id: novoId('f'), x: it.e.x + d, y: it.e.y + d }
            formas.push(e)
            novos.push({ tipo: 'forma', id: e.id })
          }
        }
        return { ...l, quadros, textos, formas }
      }, itens.length > 1 ? `Colados ${itens.length} elementos` : 'Colado o elemento')
      setSelecionados(novos)
    },
    [alterarNaLamina],
  )

  const duplicarSelecionados = useCallback(() => {
    copiar()
    colar()
  }, [copiar, colar])

  /* ------------------------------ alinhamento ------------------------------ */
  function caixaDe(s: Selecao) {
    if (s.tipo === 'quadro') return lamina.quadros.find((e) => e.id === s.id) ?? null
    if (s.tipo === 'forma') return lamina.formas.find((e) => e.id === s.id) ?? null
    const t = lamina.textos.find((e) => e.id === s.id)
    return t ? { ...t, h: alturaDoTexto(t) } : null
  }

  function alinhar(a: Alinhamento) {
    if (!g || selecionados.length === 0) return
    const itens = selecionados.map((s) => ({ s, c: caixaDe(s) })).filter((x): x is { s: Selecao; c: NonNullable<ReturnType<typeof caixaDe>> } => Boolean(x.c))
    if (itens.length === 0) return
    let ref: { x: number; y: number; w: number; h: number }
    if (itens.length === 1) {
      // Um só: em relação à área segura da página onde ele está.
      const c = itens[0].c
      const pagina = c.x + c.w / 2 < g.paginaW ? 0 : 1
      ref = { x: pagina * g.paginaW + g.margem, y: g.margem, w: g.paginaW - 2 * g.margem, h: g.laminaH - 2 * g.margem }
    } else {
      const x0 = Math.min(...itens.map((i) => i.c.x))
      const y0 = Math.min(...itens.map((i) => i.c.y))
      const x1 = Math.max(...itens.map((i) => i.c.x + i.c.w))
      const y1 = Math.max(...itens.map((i) => i.c.y + i.c.h))
      ref = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    }
    const posicoes = new Map<string, { x?: number; y?: number }>()
    if (a === 'distribuir-h' || a === 'distribuir-v') {
      const eixo = a === 'distribuir-h' ? 'x' : 'y'
      const lado = a === 'distribuir-h' ? 'w' : 'h'
      const ordenados = [...itens].sort((p, q) => p.c[eixo] + p.c[lado] / 2 - (q.c[eixo] + q.c[lado] / 2))
      const primeiro = ordenados[0].c[eixo] + ordenados[0].c[lado] / 2
      const ultimo = ordenados[ordenados.length - 1].c[eixo] + ordenados[ordenados.length - 1].c[lado] / 2
      const passo = (ultimo - primeiro) / (ordenados.length - 1)
      ordenados.forEach((it, i) => posicoes.set(it.s.id, { [eixo]: primeiro + passo * i - it.c[lado] / 2 }))
    } else {
      for (const it of itens) {
        const c = it.c
        const p =
          a === 'esquerda'
            ? { x: ref.x }
            : a === 'direita'
              ? { x: ref.x + ref.w - c.w }
              : a === 'centro-h'
                ? { x: ref.x + (ref.w - c.w) / 2 }
                : a === 'topo'
                  ? { y: ref.y }
                  : a === 'base'
                    ? { y: ref.y + ref.h - c.h }
                    : { y: ref.y + (ref.h - c.h) / 2 }
        posicoes.set(it.s.id, p)
      }
    }
    alterarNaLamina(
      (l) => ({
        ...l,
        quadros: l.quadros.map((q) => (posicoes.has(q.id) ? { ...q, ...posicoes.get(q.id) } : q)),
        textos: l.textos.map((t) => (posicoes.has(t.id) ? { ...t, ...posicoes.get(t.id) } : t)),
        formas: l.formas.map((f) => (posicoes.has(f.id) ? { ...f, ...posicoes.get(f.id) } : f)),
      }),
      a.startsWith('distribuir') ? 'Distribuídos os elementos' : 'Alinhados os elementos',
    )
  }

  /* ------------------------------ fotos na lâmina ------------------------------ */
  function soltarFoto(fotoId: string, x: number, y: number, alvo: string | null) {
    if (!g || travado) return
    const f = fotos.find((ft) => ft.id === fotoId)
    if (alvo) {
      alterarQuadro(alvo, { fotoId, recorte: recorteInicial(f) }, 'Foto colocada no quadro')
      setSelecionados([{ tipo: 'quadro', id: alvo }])
      return
    }
    const proporcao = f?.largura && f.altura ? f.largura / f.altura : 1.5
    const h = g.laminaH * 0.45
    const w = Math.min(g.paginaW, h * proporcao)
    const novo = quadroNovo(Math.min(Math.max(x - w / 2, 0), g.laminaW - w), Math.min(Math.max(y - h / 2, 0), g.laminaH - h), w, h, fotoId)
    novo.recorte = recorteInicial(f)
    alterarNaLamina((l) => ({ ...l, quadros: [...l.quadros, novo] }), 'Adicionada foto')
    setSelecionados([{ tipo: 'quadro', id: novo.id }])
  }

  function trocarFotos(a: string, b: string) {
    alterarNaLamina((l) => {
      const qa = l.quadros.find((q) => q.id === a)
      const qb = l.quadros.find((q) => q.id === b)
      if (!qa || !qb) return l
      const fa = fotos.find((f) => f.id === qb.fotoId)
      const fb = fotos.find((f) => f.id === qa.fotoId)
      return {
        ...l,
        quadros: l.quadros.map((q) =>
          q.id === a ? { ...q, fotoId: qb.fotoId, recorte: recorteInicial(fa) } : q.id === b ? { ...q, fotoId: qa.fotoId, recorte: recorteInicial(fb) } : q,
        ),
      }
    }, 'Trocadas as fotos de posição')
    setSelecionados([{ tipo: 'quadro', id: b }])
  }

  function moverVarios(desl: { sel: Selecao; dx: number; dy: number }[]) {
    const m = new Map(desl.map((d) => [d.sel.id, d]))
    alterarNaLamina(
      (l) => ({
        ...l,
        quadros: l.quadros.map((q) => (m.has(q.id) ? { ...q, x: q.x + m.get(q.id)!.dx, y: q.y + m.get(q.id)!.dy } : q)),
        textos: l.textos.map((t) => (m.has(t.id) ? { ...t, x: t.x + m.get(t.id)!.dx, y: t.y + m.get(t.id)!.dy } : t)),
        formas: l.formas.map((f) => (m.has(f.id) ? { ...f, x: f.x + m.get(f.id)!.dx, y: f.y + m.get(f.id)!.dy } : f)),
      }),
      `Movidos ${desl.length} elementos`,
    )
  }

  function irPara(i: number) {
    setAtiva(Math.max(0, Math.min(i, doc.laminas.length - 1)))
    setSelecionados([])
    setRecortando(false)
  }

  function adicionarTexto(modelo: Partial<TextoDoc> & { texto: string }) {
    if (!g) return
    const w = Math.min(g.paginaW - 2 * g.margem - 10, 180)
    const t = { ...textoNovo(g.paginaW + (g.paginaW - w) / 2, g.laminaH / 2 - 10, w, modelo.texto), ...modelo, id: novoId('t') }
    alterarNaLamina((l) => ({ ...l, textos: [...l.textos, t] }), 'Adicionado texto')
    setSelecionados([{ tipo: 'texto', id: t.id }])
    setModo('designer')
  }

  function adicionarForma(forma: FormaDoc['forma'], estilo?: Partial<FormaDoc>) {
    if (!g) return
    const w = forma === 'linha' ? 120 : forma === 'ornamento' ? 40 : 100
    const h = forma === 'linha' ? 0.1 : forma === 'elipse' ? 100 : forma === 'ornamento' ? 40 : 70
    const f = { ...formaNova(forma, g.paginaW + (g.paginaW - w) / 2, (g.laminaH - h) / 2, w, h), ...estilo, id: novoId('f') }
    alterarNaLamina((l) => ({ ...l, formas: [...l.formas, f] }), forma === 'ornamento' ? 'Adicionado ornamento' : 'Adicionado elemento')
    setSelecionados([{ tipo: 'forma', id: f.id }])
    setModo('designer')
  }

  /* ----------------------------- layouts ----------------------------- */
  const fotosNaLamina = useMemo(() => [...new Set(lamina.quadros.map((q) => q.fotoId).filter((id): id is string => Boolean(id)))], [lamina])
  const origemVariantes: 'selecao' | 'lamina' | null =
    selecionadas.length >= 1 && selecionadas.length <= MAX_FOTOS_POR_LAMINA
      ? 'selecao'
      : fotosNaLamina.length >= 1 && fotosNaLamina.length <= MAX_FOTOS_POR_LAMINA
        ? 'lamina'
        : null
  const estiloDoAlbum = estiloPorId(modeloPorId(album.modelo)?.estilo)
  const variantes = useMemo(() => {
    if (!g || !origemVariantes) return []
    const ids = origemVariantes === 'selecao' ? selecionadas : fotosNaLamina
    const escolhidas = ids.map((id) => fotosParaLayout.find((f) => f.id === id)).filter((f): f is FotoEditor => Boolean(f))
    return variantesDeLayout(escolhidas, g, 5, estiloDoAlbum, { respeitarOrdem })
  }, [g, origemVariantes, selecionadas, fotosNaLamina, fotosParaLayout, estiloDoAlbum, respeitarOrdem])

  /* ---------------------------- templates ---------------------------- */
  // Favoritos/recentes dos templates PADRÃO ficam neste navegador; os personalizados, no banco.
  const CHAVE_USO = 'seualbum:templates-uso'
  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(CHAVE_USO)
      if (bruto) setUsoLocal(JSON.parse(bruto))
    } catch {
      // sem armazenamento local
    }
    void listarTemplates().then((r) => {
      if (r.ok) setTemplatesEquipe(r.templates)
    })
  }, [])
  function gravarUsoLocal(u: typeof usoLocal) {
    setUsoLocal(u)
    try {
      window.localStorage.setItem(CHAVE_USO, JSON.stringify(u))
    } catch {
      // sem armazenamento local
    }
  }
  const templates: TemplateLamina[] = useMemo(() => {
    if (!g) return []
    const padrao = bibliotecaPadrao(g, estiloDoAlbum).map((t) => ({ ...t, favorito: usoLocal.favoritos.includes(t.id), ultimoUso: usoLocal.recentes[t.id] ?? null }))
    const equipe: TemplateLamina[] = templatesEquipe.map((t) => ({
      id: t.id,
      nome: t.nome,
      origem: 'personalizado',
      quadros: t.quadros,
      assinatura: t.assinatura,
      nFotos: t.n_fotos,
      favorito: t.favorito,
      usos: t.usos,
      ultimoUso: t.ultimo_uso,
    }))
    return [...equipe, ...padrao]
  }, [g, estiloDoAlbum, templatesEquipe, usoLocal])

  const fotosSelecionadasObj = useMemo(
    () => selecionadas.map((id) => fotosParaLayout.find((f) => f.id === id)).filter((f): f is FotoEditor => Boolean(f)),
    [selecionadas, fotosParaLayout],
  )
  const assinatura = useMemo(() => {
    const base = origemVariantes === 'selecao' ? fotosSelecionadasObj : origemVariantes === 'lamina' ? fotosNaLamina.map((id) => fotosParaLayout.find((f) => f.id === id)).filter((f): f is FotoEditor => Boolean(f)) : []
    return base.length > 0 ? assinaturaDasFotos(base) : null
  }, [origemVariantes, fotosSelecionadasObj, fotosNaLamina, fotosParaLayout])
  const reorganizacoes = useMemo(() => (fotosSelecionadasObj.length >= 2 ? calcularReorganizacoes(fotosSelecionadasObj, templates) : []), [fotosSelecionadasObj, templates])

  function aplicarTemplateNaLamina(t: TemplateLamina) {
    if (!g) return
    const quadros = aplicarTemplate(t, g, fotosSelecionadasObj, respeitarOrdem)
    alterarNaLamina((l) => ({ ...l, quadros }), `Aplicado o template ${t.nome}`)
    setSelecionadas([])
    setSelecionados([])
    if (t.origem === 'personalizado') {
      void registrarUsoTemplate(t.id)
      setTemplatesEquipe((lista) => lista.map((x) => (x.id === t.id ? { ...x, usos: x.usos + 1, ultimo_uso: new Date().toISOString() } : x)))
    } else gravarUsoLocal({ ...usoLocal, recentes: { ...usoLocal.recentes, [t.id]: new Date().toISOString() } })
  }

  async function favoritar(t: TemplateLamina) {
    if (t.origem === 'personalizado') {
      const r = await favoritarTemplate(t.id, !t.favorito)
      if (r.ok) setTemplatesEquipe((lista) => lista.map((x) => (x.id === t.id ? { ...x, favorito: !t.favorito } : x)))
      else setMensagem(r.erro)
    } else {
      const favoritos = t.favorito ? usoLocal.favoritos.filter((id) => id !== t.id) : [...usoLocal.favoritos, t.id]
      gravarUsoLocal({ ...usoLocal, favoritos })
    }
  }

  async function excluirTemplatePersonalizado(t: TemplateLamina) {
    if (!window.confirm(`Excluir o template "${t.nome}"? As lâminas que já usaram ele não mudam.`)) return
    const r = await excluirTemplate(t.id)
    if (r.ok) setTemplatesEquipe((lista) => lista.filter((x) => x.id !== t.id))
    else setMensagem(r.erro)
  }

  async function salvarComoTemplate() {
    if (!g) return
    const nomeTpl = window.prompt('Nome do template', `${lamina.quadros.length} fotos · ${album.nome}`.slice(0, 80))
    if (!nomeTpl) return
    const t = templateDaLamina(lamina, g, nomeTpl)
    if (!t) return
    const r = await salvarTemplate({ nome: t.nome, quadros: t.quadros, assinatura: t.assinatura })
    if (r.ok) {
      setTemplatesEquipe((lista) => [r.template, ...lista])
      setMensagem(null)
      setPainelEsq('layouts')
    } else setMensagem(r.erro)
  }

  /** Ponto focal definido à mão: vale para a foto em qualquer quadro, e já reenquadra este. */
  function definirFoco(fotoId: string, fx: number, fy: number) {
    alterarMeta([fotoId], { foco: { fx, fy } })
    setFotos((lista) => lista.map((f) => (f.id === fotoId ? { ...f, fx, fy, focoManual: true } : f)))
    if (quadroSel?.fotoId === fotoId) alterarQuadro(quadroSel.id, { recorte: { ...quadroSel.recorte, cx: fx, cy: fy } }, 'Definido o ponto focal')
    setEscolhendoFoco(false)
  }

  const vao = useMemo(() => vaoAtual(lamina.quadros), [lamina.quadros])
  function mudarEspacamento(mm: number) {
    const patches = new Map(ajustarEspacamento(lamina.quadros, mm).map((p) => [p.id, p.patch]))
    if (patches.size === 0) return
    alterarNaLamina((l) => ({ ...l, quadros: l.quadros.map((q) => (patches.has(q.id) ? { ...q, ...patches.get(q.id) } : q)) }), 'Alterado o espaçamento', `vao-${laminaIdx}`)
  }

  function aplicarLote(patch: PatchDeLote, rotulo: string) {
    const ids = new Set(selecionados.filter((x) => x.tipo === 'quadro').map((x) => x.id))
    if (ids.size === 0) return
    alterarNaLamina(
      (l) => ({
        ...l,
        quadros: l.quadros.map((q) => {
          if (!ids.has(q.id)) return q
          // Só as propriedades de lote — o enquadramento de cada foto fica como está.
          const { ajustesPb, ...resto } = patch
          return { ...q, ...resto, ...(ajustesPb === undefined ? {} : { ajustes: { ...q.ajustes, pb: ajustesPb } }) }
        }),
      }),
      rotulo,
      `lote-${Object.keys(patch).join()}`,
    )
  }

  function aplicarVariante(v: Variante) {
    alterarNaLamina((l) => ({ ...l, quadros: v.quadros.map((q) => ({ ...q, id: novoId() })) }), 'Aplicado layout')
    setSelecionadas([])
    setSelecionados([])
  }

  function criarPaginaComSelecao() {
    if (!g || selecionadas.length === 0) return
    const escolhidas = selecionadas.map((id) => fotosParaLayout.find((f) => f.id === id)).filter((f): f is FotoEditor => Boolean(f))
    const [v] = variantesDeLayout(escolhidas, g, 1, estiloDoAlbum)
    if (!v) return
    const nova = { ...novaLamina(lamina.fundo), quadros: v.quadros.map((q) => ({ ...q, id: novoId() })) }
    aplicar((d) => ({ ...d, laminas: [...d.laminas.slice(0, laminaIdx + 1), nova, ...d.laminas.slice(laminaIdx + 1)] }), 'Criada página com a seleção')
    setSelecionadas([])
    setAtiva(laminaIdx + 1)
    setSelecionados([])
  }

  function inserirLamina(tipo: 'vazia' | 'layout' | 'duplicar', quadros = 3) {
    if (!g) return
    const base = lamina
    const nova: LaminaDoc =
      tipo === 'duplicar'
        ? copiaDeLamina(base)
        : tipo === 'layout'
          ? { ...novaLamina(base.fundo), quadros: layoutsVazios(quadros, g, estiloDoAlbum, 1)[0]?.quadros ?? [] }
          : novaLamina(base.fundo)
    aplicar((d) => ({ ...d, laminas: [...d.laminas.slice(0, laminaIdx + 1), nova, ...d.laminas.slice(laminaIdx + 1)] }), tipo === 'duplicar' ? 'Duplicada página' : 'Adicionada página')
    setAtiva(laminaIdx + 1)
    setSelecionados([])
  }

  function layoutVazioNa(i: number, quadros: number) {
    if (!g) return
    const v = layoutsVazios(quadros, g, estiloDoAlbum, 1)[0]
    if (!v) return
    aplicar((d) => trocarLamina(d, i, (l) => ({ ...l, quadros: v.quadros })), 'Aplicado layout vazio')
    irPara(i)
  }

  function aplicarModeloNaLamina(m: ModeloAlbum) {
    if (!g) return
    const estilo = estiloPorId(m.estilo)
    const n = estilo.ritmo[laminaIdx % estilo.ritmo.length]
    const v = layoutsVazios(n, g, estilo, 1)[0]
    alterarNaLamina((l) => ({ ...l, fundo: estilo.fundo, quadros: v?.quadros ?? [] }), `Aplicado modelo ${m.nome} na página`)
  }

  function preencher(p: PedidoPreenchimento) {
    if (!g) return
    const base = p.soSelecionadas ? fotosParaLayout.filter((f) => selecionadas.includes(f.id)) : fotosParaLayout
    if (p.usarQuadrosDoModelo) aplicar((d) => preencherQuadrosVazios(d, base), 'Preenchidos os quadros do modelo')
    else {
      aplicar(
        () => preencherAutomaticamente(base, p.laminas, g, p.capa, estiloPorId(p.estilo), { agrupar: p.agrupar, reutilizacao: p.reutilizacao, respeitarOrdem: p.respeitarOrdem }),
        'Montagem automática do álbum (rascunho)',
      )
      irPara(0)
    }
  }

  /* ---------------------------- verificação ---------------------------- */
  const problemas = useMemo(() => (g ? verificarAlbum(doc, g, dimensoes) : []), [doc, g, dimensoes])
  const erros = problemas.filter((p) => p.nivel === 'erro').length
  const problemasPorLamina = useMemo(() => {
    const m = new Map<number, number>()
    for (const p of problemas) if (p.laminaIndice >= 0 && p.nivel !== 'info') m.set(p.laminaIndice, (m.get(p.laminaIndice) ?? 0) + 1)
    return m
  }, [problemas])

  /* ------------------------------ teclado ------------------------------ */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (modal) return
      const alvo = e.target as HTMLElement | null
      if (alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)) return
      const cmd = e.metaKey || e.ctrlKey
      const tecla = e.key.toLowerCase()
      if (cmd && tecla === 'z') {
        e.preventDefault()
        if (e.shiftKey) refazer()
        else desfazer()
        return
      }
      if (cmd && tecla === 'y') {
        e.preventDefault()
        refazer()
        return
      }
      if (cmd && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setZoom((z) => ZOOMS.find((v) => v > z) ?? z)
        return
      }
      if (cmd && e.key === '-') {
        e.preventDefault()
        setZoom((z) => [...ZOOMS].reverse().find((v) => v < z) ?? z)
        return
      }
      if (cmd && e.key === '0') {
        e.preventDefault()
        setZoom(1)
        return
      }
      if (cmd && tecla === 'c' && selecionados.length > 0) {
        e.preventDefault()
        copiar()
        return
      }
      if (cmd && tecla === 'v' && !travado) {
        e.preventDefault()
        colar()
        return
      }
      if (cmd && tecla === 'd' && selecionados.length > 0 && !travado) {
        e.preventDefault()
        duplicarSelecionados()
        return
      }
      if (e.key === 'Escape') {
        if (escolhendoFoco) setEscolhendoFoco(false)
        else if (recortando) setRecortando(false)
        else if (selecionados.length > 0) setSelecionados([])
        else setModo('montagem')
        return
      }
      if (selecionados.length === 0 || travado) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        excluirSelecionados()
        return
      }
      const passo = e.shiftKey ? 10 : 1
      const delta: Record<string, [number, number]> = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }
      const d = delta[e.key]
      if (!d) return
      e.preventDefault()
      const ids = new Set(selecionados.map((s) => s.id))
      alterarNaLamina(
        (l) => ({
          ...l,
          quadros: l.quadros.map((q) => (ids.has(q.id) ? { ...q, x: q.x + d[0], y: q.y + d[1] } : q)),
          textos: l.textos.map((t) => (ids.has(t.id) ? { ...t, x: t.x + d[0], y: t.y + d[1] } : t)),
          formas: l.formas.map((f) => (ids.has(f.id) ? { ...f, x: f.x + d[0], y: f.y + d[1] } : f)),
        }),
        'Alterada posição',
        `setas-${[...ids].join()}`,
      )
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, desfazer, refazer, selecionados, recortando, escolhendoFoco, travado, excluirSelecionados, alterarNaLamina, copiar, colar, duplicarSelecionados])

  /* ------------------------------- ações ------------------------------- */
  async function finalizar() {
    if (status !== 'aprovado') {
      setModal('aprovacao')
      return
    }
    if (erros > 0) {
      setPainelDir('verificacao')
      setMensagem(`Corrija os ${erros} erro(s) da verificação antes de finalizar.`)
      return
    }
    if (!window.confirm('Finalizar o álbum? A versão aprovada fica bloqueada; mudanças depois disso viram uma nova versão.')) return
    const r = await finalizarAlbum(album.id)
    if (r.ok) setStatus('finalizado')
    else setMensagem(r.erro)
  }

  function alternarTelaCheia() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void raizRef.current?.requestFullscreen?.()
  }

  /* ------------------------------- render ------------------------------- */
  const voltarHref = album.projeto ? `/admin/projetos/${album.projeto.id}` : '/admin/albuns'
  const fotoSel = quadroSel?.fotoId ? (fotos.find((f) => f.id === quadroSel.fotoId) ?? null) : null
  const temConteudo = doc.laminas.some((l) => l.quadros.length > 0 || l.textos.length > 0)
  const nomeDaFoto = (id: string | null) => (id ? (fotos.find((f) => f.id === id)?.nome ?? 'foto') : 'vazio')
  const alteracoes = useMemo(
    () => [hist.presente, ...[...hist.passado].reverse()].map((e, i) => ({ rotulo: e.rotulo, em: e.em, passos: i })),
    [hist],
  )

  if (!g) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#0A0A0A] p-6 text-center text-white">
        <AlertCircle className="h-8 w-8 text-amber-400" aria-hidden />
        <p>O formato “{album.formato}” não é reconhecido. Corrija o formato do álbum para editar.</p>
        <Button asChild variant="outline">
          <Link href={voltarHref}>Voltar</Link>
        </Button>
      </div>
    )
  }

  const botaoTopo = 'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium hover:bg-white/10'

  return (
    <div ref={raizRef} className="fixed inset-0 z-50 flex flex-col bg-[#141414] text-white">
      {/* Barra superior */}
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Link href={voltarHref} className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-xs text-white/70 hover:bg-white/10" aria-label={album.projeto ? 'Voltar ao projeto' : 'Voltar aos álbuns'}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden xl:inline">{album.projeto ? 'Projeto' : 'Álbuns'}</span>
        </Link>
        <div className="min-w-0 flex-1">
          {album.projeto ? (
            <p className="truncate text-sm font-semibold">
              #{album.projeto.numero} · {album.projeto.nome}
            </p>
          ) : (
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={travado}
              onBlur={async () => {
                const limpo = nome.trim()
                if (limpo.length < 2) setNome(album.nome)
                else if (limpo !== album.nome) await atualizarDadosAlbum(album.id, { nome: limpo })
              }}
              aria-label="Nome do álbum"
              className="w-full max-w-sm truncate rounded bg-transparent px-1 text-sm font-semibold outline-none hover:bg-white/5 focus:bg-white/10"
            />
          )}
          <p className="flex items-center gap-1 truncate text-[11px] text-white/50" role="status">
            {!online ? (
              <span className="flex items-center gap-1 text-amber-300">
                <WifiOff className="h-3 w-3" aria-hidden /> Conexão perdida — suas alterações estão sendo guardadas neste navegador
              </span>
            ) : sincronizado ? (
              <span className="flex items-center gap-1 text-emerald-300">
                <Wifi className="h-3 w-3" aria-hidden /> Conexão restaurada · projeto sincronizado
              </span>
            ) : estado === 'salvo' ? (
              <>
                <Check className="h-3 w-3" aria-hidden /> Salvo agora
              </>
            ) : estado === 'salvando' ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Salvando…
              </>
            ) : estado === 'pendente' ? (
              <>
                <Cloud className="h-3 w-3" aria-hidden /> Alterações não salvas
              </>
            ) : estado === 'travado' ? (
              <>
                <Lock className="h-3 w-3" aria-hidden /> Somente leitura
              </>
            ) : (
              <span className="flex items-center gap-1 text-amber-300">
                <CloudOff className="h-3 w-3" aria-hidden /> {mensagem ?? 'Erro ao salvar'}
              </span>
            )}
            <span className="ml-2 hidden sm:inline">
              · {album.clienteNome ? `${album.clienteNome} · ` : ''}
              {album.formato} · {doc.laminas.length * 2} páginas ·{' '}
            </span>
            {!album.projeto ? <span className="hidden rounded-full bg-white/10 px-1.5 sm:inline">{ROTULO_STATUS[status]}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          {!travado ? (
            <div className="mr-1 hidden items-center rounded-full bg-white/5 p-0.5 md:flex" role="radiogroup" aria-label="Modo">
              {(
                [
                  ['montagem', 'Montagem', 'Escolher layouts e trocar fotos (quadros fixos)'],
                  ['designer', 'Designer', 'Editar o layout: mover, redimensionar e criar quadros'],
                ] as const
              ).map(([v, r, d]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={modo === v}
                  title={d}
                  onClick={() => {
                    setModo(v)
                    if (v === 'montagem') setRecortando(false)
                  }}
                  className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', modo === v ? 'bg-white text-[#171717]' : 'text-white/70 hover:text-white')}
                >
                  {r}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={() => desfazer()} disabled={hist.passado.length === 0 || travado} className="rounded-full p-2 text-white/80 hover:bg-white/10 disabled:opacity-30" aria-label="Desfazer">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={refazer} disabled={hist.futuro.length === 0 || travado} className="rounded-full p-2 text-white/80 hover:bg-white/10 disabled:opacity-30" aria-label="Refazer">
            <Redo2 className="h-4 w-4" />
          </button>
          <div className="mx-1 hidden items-center rounded-full bg-white/5 md:flex" role="group" aria-label="Zoom">
            <button type="button" onClick={() => setZoom((z) => [...ZOOMS].reverse().find((v) => v < z) ?? z)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Diminuir zoom">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[2.75rem] text-center text-[11px] tabular-nums">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => ZOOMS.find((v) => v > z) ?? z)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Aumentar zoom">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setZoom(1)} className="rounded-full px-2 py-1 text-[11px] hover:bg-white/10" aria-label="Ajustar à tela">
              Ajustar
            </button>
          </div>
          <button type="button" onClick={() => setModal('visualizar')} className={botaoTopo}>
            <Eye className="h-4 w-4" aria-hidden />
            <span className="hidden lg:inline">Visualizar</span>
          </button>
          <button type="button" onClick={alternarTelaCheia} className={botaoTopo} aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}>
            {telaCheia ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
          <button type="button" onClick={() => setModal('aprovacao')} className={botaoTopo}>
            <Share2 className="h-4 w-4" aria-hidden />
            <span className="hidden lg:inline">Compartilhar</span>
          </button>
          <button type="button" onClick={() => setModal('historico')} className={botaoTopo} aria-label="Histórico">
            <History className="h-4 w-4" aria-hidden />
            <span className="hidden xl:inline">Histórico</span>
          </button>
          <button
            type="button"
            onClick={() => setPainelDir((p) => (p === 'verificacao' ? 'inspetor' : 'verificacao'))}
            aria-pressed={painelDir === 'verificacao'}
            className={cn(botaoTopo, painelDir === 'verificacao' ? 'bg-white text-[#171717] hover:bg-white' : 'bg-white/10')}
          >
            {problemas.filter((p) => p.nivel !== 'info').length === 0 ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
            ) : (
              <AlertTriangle className={cn('h-4 w-4', erros > 0 ? 'text-red-400' : 'text-amber-400')} aria-hidden />
            )}
            <span className="hidden sm:inline">Verificar</span>
          </button>
          <Button size="sm" variant="outline" className="ml-1 border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setModal('publicar')} disabled={estado === 'conflito'}>
            {album.projeto ? <Send className="h-4 w-4" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            <span className="hidden sm:inline">{album.projeto ? 'Publicar' : 'Exportar'}</span>
          </Button>
          {!album.projeto ? (
            <Button size="sm" variant="brand" className="ml-1" onClick={finalizar} disabled={status === 'finalizado' || status === 'em_producao'}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{status === 'finalizado' || status === 'em_producao' ? 'Finalizado' : 'Finalizar'}</span>
            </Button>
          ) : null}
        </div>
      </header>

      {estado === 'conflito' ? (
        <div role="alert" className="flex items-center gap-2 bg-amber-400 px-4 py-2 text-sm text-[#171717]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {mensagem}
          <button type="button" onClick={() => window.location.reload()} className="ml-auto rounded bg-[#171717] px-3 py-1 text-xs font-semibold text-white">
            Recarregar
          </button>
        </div>
      ) : null}
      {travado ? (
        <div className="flex items-center gap-2 bg-emerald-600/90 px-4 py-2 text-sm">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          {album.projeto
            ? 'O projeto já foi aprovado: esta diagramação está travada para edição.'
            : status === 'em_producao'
              ? 'Álbum em produção — versão final bloqueada.'
              : status === 'finalizado'
                ? 'Álbum finalizado — versão final bloqueada. Para mudar algo, crie uma nova versão.'
                : 'O cliente aprovou o álbum — edição travada.'}
          {!album.projeto ? (
            <button type="button" onClick={() => setModal('aprovacao')} className="ml-auto rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30">
              {status === 'aprovado' ? 'Finalizar ou reabrir' : 'Produção e nova versão'}
            </button>
          ) : null}
        </div>
      ) : status === 'alteracoes_solicitadas' || status === 'em_revisao' ? (
        <div className="flex items-center gap-2 bg-amber-500/90 px-4 py-2 text-sm text-[#171717]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {status === 'em_revisao' ? 'Em revisão' : 'O cliente solicitou alterações'} — {comentariosAbertos.length} comentário(s) em aberto.
          <button type="button" onClick={() => setPainelDir('comentarios')} className="ml-auto rounded bg-[#171717] px-3 py-1 text-xs font-semibold text-white">
            Ver comentários
          </button>
        </div>
      ) : null}
      {copiaEncontrada ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 bg-sky-500 px-4 py-2 text-sm text-[#0A0A0A]">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
          Encontramos alterações deste álbum que não chegaram a ser salvas ({new Date(copiaEncontrada.em).toLocaleString('pt-BR')}).
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                const c = copiaEncontrada
                setCopiaEncontrada(null)
                aplicar(() => normalizarDocumento(c.documento), 'Recuperadas alterações não salvas')
              }}
              className="rounded bg-[#0A0A0A] px-3 py-1 text-xs font-semibold text-white"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={() => {
                setCopiaEncontrada(null)
                gravarCopia(album.id, null)
              }}
              className="rounded bg-white/50 px-3 py-1 text-xs font-semibold"
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Barra lateral esquerda: ferramentas + painel */}
        <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-[#0A0A0A] py-2" aria-label="Ferramentas">
          {FERRAMENTAS.map((f) => (
            <button
              key={f.chave}
              type="button"
              onClick={() => setPainelEsq(f.chave)}
              aria-pressed={painelEsq === f.chave}
              className={cn('flex w-14 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px]', painelEsq === f.chave ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white')}
            >
              <f.icone className="h-5 w-5" aria-hidden />
              {f.rotulo}
            </button>
          ))}
        </nav>
        <aside className="hidden w-72 shrink-0 flex-col border-r border-white/10 bg-[#0F0F0F] md:flex">
          {painelEsq === 'fotos' ? (
            <PainelFotos
              key={filtroFotos.chave}
              albumId={album.id}
              projetoId={album.projeto?.id ?? null}
              fotos={fotos}
              usos={usos}
              selecionadas={selecionadas}
              pastas={biblioteca.pastas}
              meta={metaDe}
              filtroInicial={filtroFotos.filtro}
              somenteLeitura={travado}
              onAlternarSelecao={(id) => setSelecionadas((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_FOTOS_POR_LAMINA ? s : [...s, id]))}
              onSelecionarVarias={(ids) => setSelecionadas(ids.slice(0, MAX_FOTOS_POR_LAMINA))}
              onLimparSelecao={() => setSelecionadas([])}
              onFotosNovas={(novas, substituir) =>
                setFotos((lista) => {
                  if (!substituir) return [...lista, ...novas]
                  // Projeto: lista recarregada — preserva o que já foi medido/gerado.
                  const antigas = new Map(lista.map((f) => [f.id, f]))
                  return novas.map((f) => {
                    const a = antigas.get(f.id)
                    return a ? { ...f, ...a, url: f.url } : f
                  })
                })
              }
              onRemoverFoto={async (id) => {
                const r = await removerFotoAlbum(album.id, id)
                if (r.ok) {
                  setFotos((lista) => lista.filter((f) => f.id !== id))
                  setSelecionadas((s) => s.filter((x) => x !== id))
                } else setMensagem(r.erro)
              }}
              onVerLayouts={() => setPainelEsq('layouts')}
              onCriarPagina={criarPaginaComSelecao}
              onMeta={alterarMeta}
              onCriarPasta={criarPasta}
            />
          ) : painelEsq === 'layouts' ? (
            <PainelLayouts
              geometria={g}
              fotosMapa={fotosMapa}
              variantes={variantes}
              origem={origemVariantes}
              selecionadas={selecionadas.length}
              totalFotos={fotos.length}
              sugestaoLaminas={album.projeto?.laminasInclusas ?? Math.max(1, Math.ceil(fotos.length / 4))}
              estiloInicial={estiloDoAlbum.id}
              temConteudo={temConteudo}
              temQuadrosVazios={temQuadrosVazios(doc)}
              somenteLeitura={travado}
              fotosSelecionadas={fotosSelecionadasObj}
              respeitarOrdem={respeitarOrdem}
              assinatura={assinatura}
              reorganizacoes={reorganizacoes}
              templates={templates}
              podeSalvarTemplate={lamina.quadros.length > 0}
              onRespeitarOrdem={setRespeitarOrdem}
              onReordenar={(ordem) => setSelecionadas(ordem)}
              onAplicar={aplicarVariante}
              onAplicarTemplate={aplicarTemplateNaLamina}
              onFavoritarTemplate={favoritar}
              onExcluirTemplate={excluirTemplatePersonalizado}
              onSalvarTemplate={salvarComoTemplate}
              onPreencher={preencher}
            />
          ) : painelEsq === 'modelos' ? (
            <PainelModelos
              geometria={g}
              temConteudo={temConteudo}
              somenteLeitura={travado}
              onAplicar={(m, n) => {
                aplicar(() => documentoDoModelo(m, n, g, album.projeto?.nome ?? nome), `Aplicado modelo ${m.nome}`)
                irPara(0)
              }}
              onAplicarNaLamina={aplicarModeloNaLamina}
            />
          ) : painelEsq === 'fundos' ? (
            <PainelFundos
              lamina={lamina}
              fotos={fotos}
              somenteLeitura={travado}
              onCor={(cor, todas) =>
                aplicar((d) => (todas ? { ...d, laminas: d.laminas.map((l) => ({ ...l, fundo: cor })) } : trocarLamina(d, laminaIdx, (l) => ({ ...l, fundo: cor }))), 'Alterado o fundo', `fundo-${todas}`)
              }
              onImagem={(fundo, todas) =>
                aplicar(
                  (d) => (todas ? { ...d, laminas: d.laminas.map((l) => ({ ...l, fundoImagem: fundo })) } : trocarLamina(d, laminaIdx, (l) => ({ ...l, fundoImagem: fundo }))),
                  'Alterada a foto de fundo',
                  `fundoimg-${todas}`,
                )
              }
              onGradiente={(gr, todas) =>
                aplicar(
                  (d) => (todas ? { ...d, laminas: d.laminas.map((l) => ({ ...l, fundoGradiente: gr })) } : trocarLamina(d, laminaIdx, (l) => ({ ...l, fundoGradiente: gr }))),
                  'Alterado o degradê',
                  `grad-${todas}`,
                )
              }
              onTextura={(t, todas) =>
                aplicar(
                  (d) => (todas ? { ...d, laminas: d.laminas.map((l) => ({ ...l, textura: t })) } : trocarLamina(d, laminaIdx, (l) => ({ ...l, textura: t }))),
                  'Alterada a textura',
                  `textura-${todas}`,
                )
              }
            />
          ) : painelEsq === 'textos' ? (
            <PainelTextos somenteLeitura={travado} onAdicionar={adicionarTexto} />
          ) : painelEsq === 'elementos' ? (
            <PainelElementos somenteLeitura={travado} onAdicionar={adicionarForma} />
          ) : painelEsq === 'paginas' ? (
            <PainelPaginas
              laminas={doc.laminas}
              geometria={g}
              fotos={fotosMapa}
              ativa={laminaIdx}
              primeiraEhCapa={doc.primeiraEhCapa}
              somenteLeitura={travado}
              onIr={irPara}
              onDuplicar={duplicarLamina}
              onLimpar={limparLamina}
              onExcluir={excluirLamina}
              onInserir={inserirLamina}
              onLayoutVazio={layoutVazioNa}
            />
          ) : (
            <PainelConfiguracoes
              avulso={!album.projeto}
              nome={nome}
              clienteNome={album.clienteNome}
              tipo={album.tipo}
              formato={album.formato}
              orientacao={album.orientacao}
              sangria={album.sangriaMm}
              margem={album.margemSeguraMm}
              primeiraEhCapa={doc.primeiraEhCapa}
              mostrarGuias={mostrarGuias}
              somenteLeitura={travado}
              onSalvarDados={async (d) => {
                const r = await atualizarDadosAlbum(album.id, d)
                if (!r.ok) return r.erro
                if (d.nome) setNome(d.nome)
                router.refresh()
                return null
              }}
              onCapa={(v) => aplicar((d) => ({ ...d, primeiraEhCapa: v }), v ? 'Primeira lâmina virou capa' : 'Primeira lâmina deixou de ser capa')}
              onGuias={setMostrarGuias}
            />
          )}
        </aside>

        <main className="relative min-w-0 flex-1 bg-[#1C1C1C]">
          <CanvasLamina
            key={lamina.id}
            geometria={g}
            lamina={lamina}
            fotos={fotosMapa}
            selecao={selecao}
            selecionados={selecionados}
            recortando={recortando}
            modo={modo}
            escolhendoFoco={escolhendoFoco}
            onEntrarDesigner={() => !travado && setModo('designer')}
            onAjustarFoto={(id) => {
              const q = lamina.quadros.find((x) => x.id === id)
              setSelecionados([{ tipo: 'quadro', id }])
              setPainelDir('inspetor')
              if (q?.fotoId) setRecortando(true)
              else if (!travado) setModo('designer')
            }}
            onEscolherFoco={definirFoco}
            mostrarGuias={mostrarGuias}
            zoom={zoom}
            somenteLeitura={travado}
            onZoom={setZoom}
            onSelecionar={selecionar}
            onAlterarQuadro={(id, patch) => alterarQuadro(id, patch, rotuloDoMovimento(patch), grupoDoMovimento(patch))}
            onAlterarTexto={(id, patch) => alterarTexto(id, patch, rotuloDoMovimento(patch), grupoDoMovimento(patch))}
            onAlterarForma={(id, patch) => alterarForma(id, patch, rotuloDoMovimento(patch), grupoDoMovimento(patch))}
            onMoverVarios={moverVarios}
            onAjustarQuadros={(patches) => {
              const m = new Map(patches.map((p) => [p.id, p.patch]))
              alterarNaLamina((l) => ({ ...l, quadros: l.quadros.map((q) => (m.has(q.id) ? { ...q, ...m.get(q.id) } : q)) }), 'Ajustada a divisória entre fotos')
            }}
            onTrocarFotos={trocarFotos}
            onSoltarFoto={soltarFoto}
            onDimensoes={aoDescobrirDimensoes}
          />
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-white/40">
            {rotuloDaLamina(laminaIdx, doc.primeiraEhCapa)}
            {modo === 'montagem' && !travado ? ' · Montagem: arraste foto sobre foto para trocar · duplo clique na página para editar o layout' : ''}
            {modo === 'designer' && !recortando ? ' · Designer: mova e redimensione os quadros · Esc volta à montagem' : ''}
            {recortando ? (escolhendoFoco ? ' · clique no ponto principal da foto' : ' · arraste a foto dentro do quadro · Esc conclui') : ''}
            {zoom > 1 ? ' · arraste o fundo ou role para mover' : ''}
          </p>
          {boasVindas ? (
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-[#171717] shadow-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
              Seu projeto foi salvo automaticamente.
              <button type="button" onClick={() => setBoasVindas(false)} className="font-semibold underline">
                Continuar edição
              </button>
            </div>
          ) : null}
        </main>

        <aside className="hidden w-72 shrink-0 flex-col border-l border-white/10 bg-[#0F0F0F] lg:flex">
          <div className="grid grid-cols-4 border-b border-white/10 text-[10px]" role="tablist" aria-label="Painel direito">
            {(
              [
                ['inspetor', 'Propriedades', SlidersHorizontal],
                ['camadas', 'Camadas', Layers],
                ['comentarios', 'Comentários', MessageSquare],
                ['verificacao', 'Verificar', ShieldCheck],
              ] as const
            ).map(([v, r, Icone]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={painelDir === v}
                onClick={() => setPainelDir(v)}
                className={cn('relative flex flex-col items-center gap-0.5 py-2', painelDir === v ? 'border-b-2 border-white text-white' : 'text-white/50 hover:text-white')}
              >
                <Icone className="h-4 w-4" aria-hidden />
                {r}
                {v === 'comentarios' && comentariosAbertos.length > 0 ? (
                  <span className="absolute right-2 top-1 rounded-full bg-sky-400 px-1 text-[9px] font-bold text-[#0A0A0A]">{comentariosAbertos.length}</span>
                ) : null}
              </button>
            ))}
          </div>
          {painelDir === 'inspetor' && selecionados.length > 0 && !travado ? <BarraAlinhamento quantos={selecionados.length} onAlinhar={alinhar} /> : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {painelDir === 'verificacao' ? (
              <div className="space-y-3 p-4">
                {problemas.length === 0 ? (
                  <p className="flex items-start gap-2 text-sm text-emerald-300">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      <strong className="block">Álbum pronto</strong>
                      Nenhum problema encontrado.
                    </span>
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-white/80">
                      {problemas.length} ponto(s) encontrado(s)
                      {erros > 0 ? <span className="block text-xs text-red-300">Erros impedem a finalização.</span> : null}
                    </p>
                    <ul className="space-y-2">
                      {problemas.map((p, i) => {
                        const n = NIVEL[p.nivel]
                        return (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => {
                                if (p.acao === 'fotos-nao-usadas') {
                                  setPainelEsq('fotos')
                                  setFiltroFotos((f) => ({ chave: f.chave + 1, filtro: 'nao-usadas' }))
                                  return
                                }
                                setAtiva(p.laminaIndice)
                                setRecortando(false)
                                if (p.elementoId) {
                                  const l = doc.laminas[p.laminaIndice]
                                  const tipo = l?.quadros.some((q) => q.id === p.elementoId) ? 'quadro' : l?.textos.some((t) => t.id === p.elementoId) ? 'texto' : 'forma'
                                  setSelecionados([{ tipo, id: p.elementoId }])
                                } else setSelecionados([])
                              }}
                              className="flex w-full items-start gap-2 rounded-lg bg-white/5 p-2.5 text-left text-xs hover:bg-white/10"
                            >
                              <n.icone className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', n.cor)} aria-hidden />
                              <span>
                                <span className="font-semibold text-white/80">
                                  {n.rotulo} · {p.laminaIndice >= 0 ? rotuloDaLamina(p.laminaIndice, doc.primeiraEhCapa, false) : 'Álbum'}
                                </span>
                                <span className="block text-white/70">{p.mensagem}</span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </div>
            ) : painelDir === 'comentarios' ? (
              <div className="space-y-3 p-4 text-sm">
                {album.projeto ? (
                  <p className="text-white/60">
                    Os comentários do cliente deste projeto ficam na{' '}
                    <Link href={`/admin/projetos/${album.projeto.id}/prova`} className="underline">
                      prova
                    </Link>
                    .
                  </p>
                ) : !aprovacaoAtual ? (
                  <p className="text-white/60">Ainda não houve envio para o cliente. Use Compartilhar → Enviar para aprovação.</p>
                ) : aprovacaoAtual.comentarios.length === 0 ? (
                  <p className="text-white/60">Sem comentários no envio {aprovacaoAtual.numero}.</p>
                ) : (
                  [...new Set(aprovacaoAtual.comentarios.map((c) => c.laminaIndice))]
                    .sort((a, b) => a - b)
                    .map((li) => {
                      const cs = aprovacaoAtual.comentarios.filter((c) => c.laminaIndice === li)
                      return (
                        <div key={li} className="rounded-lg bg-white/5 p-2">
                          <button type="button" onClick={() => irPara(li)} className="text-xs font-semibold underline">
                            {aprovacaoAtual.laminas[li]?.rotulo ?? `Lâmina ${li + 1}`} · {cs.length} comentário(s)
                          </button>
                          <ul className="mt-1 space-y-1">
                            {cs.map((c) => (
                              <li key={c.id} className="flex items-start gap-2 text-xs">
                                {c.origem === 'cliente' ? (
                                  <input
                                    type="checkbox"
                                    checked={c.resolvido}
                                    aria-label="Resolvido"
                                    onChange={async (e) => {
                                      const r = await resolverComentarioAlbum(c.id, e.target.checked)
                                      if (r.ok) void carregarComentarios()
                                    }}
                                    className="mt-0.5 accent-white"
                                  />
                                ) : (
                                  <span className="w-3.5" />
                                )}
                                <span className={cn(c.resolvido && 'text-white/40 line-through')}>
                                  <strong>{c.origem === 'equipe' ? `${c.autor} (equipe)` : c.autor}:</strong> {c.texto}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })
                )}
              </div>
            ) : painelDir === 'camadas' ? (
              <PainelCamadas
                lamina={lamina}
                selecionados={selecionados}
                nomeDaFoto={nomeDaFoto}
                somenteLeitura={travado}
                onSelecionar={(s, aditivo) => selecionar(s, aditivo)}
                onAlternar={alternarCamada}
                onMover={(s, d) => mudarOrdem(d, s)}
              />
            ) : selecionados.length > 1 && !travado ? (
              <InspetorMultiplo
                itens={selecionados
                  .map((s): CaixaSelecionada | null => {
                    const c = caixaDe(s)
                    return c ? { id: s.id, tipo: s.tipo, x: c.x, y: c.y, w: c.w, h: c.h } : null
                  })
                  .filter((x): x is CaixaSelecionada => Boolean(x))}
                onAlterarVarios={(patches, rotulo) => {
                  const m = new Map(patches.map((p) => [p.id, p.patch]))
                  alterarNaLamina(
                    (l) => ({
                      ...l,
                      quadros: l.quadros.map((q) => (m.has(q.id) ? { ...q, ...m.get(q.id) } : q)),
                      textos: l.textos.map((t) => {
                        const p = m.get(t.id)
                        return p ? { ...t, x: p.x ?? t.x, y: p.y ?? t.y, w: p.w ?? t.w } : t
                      }),
                      formas: l.formas.map((f) => (m.has(f.id) ? { ...f, ...m.get(f.id) } : f)),
                    }),
                    rotulo,
                  )
                }}
                onLote={selecionados.some((x) => x.tipo === 'quadro') ? aplicarLote : undefined}
                onExcluir={excluirSelecionados}
                onDuplicar={duplicarSelecionados}
              />
            ) : quadroSel ? (
              <InspetorQuadro
                geometria={g}
                quadro={quadroSel}
                foto={
                  fotoSel
                    ? {
                        nome: fotoSel.nome,
                        largura: fotoSel.largura,
                        altura: fotoSel.altura,
                        estouro: fotoSel.estouro,
                        fx: metaDe(fotoSel.id).foco?.fx ?? fotoSel.fx,
                        fy: metaDe(fotoSel.id).foco?.fy ?? fotoSel.fy,
                        focoManual: Boolean(metaDe(fotoSel.id).foco) || fotoSel.focoManual,
                      }
                    : null
                }
                recortando={recortando}
                escolhendoFoco={escolhendoFoco}
                onRecortar={(v) => {
                  setRecortando(v)
                  if (!v) setEscolhendoFoco(false)
                }}
                onEscolherFoco={setEscolhendoFoco}
                onAlterar={(patch) => !travado && alterarQuadro(quadroSel.id, patch, 'Ajustada a foto', `inspetor-${quadroSel.id}-${Object.keys(patch).join()}`)}
                onOrdem={(d) => mudarOrdem(d)}
                onExcluir={excluirSelecionados}
                onDuplicar={duplicarSelecionados}
              />
            ) : textoSel ? (
              <InspetorTexto
                texto={textoSel}
                onAlterar={(patch) => !travado && alterarTexto(textoSel.id, patch, 'Alterado o texto', `inspetor-${textoSel.id}-${Object.keys(patch).join()}`)}
                onOrdem={(d) => mudarOrdem(d)}
                onExcluir={excluirSelecionados}
                onDuplicar={duplicarSelecionados}
              />
            ) : formaSel ? (
              <InspetorForma
                forma={formaSel}
                onAlterar={(patch) => !travado && alterarForma(formaSel.id, patch, 'Alterado o elemento', `inspetor-${formaSel.id}-${Object.keys(patch).join()}`)}
                onOrdem={(d) => mudarOrdem(d)}
                onExcluir={excluirSelecionados}
                onDuplicar={duplicarSelecionados}
              />
            ) : (
              <InspetorLamina
                lamina={lamina}
                indice={laminaIdx}
                primeiraEhCapa={doc.primeiraEhCapa}
                comentarios={comentariosPorLamina.get(laminaIdx) ?? 0}
                somenteLeitura={travado}
                onFundo={(cor) => aplicar((d) => trocarLamina(d, laminaIdx, (l) => ({ ...l, fundo: cor })), 'Alterado o fundo', `fundo-${laminaIdx}`)}
                onIrFundos={() => setPainelEsq('fundos')}
                onAdicionarTexto={() => adicionarTexto({ texto: 'Seu texto aqui' })}
                onLayoutVazio={(n) => layoutVazioNa(laminaIdx, n)}
                vao={vao}
                onVao={mudarEspacamento}
                onSalvarTemplate={salvarComoTemplate}
              />
            )}
          </div>
        </aside>
      </div>

      <footer className="border-t border-white/10 bg-[#0F0F0F]">
        <FitaLaminas
          laminas={doc.laminas}
          geometria={g}
          fotos={fotosMapa}
          ativa={laminaIdx}
          primeiraEhCapa={doc.primeiraEhCapa}
          problemasPorLamina={problemasPorLamina}
          comentariosPorLamina={comentariosPorLamina}
          somenteLeitura={travado}
          onIr={irPara}
          onAdicionar={() => inserirLamina('vazia')}
          onDuplicar={duplicarLamina}
          onLimpar={limparLamina}
          onExcluir={excluirLamina}
          onMover={(de, para) => {
            if (para < 0 || para >= doc.laminas.length || de === para) return
            aplicar((d) => {
              const lista = [...d.laminas]
              const [item] = lista.splice(de, 1)
              lista.splice(para, 0, item)
              return { ...d, laminas: lista }
            }, 'Reordenadas as páginas')
            setAtiva(para)
          }}
        />
      </footer>

      <Publicar
        aberto={modal === 'publicar'}
        onFechar={() => setModal(null)}
        albumId={album.id}
        nome={nome}
        projeto={album.projeto ? { id: album.projeto.id, numero: album.projeto.numero } : null}
        documento={doc}
        geometria={g}
        problemas={problemas}
        urlsOriginais={urlsOriginais}
        urlsPreview={urlsPreview}
        finalizado={status === 'finalizado' || status === 'em_producao'}
        antesDePublicar={salvar}
      />
      {modal === 'visualizar' ? (
        <Visualizacao
          documento={doc}
          geometria={g}
          urls={urlsPreview}
          indiceInicial={laminaIdx}
          onFechar={(i) => {
            setModal(null)
            irPara(i)
          }}
        />
      ) : null}
      <Historico
        aberto={modal === 'historico'}
        onFechar={() => setModal(null)}
        albumId={album.id}
        somenteLeitura={travado}
        antesDeSalvar={salvar}
        onRestaurar={(d) => {
          aplicar(() => d, 'Restaurada versão anterior')
          irPara(0)
        }}
        alteracoes={alteracoes}
        onVoltarPara={(passos) => desfazer(passos)}
      />
      <AprovacaoPainel
        aberto={modal === 'aprovacao'}
        onFechar={() => {
          setModal(null)
          void carregarComentarios()
        }}
        albumId={album.id}
        projetoId={album.projeto?.id ?? null}
        status={status}
        documento={doc}
        geometria={g}
        urls={urlsPreview}
        antesDeEnviar={salvar}
        erros={erros}
        onStatus={(s) => {
          setStatus(s)
          if ((s === 'em_edicao' || s === 'em_revisao') && estado === 'travado') {
            parado.current = false
            setEstado('salvo')
          }
          router.refresh()
        }}
        onIrPara={(i) => {
          setModal(null)
          irPara(i)
        }}
      />
    </div>
  )

  function copiaDeLamina(o: LaminaDoc): LaminaDoc {
    return {
      ...o,
      id: novoId('l'),
      quadros: o.quadros.map((q) => ({ ...q, id: novoId() })),
      textos: o.textos.map((t) => ({ ...t, id: novoId('t') })),
      formas: o.formas.map((f) => ({ ...f, id: novoId('f') })),
    }
  }

  function duplicarLamina(i: number) {
    aplicar((d) => ({ ...d, laminas: [...d.laminas.slice(0, i + 1), copiaDeLamina(d.laminas[i]), ...d.laminas.slice(i + 1)] }), 'Duplicada página')
    setAtiva(i + 1)
    setSelecionados([])
  }

  function limparLamina(i: number) {
    aplicar((d) => trocarLamina(d, i, (l) => ({ ...l, quadros: [], textos: [], formas: [], fundoImagem: null })), 'Limpa a página')
    setSelecionados([])
  }

  function excluirLamina(i: number) {
    if (doc.laminas.length === 1) return
    const l = doc.laminas[i]
    if ((l.quadros.length > 0 || l.textos.length > 0) && !window.confirm('Excluir esta lâmina e o conteúdo dela? Dá para desfazer com Ctrl+Z.')) return
    aplicar((d) => ({ ...d, laminas: d.laminas.filter((_, k) => k !== i) }), 'Excluída página')
    setAtiva(Math.max(0, i - 1))
    setSelecionados([])
  }
}
