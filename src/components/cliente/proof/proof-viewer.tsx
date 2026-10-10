'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Columns2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  ImageOff,
  Layers,
  LayoutGrid,
  Gift,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  MapPin,
  MessageCircle,
  Send,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { ComparadorVersoes } from '@/components/cliente/proof/comparador-versoes'
import { addProofComment, clientApprove, clientRequestChanges, marcarComentarioResolvido } from '@/lib/actions/projetos'
import { fotografoAprovar, fotografoComentar, fotografoPedirAjustes } from '@/lib/actions/prova-fotografo'
import { AREA_MINIMA } from '@/lib/apontamento'
import { cn, formatBRL, formatDate, rolagemSuave } from '@/lib/utils'
import type { DesignVersion, ItemEscolhido, Lamina, OfertaAdicional, ProofComment, ResumoExcedente } from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * A tela mais crítica do portal (seção 22/"Aprovação B2C blindada"). Full-screen
 * de propósito — o `fixed inset-0` escapa do container dos layouts.
 *
 * `locked` vem do servidor (status real do projeto, não de um estado local) —
 * é o que garante que a trava sobrevive a um F5 ou a outra aba: uma vez
 * aprovado, não existe caminho de volta para a UI interativa.
 *
 * `perfil` escolhe quem está revisando: o cliente final (portal /cliente), o
 * fotógrafo dono do projeto (/dashboard/albuns/[id]/prova) ou a equipe
 * (/admin/projetos/[id]/prova, só leitura — para ver onde estão os pins).
 *
 * Fase 4 (migration 0019): na visão da equipe, cada comentário/pin pode ser
 * marcado como resolvido — o pin fica verde e translúcido, com check, e a
 * barra de baixo conta o que ainda falta corrigir naquela versão.
 *
 * Galeria (migration 0032): a prova abre com todas as lâminas lado a lado;
 * numa versão parcial, as que mudaram ganham o selo "Alterada" e dá para
 * filtrar só elas. O painel lateral da galeria lista TODAS as orientações da
 * versão, numeradas — clicar leva à lâmina com o ponto destacado. Aberta a
 * lâmina, tocar marca um ponto e arrastar (mouse/caneta) marca uma área.
 *
 * Fase 3 (migration 0018): as lâminas são as imagens reais da versão
 * (`versoes_laminas`), num carrossel com scroll-snap (arrastar no celular,
 * setas/teclado no desktop). Tocar numa lâmina marca um PIN: o comentário
 * guarda a lâmina e a posição em % — o pin cai no mesmo ponto em qualquer tela.
 */
const ACOES = {
  cliente: { aprovar: clientApprove, pedirAjustes: clientRequestChanges, comentar: addProofComment },
  fotografo: { aprovar: fotografoAprovar, pedirAjustes: fotografoPedirAjustes, comentar: fotografoComentar },
  equipe: null,
} as const

type PinRascunho = { laminaId: string; x: number; y: number; largura?: number; altura?: number }

export function ProofViewer({
  projectId,
  projectName,
  autor,
  versions,
  initialComments,
  locked,
  excedente = null,
  aguardandoPagamento = false,
  ofertas = [],
  perfil = 'cliente',
  podeDecidir = true,
  versaoInicial,
  finalizarHref,
}: {
  projectId: string
  projectName: string
  autor: string
  versions: DesignVersion[]
  initialComments: ProofComment[]
  locked: boolean
  /**
   * Fotógrafo: lâminas da versão contra a franquia do plano, calculadas pelo
   * banco — mostradas ANTES do clique final. Cliente final: sempre null
   * (white label: quem paga o excedente é o estúdio).
   */
  excedente?: ResumoExcedente | null
  /** Já aprovado, com lâminas extras a pagar (só faz sentido para o fotógrafo). */
  aguardandoPagamento?: boolean
  /**
   * Upsell (0026): adicionais oferecidos depois da confirmação da aprovação.
   * Casal: preço de revenda do estúdio. Fotógrafo: custo (é ele quem paga).
   */
  ofertas?: OfertaAdicional[]
  perfil?: keyof typeof ACOES
  /** A prova está aguardando decisão (projeto em `aguardando_aprovacao_cliente`). */
  podeDecidir?: boolean
  versaoInicial?: number
  /** Equipe, com o cliente esperando ajustes: leva para subir a próxima versão. */
  finalizarHref?: string
}) {
  const router = useRouter()
  const acoes = ACOES[perfil]
  const leituraEquipe = perfil === 'equipe'
  const voltarHref =
    perfil === 'fotografo' ? '/dashboard/meus-albuns' : perfil === 'equipe' ? `/admin/projetos/${projectId}` : `/cliente/projetos/${projectId}`

  const versoesOrdenadas = useMemo(() => [...versions].sort((a, b) => a.numero - b.numero), [versions])
  const versaoMaisRecente = versoesOrdenadas[versoesOrdenadas.length - 1]?.numero ?? 1

  const [pageIndex, setPageIndex] = useState(0)
  const [versaoSelecionada, setVersaoSelecionada] = useState(
    versaoInicial && versoesOrdenadas.some((v) => v.numero === versaoInicial) ? versaoInicial : versaoMaisRecente,
  )
  const [comments, setComments] = useState<ProofComment[]>(initialComments)
  const [draft, setDraft] = useState('')
  const [pinRascunho, setPinRascunho] = useState<PinRascunho | null>(null)
  const [destacado, setDestacado] = useState<string | null>(null)
  const [mobileCommentsOpen, setMobileCommentsOpen] = useState(false)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [ofertaAberta, setOfertaAberta] = useState(false)
  const [escolhidos, setEscolhidos] = useState<Record<string, number>>({})
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [decision, setDecision] = useState<'aprovado' | 'ajustes_enviados' | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [proporcoes, setProporcoes] = useState<Record<string, number>>({})
  const [alternando, setAlternando] = useState<string | null>(null)
  const [comparando, setComparando] = useState(false)
  const [vista, setVista] = useState<'galeria' | 'lamina'>('galeria')
  const [soAlteradas, setSoAlteradas] = useState(false)
  const [areaRascunho, setAreaRascunho] = useState<PinRascunho | null>(null)

  const carrosselRef = useRef<HTMLDivElement>(null)
  const campoRef = useRef<HTMLTextAreaElement>(null)
  // Arrasto para marcar área: início em % e se o gesto virou arrasto (o click depois não marca ponto).
  const arrastoRef = useRef<{ laminaId: string; x: number; y: number } | null>(null)
  const arrastouRef = useRef(false)

  const versaoAtual = versoesOrdenadas.find((v) => v.numero === versaoSelecionada)
  const laminas: Lamina[] = useMemo(() => [...(versaoAtual?.laminas ?? [])].sort((a, b) => a.ordem - b.ordem), [versaoAtual])
  const laminaAtual = laminas[pageIndex] ?? null
  // Versão parcial: herdou lâminas da anterior (as herdadas vêm com alterada = false).
  const versaoParcial = laminas.some((l) => l.alterada === false)
  const nAlteradas = laminas.filter((l) => l.alterada !== false).length

  // Comparar (equipe): a versão anterior à selecionada, com os pins dela.
  const indiceSelecionada = versoesOrdenadas.findIndex((v) => v.numero === versaoSelecionada)
  const versaoAnterior = indiceSelecionada > 0 ? versoesOrdenadas[indiceSelecionada - 1] : null
  const emComparacao = leituraEquipe && comparando && versaoAnterior !== null
  const laminasAnteriores: Lamina[] = useMemo(
    () => [...(versaoAnterior?.laminas ?? [])].sort((a, b) => a.ordem - b.ordem),
    [versaoAnterior],
  )
  const totalLaminas = emComparacao ? Math.max(laminas.length, laminasAnteriores.length) : laminas.length
  // Comparando, os comentários que importam são os da versão anterior: os pedidos a conferir.
  const versaoDosComentarios = emComparacao ? versaoAnterior.numero : versaoSelecionada

  const versaoAntiga = versaoSelecionada !== versaoMaisRecente
  // Comentar/decidir: só a versão atual, com a prova liberada, fora da equipe.
  const interativo = !leituraEquipe && !versaoAntiga && podeDecidir
  const arquivoSelecionado = versaoAtual?.arquivo ?? ''
  const arquivoDaVersao = /^https?:\/\//.test(arquivoSelecionado) ? arquivoSelecionado : null

  const comentariosDaVersao = useMemo(() => comments.filter((c) => c.versao === versaoDosComentarios), [comments, versaoDosComentarios])
  // Numeração dos pins: ordem de criação dentro da versão — a mesma na lâmina e na lista.
  const numeroDoPin = useMemo(() => {
    const mapa = new Map<string, number>()
    comentariosDaVersao.filter((c) => c.posicaoX != null).forEach((c, i) => mapa.set(c.id, i + 1))
    return mapa
  }, [comentariosDaVersao])
  const comentariosDaLamina = (lamina: Lamina | null, indice: number) =>
    comentariosDaVersao.filter((c) => (c.laminaId ? c.laminaId === lamina?.id : c.pageIndex === indice))
  const commentsForPage = comentariosDaLamina(emComparacao ? (laminasAnteriores[pageIndex] ?? null) : laminaAtual, pageIndex)
  const pendentesDaVersao = comentariosDaVersao.filter((c) => !c.resolvido).length

  // Troca de versão: volta para a primeira lâmina.
  useEffect(() => {
    setPageIndex(0)
    setPinRascunho(null)
    setSoAlteradas(false)
    carrosselRef.current?.scrollTo({ left: 0 })
  }, [versaoSelecionada])

  // Comparar só existe lâmina a lâmina.
  useEffect(() => {
    if (emComparacao) setVista('lamina')
  }, [emComparacao])

  // Galeria → lâmina: o carrossel monta agora; posiciona sem animação.
  useEffect(() => {
    if (vista !== 'lamina') return
    const el = carrosselRef.current
    if (el) el.scrollTo({ left: pageIndex * el.clientWidth })
    // Só na troca de vista; depois o índice segue o scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista])

  function abrirLamina(indice: number, comentarioId?: string) {
    setPageIndex(indice)
    setPinRascunho(null)
    setDestacado(comentarioId ?? null)
    setVista('lamina')
    if (vista === 'lamina') {
      const el = carrosselRef.current
      if (el) el.scrollTo({ left: indice * el.clientWidth, behavior: rolagemSuave() })
    }
  }

  const irPara = useCallback(
    (indice: number) => {
      const alvo = Math.max(0, Math.min(indice, totalLaminas - 1))
      // Comparando não há carrossel: o índice manda direto nos dois quadros.
      if (emComparacao) {
        setPageIndex(alvo)
        setDestacado(null)
        return
      }
      const el = carrosselRef.current
      if (!el) return
      el.scrollTo({ left: alvo * el.clientWidth, behavior: rolagemSuave() })
    },
    [totalLaminas, emComparacao],
  )

  // Saindo do modo comparar, o carrossel volta montado na lâmina em que estava.
  useEffect(() => {
    if (emComparacao) return
    const el = carrosselRef.current
    if (!el) return
    const alvo = Math.max(0, Math.min(pageIndex, laminas.length - 1))
    if (alvo !== pageIndex) setPageIndex(alvo)
    el.scrollTo({ left: alvo * el.clientWidth })
    // Só na troca de modo; o índice segue o scroll pelo `aoRolar`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emComparacao])

  // O índice acompanha o arrasto (scroll-snap), não só os botões.
  function aoRolar() {
    const el = carrosselRef.current
    if (!el || el.clientWidth === 0) return
    const indice = Math.round(el.scrollLeft / el.clientWidth)
    if (indice !== pageIndex) {
      setPageIndex(indice)
      setPinRascunho(null)
    }
  }

  // Setas do teclado no desktop.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      if (alvo && ['TEXTAREA', 'INPUT'].includes(alvo.tagName)) return
      if (vista !== 'lamina') return
      if (e.key === 'Escape' && !emComparacao) setVista('galeria')
      if (e.key === 'ArrowRight') irPara(pageIndex + 1)
      if (e.key === 'ArrowLeft') irPara(pageIndex - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [irPara, pageIndex, vista, emComparacao])

  /** Posição do ponteiro em % da lâmina (0–100, presa nas bordas). */
  function emPorcento(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const prender = (v: number) => Math.max(0, Math.min(100, v))
    return { x: prender(((e.clientX - r.left) / r.width) * 100), y: prender(((e.clientY - r.top) / r.height) * 100) }
  }

  function retangulo(laminaId: string, a: { x: number; y: number }, b: { x: number; y: number }): PinRascunho {
    const duas = (v: number) => Math.round(v * 100) / 100
    return {
      laminaId,
      x: duas(Math.min(a.x, b.x)),
      y: duas(Math.min(a.y, b.y)),
      largura: duas(Math.abs(a.x - b.x)),
      altura: duas(Math.abs(a.y - b.y)),
    }
  }

  // Área: só com mouse/caneta — no toque, arrastar continua passando as lâminas.
  function iniciarArea(e: React.PointerEvent<HTMLDivElement>, lamina: Lamina) {
    if (!interativo || e.pointerType === 'touch' || e.button !== 0) return
    arrastoRef.current = { laminaId: lamina.id, ...emPorcento(e) }
    arrastouRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function moverArea(e: React.PointerEvent<HTMLDivElement>) {
    const inicio = arrastoRef.current
    if (!inicio) return
    const area = retangulo(inicio.laminaId, inicio, emPorcento(e))
    if ((area.largura ?? 0) >= AREA_MINIMA && (area.altura ?? 0) >= AREA_MINIMA) {
      arrastouRef.current = true
      setAreaRascunho(area)
    }
  }

  function terminarArea(e: React.PointerEvent<HTMLDivElement>) {
    const inicio = arrastoRef.current
    arrastoRef.current = null
    setAreaRascunho(null)
    if (!inicio || !arrastouRef.current) return
    setPinRascunho(retangulo(inicio.laminaId, inicio, emPorcento(e)))
    setDestacado(null)
    window.setTimeout(() => campoRef.current?.focus(), 50)
  }

  function marcarPin(e: React.MouseEvent<HTMLDivElement>, lamina: Lamina) {
    if (!interativo) return
    // O click que fecha um arrasto não vira ponto.
    if (arrastouRef.current) {
      arrastouRef.current = false
      return
    }
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    if (x < 0 || x > 100 || y < 0 || y > 100) return
    setPinRascunho({ laminaId: lamina.id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })
    setDestacado(null)
    // Celular: abre a gaveta; desktop: o campo já está na lateral.
    if (window.matchMedia('(min-width: 1024px)').matches) window.setTimeout(() => campoRef.current?.focus(), 50)
    else setMobileCommentsOpen(true)
  }

  async function addComment() {
    if (!draft.trim() || !interativo || !acoes) return
    const texto = draft.trim()
    const pin = pinRascunho && pinRascunho.laminaId === laminaAtual?.id ? pinRascunho : null
    const novo: ProofComment = {
      id: `comment-${Date.now()}`,
      pageIndex,
      versao: versaoSelecionada,
      texto,
      autor,
      data: new Date().toISOString(),
      laminaId: laminaAtual?.id ?? null,
      posicaoX: pin?.x ?? null,
      posicaoY: pin?.y ?? null,
      areaLargura: pin?.largura ?? null,
      areaAltura: pin?.altura ?? null,
    }
    setComments((prev) => [...prev, novo])
    setDraft('')
    setPinRascunho(null)
    setErroAcao(null)
    if (DEMO_MODE) return
    try {
      await acoes.comentar(
        projectId,
        pageIndex,
        versaoSelecionada,
        texto,
        laminaAtual
          ? { laminaId: laminaAtual.id, x: pin?.x ?? null, y: pin?.y ?? null, largura: pin?.largura ?? null, altura: pin?.altura ?? null }
          : null,
      )
    } catch {
      // Não some em silêncio: devolve o texto e o pin para tentar de novo.
      setComments((prev) => prev.filter((c) => c.id !== novo.id))
      setDraft(texto)
      if (pin) setPinRascunho(pin)
      setErroAcao('Não foi possível salvar o comentário. Tente de novo.')
    }
  }

  // Equipe: marca/desmarca como resolvido, otimista — volta atrás se o banco recusar.
  async function alternarResolvido(comentario: ProofComment) {
    if (!leituraEquipe || alternando) return
    const resolvido = !comentario.resolvido
    const aplicar = (r: boolean, em: string | null) =>
      setComments((prev) => prev.map((c) => (c.id === comentario.id ? { ...c, resolvido: r, resolvidoEm: em } : c)))
    aplicar(resolvido, resolvido ? new Date().toISOString() : null)
    setAlternando(comentario.id)
    setErroAcao(null)
    try {
      const r = await marcarComentarioResolvido(comentario.id, resolvido)
      if (r.ok) aplicar(resolvido, r.resolvidoEm)
      else {
        aplicar(!!comentario.resolvido, comentario.resolvidoEm ?? null)
        setErroAcao(r.erro)
      }
    } catch {
      aplicar(!!comentario.resolvido, comentario.resolvidoEm ?? null)
      setErroAcao('Não foi possível atualizar o comentário. Tente de novo.')
    } finally {
      setAlternando(null)
    }
  }

  // "Sim, aprovar": com ofertas, passa pelo modal de adicionais antes de gravar.
  function confirmarAprovacao() {
    setApproveModalOpen(false)
    if (ofertas.length > 0) setOfertaAberta(true)
    else void confirmApprove([])
  }

  async function confirmApprove(adicionais: ItemEscolhido[]) {
    setApproveModalOpen(false)
    setOfertaAberta(false)
    if (!DEMO_MODE && acoes) {
      setEnviando(true)
      try {
        await acoes.aprovar(projectId, versaoMaisRecente, adicionais)
      } catch (e) {
        setEnviando(false)
        setErroAcao(e instanceof Error ? e.message : 'Não foi possível aprovar. Tente de novo.')
        return
      }
    }
    // "Não, obrigado" depois de escolher algo: a tela final não pode citar
    // (nem somar) adicionais que não foram enviados.
    if (adicionais.length === 0) setEscolhidos({})
    setDecision('aprovado')
  }

  async function confirmAdjustments() {
    setAdjustModalOpen(false)
    if (!DEMO_MODE && acoes) {
      setEnviando(true)
      const resumo = comments
        .filter((c) => c.versao === versaoMaisRecente)
        .map((c) => {
          const n = numeroDoPin.get(c.id)
          return `Lâmina ${c.pageIndex + 1}${n ? ` (${c.areaLargura ? 'área' : 'pin'} ${n})` : ''}: ${c.texto}`
        })
        .join(' | ')
      try {
        await acoes.pedirAjustes(projectId, versaoMaisRecente, resumo)
      } catch (e) {
        setEnviando(false)
        setErroAcao(e instanceof Error ? e.message : 'Não foi possível enviar os ajustes. Tente de novo.')
        return
      }
    }
    setDecision('ajustes_enviados')
  }

  // Trava definitiva: vem do banco (`locked`) ou acabou de acontecer nesta
  // sessão (`decision === 'aprovado'`) — qualquer um dos dois substitui TODA
  // a interface pela tela de celebração, sem botões de ação. A equipe (só
  // leitura) continua vendo as lâminas.
  const temExcedente = perfil === 'fotografo' && (excedente?.excedente ?? 0) > 0
  const itensEscolhidos = ofertas.filter((o) => (escolhidos[o.id] ?? 0) > 0)
  const totalEscolhido = itensEscolhidos.reduce((soma, o) => soma + o.preco * (escolhidos[o.id] ?? 0), 0)
  if (!leituraEquipe && (locked || decision === 'aprovado')) {
    // Fotógrafo com lâminas extras e/ou adicionais: aprovado, mas o arquivo só
    // segue para a gráfica depois do fechamento — a tela diz isso e leva direto.
    const pagamentoPendente =
      perfil === 'fotografo' && (aguardandoPagamento || (decision === 'aprovado' && (temExcedente || itensEscolhidos.length > 0)))
    if (pagamentoPendente) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
            <CheckCircle2 className="h-8 w-8 text-amber-700" aria-hidden />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-[#171717]">Álbum aprovado!</h1>
          <p className="max-w-sm break-words text-sm text-[#595959]">
            Falta o fechamento no seu painel para o arquivo seguir para a gráfica
            {decision === 'aprovado' && (temExcedente || itensEscolhidos.length > 0) ? (
              <>
                {': '}
                <strong className="text-[#171717]">
                  {[
                    temExcedente && excedente
                      ? `${excedente.excedente} ${excedente.excedente === 1 ? 'lâmina extra' : 'lâminas extras'}`
                      : null,
                    ...itensEscolhidos.map((o) => `${escolhidos[o.id]}× ${o.nome}`),
                  ]
                    .filter(Boolean)
                    .join(' + ')}{' '}
                  ({formatBRL((temExcedente && excedente ? excedente.valor : 0) + totalEscolhido)})
                </strong>
              </>
            ) : null}
            .
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button variant="brand" className="min-h-[48px]" onClick={() => router.push('/dashboard/meus-albuns#laminas-extras')}>
              Ir para o fechamento
            </Button>
            <Button variant="outline" className="min-h-[44px]" onClick={() => router.push(voltarHref)}>
              Voltar para meus álbuns
            </Button>
          </div>
        </div>
      )
    }
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F5F5F5]">
          <CheckCircle2 className="h-8 w-8 text-[#171717]" aria-hidden />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-[#171717]">Álbum aprovado!</h1>
        <p className="max-w-xs text-sm text-[#595959]">
          {perfil === 'cliente' && decision === 'aprovado' && itensEscolhidos.length > 0
            ? // White label: o casal não vê cobrança — o estúdio confirma os adicionais com ele.
              `Seu álbum foi aprovado! Enviamos ao seu fotógrafo o pedido de ${itensEscolhidos
                .map((o) => `${escolhidos[o.id]}× ${o.nome}`)
                .join(' e ')} — ele confirma os detalhes com você.`
            : 'Seu álbum foi aprovado e enviado para a produção gráfica! Nenhuma alteração pode ser feita a partir de agora.'}
        </p>
        <Button variant="brand" className="min-h-[44px]" onClick={() => router.push(voltarHref)}>
          Voltar para o projeto
        </Button>
      </div>
    )
  }

  if (decision === 'ajustes_enviados') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F5F5F5]">
          <CheckCircle2 className="h-8 w-8 text-[#171717]" aria-hidden />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-[#171717]">Ajustes enviados!</h1>
        <p className="max-w-xs text-sm text-[#595959]">
          Nossa equipe vai revisar seus comentários e preparar uma nova versão da prova.
        </p>
        <Button variant="brand" className="min-h-[44px]" onClick={() => router.push(voltarHref)}>
          Voltar para o projeto
        </Button>
      </div>
    )
  }

  const pinDaLaminaAtual = pinRascunho && pinRascunho.laminaId === laminaAtual?.id ? pinRascunho : null

  const CommentsList = (
    <div className="space-y-3">
      {commentsForPage.length === 0 ? (
        <p className="text-sm text-white/50">
          {interativo
            ? 'Nenhuma orientação nesta lâmina ainda. Toque na imagem para marcar um ponto — ou arraste com o mouse para marcar uma área.'
            : 'Nenhuma orientação nesta lâmina.'}
        </p>
      ) : (
        commentsForPage.map((comment) => {
          const n = numeroDoPin.get(comment.id)
          const resolvido = !!comment.resolvido
          return (
            <div
              key={comment.id}
              className={cn(
                'rounded-xl transition-colors',
                destacado === comment.id ? 'bg-white/20 ring-1 ring-white/50' : 'bg-white/10',
                resolvido && destacado !== comment.id && 'bg-emerald-400/10',
              )}
            >
              <button
                type="button"
                onClick={() => setDestacado(n ? comment.id : null)}
                className="block w-full rounded-xl p-3 text-left hover:bg-white/5"
              >
                <p className="flex items-start gap-2 text-sm text-white">
                  {n ? (
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold text-[#171717]',
                        resolvido ? 'bg-emerald-400' : 'bg-amber-400',
                      )}
                    >
                      {n}
                    </span>
                  ) : null}
                  <span className={cn('min-w-0 whitespace-pre-line [overflow-wrap:anywhere]', resolvido && 'text-white/50 line-through decoration-white/30')}>
                    {comment.texto}
                  </span>
                </p>
                <p className="mt-1 text-xs text-white/50">
                  {comment.autor} · {formatDate(comment.data)}
                </p>
                {resolvido && !leituraEquipe ? (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-300">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Resolvido pela equipe
                  </p>
                ) : null}
              </button>
              {leituraEquipe ? (
                <div className="border-t border-white/10 px-3 py-1">
                  <button
                    type="button"
                    onClick={() => alternarResolvido(comment)}
                    disabled={alternando === comment.id}
                    aria-pressed={resolvido}
                    className={cn(
                      'flex min-h-[44px] w-full items-center gap-2 text-sm font-semibold disabled:opacity-60',
                      resolvido ? 'text-emerald-300' : 'text-white',
                    )}
                  >
                    {resolvido ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        <span className="flex-1 text-left">
                          Resolvido{comment.resolvidoEm ? ` · ${formatDate(comment.resolvidoEm)}` : ''}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-white/60">
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                          Reabrir
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-4 w-4 rounded-full border-2 border-white/60" aria-hidden />
                        Marcar como resolvido
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          )
        })
      )}
      {interativo && laminaAtual ? (
        <div className="space-y-2">
          {pinDaLaminaAtual ? (
            <p className="flex items-center justify-between gap-2 rounded-lg bg-amber-400/15 px-3 py-2 text-xs text-amber-200">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {pinDaLaminaAtual.largura ? 'Comentário na área marcada' : 'Comentário no ponto marcado'}
              </span>
              <button type="button" onClick={() => setPinRascunho(null)} className="min-h-[32px] font-semibold underline underline-offset-2">
                {pinDaLaminaAtual.largura ? 'Tirar área' : 'Tirar ponto'}
              </button>
            </p>
          ) : null}
          <div className="flex gap-2">
            <textarea
              ref={campoRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={pinDaLaminaAtual ? (pinDaLaminaAtual.largura ? 'O que ajustar nesta área?' : 'O que ajustar neste ponto?') : 'Descreva a alteração. Ex.: trocar esta foto'}
              rows={2}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
            <button
              type="button"
              onClick={addComment}
              disabled={!draft.trim()}
              aria-label="Enviar comentário"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#171717] disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : versaoAntiga ? (
        <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/50">
          Esta é uma versão anterior, somente leitura — comentários novos só podem ser feitos na versão atual.
        </p>
      ) : null}
    </div>
  )

  const indiceDaLamina = new Map(laminas.map((l, i) => [l.id, i]))
  const ListaDaVersao = (
    <div className="space-y-2">
      {comentariosDaVersao.length === 0 ? (
        <p className="text-sm text-white/50">
          {interativo
            ? 'Nenhuma orientação ainda. Abra uma lâmina e toque no ponto (ou arraste sobre a área) que precisa mudar.'
            : 'Nenhuma orientação nesta versão.'}
        </p>
      ) : (
        [...comentariosDaVersao]
          .map((c) => ({ c, indice: c.laminaId ? (indiceDaLamina.get(c.laminaId) ?? c.pageIndex) : c.pageIndex }))
          .sort((a, b) => a.indice - b.indice)
          .map(({ c, indice }) => {
            const n = numeroDoPin.get(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setMobileCommentsOpen(false)
                  abrirLamina(indice, n ? c.id : undefined)
                }}
                className={cn('block w-full rounded-xl bg-white/10 p-3 text-left hover:bg-white/15', c.resolvido && 'bg-emerald-400/10')}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                  {laminas[indice]?.ehCapa && indice === 0 ? 'Capa' : `Lâmina ${indice + 1}`}
                  {c.areaLargura ? ' · área' : n ? ' · ponto' : ''}
                </p>
                <p className="mt-1 flex items-start gap-2 text-sm text-white">
                  {n ? (
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold text-[#171717]',
                        c.resolvido ? 'bg-emerald-400' : 'bg-amber-400',
                      )}
                    >
                      {n}
                    </span>
                  ) : null}
                  <span className={cn('min-w-0 whitespace-pre-line [overflow-wrap:anywhere]', c.resolvido && 'text-white/50 line-through decoration-white/30')}>
                    {c.texto}
                  </span>
                </p>
                <p className="mt-1 text-xs text-white/50">
                  {c.autor} · {formatDate(c.data)}
                  {c.resolvido ? ' · resolvido' : ''}
                </p>
              </button>
            )
          })
      )}
    </div>
  )

  const naGaleria = vista === 'galeria' && !emComparacao && laminas.length > 0
  const laminasDaGaleria = laminas
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => !soAlteradas || l.alterada !== false)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0A] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => router.push(voltarHref)}
          aria-label="Voltar"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-medium">{projectName}</p>
          <p className="text-xs text-white/50">
            {naGaleria
              ? `${laminas.length} ${laminas.length === 1 ? 'lâmina' : 'lâminas'}${versaoParcial ? ` · ${nAlteradas} ${nAlteradas === 1 ? 'alterada' : 'alteradas'} nesta versão` : ''}`
              : totalLaminas > 0
                ? `Lâmina ${pageIndex + 1} de ${totalLaminas}${versaoParcial && laminaAtual && laminaAtual.alterada !== false && !emComparacao ? ' · alterada nesta versão' : ''}`
                : `Versão ${versaoSelecionada}`}
          </p>
        </div>
        {/* Arquivo real enviado pela equipe nesta versão (PDF, link…), quando houver. */}
        {arquivoDaVersao ? (
          <a
            href={arquivoDaVersao}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir o arquivo da versão ${versaoSelecionada}`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
          >
            <ExternalLink className="h-5 w-5" aria-hidden />
          </a>
        ) : (
          <div className="w-11" />
        )}
      </div>

      {versoesOrdenadas.length > 1 ? (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-4 py-2">
          {versoesOrdenadas.map((v) => {
            const ativa = v.numero === versaoSelecionada
            const antiga = v.numero !== versaoMaisRecente
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVersaoSelecionada(v.numero)}
                className={cn(
                  'flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                  ativa ? 'bg-white text-[#171717]' : 'bg-white/10 text-white/70 hover:bg-white/20',
                )}
              >
                Versão {v.numero}
                {leituraEquipe ? (
                  // Equipe: quanto falta resolver em cada versão, em vez do cadeado.
                  (() => {
                    const pendentes = comments.filter((c) => c.versao === v.numero && !c.resolvido).length
                    return pendentes > 0 ? (
                      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-[#171717]" aria-label={`${pendentes} pendentes`}>
                        {pendentes}
                      </span>
                    ) : null
                  })()
                ) : antiga ? (
                  <span className="flex items-center gap-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                    <Lock className="h-2.5 w-2.5" aria-hidden />
                    Somente leitura
                  </span>
                ) : null}
              </button>
            )
          })}
          {leituraEquipe && versaoAnterior ? (
            <button
              type="button"
              onClick={() => setComparando((v) => !v)}
              aria-pressed={emComparacao}
              className={cn(
                'ml-auto flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                emComparacao ? 'border-white bg-white text-[#171717]' : 'border-white/30 text-white hover:bg-white/10',
              )}
            >
              <Columns2 className="h-3.5 w-3.5" aria-hidden />
              {emComparacao ? 'Sair da comparação' : `Comparar com v${versaoAnterior.numero}`}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex min-w-0 flex-1">
          {emComparacao ? (
            <ComparadorVersoes
              antes={versaoAnterior.numero}
              depois={versaoSelecionada}
              laminaAntes={laminasAnteriores[pageIndex] ?? null}
              laminaDepois={laminas[pageIndex] ?? null}
              indice={pageIndex}
              pins={commentsForPage
                .filter((c) => c.posicaoX != null && c.posicaoY != null)
                .map((c) => ({
                  id: c.id,
                  numero: numeroDoPin.get(c.id) ?? 0,
                  x: c.posicaoX!,
                  y: c.posicaoY!,
                  resolvido: !!c.resolvido,
                  texto: c.texto,
                }))}
              destacado={destacado}
              onPin={(id) => {
                setDestacado(id)
                if (!window.matchMedia('(min-width: 1024px)').matches) setMobileCommentsOpen(true)
              }}
            />
          ) : laminas.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <ImageOff className="h-8 w-8 text-white/40" aria-hidden />
              <p className="max-w-xs text-sm text-white/60">
                Esta versão não tem lâminas para visualizar aqui.
                {arquivoDaVersao ? ' Abra o arquivo enviado pela equipe no botão acima.' : ''}
              </p>
            </div>
          ) : naGaleria ? (
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              {versaoParcial ? (
                <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
                  {(
                    [
                      [false, `Todas (${laminas.length})`],
                      [true, `Só alteradas (${nAlteradas})`],
                    ] as const
                  ).map(([valor, rotulo]) => (
                    <button
                      key={rotulo}
                      type="button"
                      aria-pressed={soAlteradas === valor}
                      onClick={() => setSoAlteradas(valor)}
                      className={cn(
                        'min-h-[36px] rounded-full px-3 text-xs font-medium transition-colors',
                        soAlteradas === valor ? 'bg-white text-[#171717]' : 'bg-white/10 text-white/70 hover:bg-white/20',
                      )}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              ) : null}
              <ul className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Lâminas da versão ${versaoSelecionada}`}>
                {laminasDaGaleria.map(({ l, i }) => {
                  const daLamina = comentariosDaLamina(l, i)
                  const pendentes = daLamina.filter((c) => !c.resolvido).length
                  const proporcao = l.largura && l.altura ? l.largura / l.altura : (proporcoes[l.id] ?? 3 / 2)
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => abrirLamina(i)}
                        className="group block w-full text-left focus:outline-none"
                        aria-label={`Abrir lâmina ${i + 1}${daLamina.length ? `, ${daLamina.length} orientações` : ''}`}
                      >
                        <span
                          className="relative block overflow-hidden rounded-lg bg-white/5 ring-white/60 transition group-hover:ring-2 group-focus-visible:ring-2"
                          style={{ aspectRatio: String(proporcao) }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- lâmina via link assinado (URL expira; next/image não se aplica). */}
                          <img
                            src={l.url}
                            alt=""
                            loading={i < 6 ? 'eager' : 'lazy'}
                            decoding="async"
                            draggable={false}
                            onLoad={(e) => {
                              const img = e.currentTarget
                              if (!l.largura && img.naturalWidth && img.naturalHeight) {
                                setProporcoes((p) => ({ ...p, [l.id]: img.naturalWidth / img.naturalHeight }))
                              }
                            }}
                            className="h-full w-full select-none object-contain"
                          />
                          {daLamina
                            .filter((c) => c.posicaoX != null && c.posicaoY != null)
                            .map((c) =>
                              c.areaLargura && c.areaAltura ? (
                                <span
                                  key={c.id}
                                  aria-hidden
                                  className={cn('absolute rounded-sm border-2', c.resolvido ? 'border-emerald-400/60' : 'border-amber-400 bg-amber-400/10')}
                                  style={{ left: `${c.posicaoX}%`, top: `${c.posicaoY}%`, width: `${c.areaLargura}%`, height: `${c.areaAltura}%` }}
                                />
                              ) : (
                                <span
                                  key={c.id}
                                  aria-hidden
                                  className={cn(
                                    'absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white',
                                    c.resolvido ? 'bg-emerald-400/70' : 'bg-amber-400',
                                  )}
                                  style={{ left: `${c.posicaoX}%`, top: `${c.posicaoY}%` }}
                                />
                              ),
                            )}
                          {versaoParcial && l.alterada !== false ? (
                            <span className="absolute right-2 top-2 rounded-full bg-sky-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0A0A0A]">
                              Alterada
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-white/80">{l.ehCapa && i === 0 ? 'Capa' : `Lâmina ${i + 1}`}</span>
                          {daLamina.length > 0 ? (
                            <span className={cn('flex items-center gap-1', pendentes > 0 ? 'text-amber-300' : 'text-emerald-300')}>
                              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                              {pendentes > 0 ? pendentes : daLamina.length}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div
              ref={carrosselRef}
              onScroll={aoRolar}
              className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-roledescription="carrossel"
              aria-label={`Lâminas da versão ${versaoSelecionada}`}
            >
              {laminas.map((lamina, i) => {
                const proporcao =
                  lamina.largura && lamina.altura ? lamina.largura / lamina.altura : (proporcoes[lamina.id] ?? 3 / 2)
                const pins = comentariosDaLamina(lamina, i).filter((c) => c.posicaoX != null && c.posicaoY != null)
                const rascunho = pinRascunho && pinRascunho.laminaId === lamina.id ? pinRascunho : null
                return (
                  <div
                    key={lamina.id}
                    className="h-full w-full shrink-0 snap-center p-4"
                    aria-roledescription="lâmina"
                    aria-label={`Lâmina ${i + 1} de ${laminas.length}`}
                  >
                    {/* Contêiner de tamanho: a lâmina cabe inteira (contain) e o
                        quadro dos pins tem exatamente o tamanho da imagem. */}
                    <div className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
                      <div
                        onClick={(e) => marcarPin(e, lamina)}
                        onPointerDown={(e) => iniciarArea(e, lamina)}
                        onPointerMove={moverArea}
                        onPointerUp={terminarArea}
                        onPointerCancel={() => {
                          arrastoRef.current = null
                          setAreaRascunho(null)
                        }}
                        className={cn('relative', interativo && 'cursor-crosshair')}
                        style={{ aspectRatio: String(proporcao), width: `min(100cqw, calc(100cqh * ${proporcao}))` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- lâmina via link assinado do Storage (next/image não se aplica: URL expira). */}
                        <img
                          src={lamina.url}
                          alt={`Lâmina ${i + 1}`}
                          loading={Math.abs(i - pageIndex) <= 1 ? 'eager' : 'lazy'}
                          decoding="async"
                          draggable={false}
                          onLoad={(e) => {
                            const img = e.currentTarget
                            if (!lamina.largura && img.naturalWidth && img.naturalHeight) {
                              setProporcoes((p) => ({ ...p, [lamina.id]: img.naturalWidth / img.naturalHeight }))
                            }
                          }}
                          className="h-full w-full select-none rounded-lg object-contain shadow-2xl"
                        />
                        {pins
                          .filter((c) => c.areaLargura && c.areaAltura)
                          .map((c) => (
                            <span
                              key={`area-${c.id}`}
                              aria-hidden
                              className={cn(
                                'pointer-events-none absolute rounded-sm border-2 transition-colors',
                                destacado === c.id
                                  ? 'border-white bg-white/15'
                                  : c.resolvido
                                    ? 'border-emerald-400/50 bg-emerald-400/5'
                                    : 'border-amber-400 bg-amber-400/10',
                              )}
                              style={{ left: `${c.posicaoX}%`, top: `${c.posicaoY}%`, width: `${c.areaLargura}%`, height: `${c.areaAltura}%` }}
                            />
                          ))}
                        {[areaRascunho, rascunho?.largura ? rascunho : null]
                          .filter((a): a is PinRascunho => !!a && a.laminaId === lamina.id && !!a.largura)
                          .map((a, k) => (
                            <span
                              key={`rascunho-area-${k}`}
                              aria-hidden
                              className="pointer-events-none absolute rounded-sm border-2 border-dashed border-white bg-amber-400/20"
                              style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.largura}%`, height: `${a.altura}%` }}
                            />
                          ))}
                        {pins.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDestacado(c.id)
                              if (!window.matchMedia('(min-width: 1024px)').matches) setMobileCommentsOpen(true)
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            aria-label={`Comentário ${numeroDoPin.get(c.id)}${c.areaLargura ? ' (área)' : ''}${c.resolvido ? ' (resolvido)' : ''}: ${c.texto}`}
                            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                            style={{ left: `${c.posicaoX}%`, top: `${c.posicaoY}%` }}
                          >
                            <span
                              className={cn(
                                'relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-[#171717] shadow-lg transition-transform',
                                destacado === c.id ? 'scale-125 bg-white' : c.resolvido ? 'bg-emerald-400/60 opacity-70' : 'bg-amber-400',
                              )}
                            >
                              {numeroDoPin.get(c.id)}
                              {c.resolvido ? (
                                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-1 ring-white">
                                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />
                                </span>
                              ) : null}
                            </span>
                          </button>
                        ))}
                        {rascunho && !rascunho.largura ? (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-pulse items-center justify-center rounded-full border-2 border-dashed border-white bg-amber-400/80 shadow-lg"
                            style={{ left: `${rascunho.x}%`, top: `${rascunho.y}%` }}
                          >
                            <MapPin className="h-3.5 w-3.5 text-[#171717]" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!naGaleria && !emComparacao && laminas.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setPinRascunho(null)
                setVista('galeria')
              }}
              className="absolute left-3 top-3 z-10 flex min-h-[40px] items-center gap-1.5 rounded-full bg-black/60 px-3 text-xs font-semibold text-white hover:bg-black/80"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              Galeria
            </button>
          ) : null}
          {!naGaleria && totalLaminas > 1 && pageIndex > 0 ? (
            <button
              type="button"
              onClick={() => irPara(pageIndex - 1)}
              aria-label="Lâmina anterior"
              className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 sm:flex"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
          ) : null}
          {!naGaleria && totalLaminas > 1 && pageIndex < totalLaminas - 1 ? (
            <button
              type="button"
              onClick={() => irPara(pageIndex + 1)}
              aria-label="Próxima lâmina"
              className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 sm:flex"
            >
              <ChevronRight className="h-6 w-6" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="hidden w-80 shrink-0 flex-col border-l border-white/10 p-4 lg:flex">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">
            {emComparacao
              ? `Ajustes pedidos na versão ${versaoAnterior.numero}`
              : naGaleria
                ? `Orientações de alteração${comentariosDaVersao.length ? ` (${comentariosDaVersao.length})` : ''}`
                : `Orientações · ${laminaAtual?.ehCapa && pageIndex === 0 ? 'capa' : `lâmina ${pageIndex + 1}`}`}
          </p>
          <div className="flex-1 overflow-y-auto">{naGaleria ? ListaDaVersao : CommentsList}</div>
        </div>
      </div>

      {/* Comentários ficam nesta barra (e não flutuando sobre a lâmina) para
          nunca cobrir parte da página em telas pequenas ou lâminas verticais. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-t border-white/10 px-2">
        <p className="truncate pl-2 text-xs text-white/40">
          {interativo && laminas.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              {naGaleria ? <LayoutGrid className="h-3 w-3" aria-hidden /> : <MapPin className="h-3 w-3" aria-hidden />}
              {naGaleria ? 'Abra uma lâmina para orientar' : 'Toque: ponto · arraste: área'}
            </span>
          ) : leituraEquipe ? (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" aria-hidden />
              Visão da equipe
            </span>
          ) : null}
        </p>
        <div className="flex items-center justify-center">
          {naGaleria ? null : totalLaminas <= 12 ? (
            Array.from({ length: totalLaminas }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => irPara(i)}
                aria-label={`Ir para a lâmina ${i + 1}`}
                aria-current={i === pageIndex ? 'true' : undefined}
                className="flex h-11 min-w-[28px] items-center justify-center sm:min-w-[44px]"
              >
                <span className={cn('h-1.5 rounded-full transition-all', i === pageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30')} />
              </button>
            ))
          ) : (
            // Muitas lâminas: contador no lugar das bolinhas (não cabem na barra).
            <span className="flex h-11 items-center px-2 text-xs tabular-nums text-white/70">
              {pageIndex + 1} / {totalLaminas}
            </span>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setMobileCommentsOpen(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white hover:bg-white/10 lg:hidden"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Orientações</span>
            {(naGaleria ? comentariosDaVersao : commentsForPage).length > 0 ? (
              <span>({(naGaleria ? comentariosDaVersao : commentsForPage).length})</span>
            ) : null}
          </button>
        </div>
      </div>

      {erroAcao ? (
        <p role="alert" className="flex items-center justify-center gap-2 px-4 pt-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {erroAcao}
        </p>
      ) : null}

      {leituraEquipe ? (
        <div className="flex flex-col items-center justify-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm sm:flex-row sm:gap-4">
          <div aria-live="polite" className="flex items-center justify-center gap-2">
            {comentariosDaVersao.length === 0 ? (
              <span className="flex items-center gap-2 text-white/50">
                <Eye className="h-4 w-4 shrink-0" aria-hidden />
                Nenhum apontamento nesta versão.
              </span>
            ) : pendentesDaVersao === 0 ? (
              <span className="flex items-center gap-2 font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                {comentariosDaVersao.length === 1
                  ? `O apontamento da Versão ${versaoSelecionada} foi resolvido`
                  : `Todos os ${comentariosDaVersao.length} apontamentos da Versão ${versaoSelecionada} resolvidos`}{' '}
                — pronta para a próxima versão.
              </span>
            ) : (
              <span className="flex items-center gap-2 text-white/80">
                <MapPin className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                <span>
                  <strong className="text-white">{pendentesDaVersao}</strong> de {comentariosDaVersao.length}{' '}
                  {comentariosDaVersao.length === 1 ? 'apontamento pendente' : 'apontamentos pendentes'} na Versão {versaoSelecionada}
                </span>
              </span>
            )}
          </div>
          {finalizarHref && !versaoAntiga ? (
            <Link
              href={finalizarHref}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#171717] hover:bg-white/90"
              title={
                pendentesDaVersao > 0
                  ? `Os ${pendentesDaVersao} apontamentos pendentes contam como aplicados ao subir a nova versão.`
                  : undefined
              }
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Finalizar atualizações · subir versão {versaoMaisRecente + 1}
            </Link>
          ) : null}
        </div>
      ) : versaoAntiga ? (
        <div className="flex items-center justify-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-white/50">
          <Lock className="h-4 w-4" aria-hidden />
          Versão antiga — vá para a Versão {versaoMaisRecente} para aprovar ou pedir ajustes.
        </div>
      ) : !podeDecidir ? (
        <div className="flex items-center justify-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-white/50">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          A equipe está preparando a próxima versão. Você será avisado quando ela estiver disponível.
        </div>
      ) : (
        <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Transparência antes do clique: lâminas da versão × franquia do plano. */}
          {perfil === 'fotografo' && excedente && excedente.inclusas !== null ? (
            <p
              className={cn(
                'flex items-start justify-center gap-2 text-center text-xs',
                temExcedente ? 'text-amber-300' : 'text-white/60',
              )}
            >
              <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {excedente.laminas} {excedente.laminas === 1 ? 'lâmina' : 'lâminas'}
                {excedente.temCapa ? ' + capa' : ''} · plano cobre {excedente.inclusas}
                {temExcedente
                  ? ` · ${excedente.excedente} extra${excedente.excedente === 1 ? '' : 's'} = ${formatBRL(excedente.valor)} ao aprovar`
                  : ' · sem custo extra'}
              </span>
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="min-h-[52px] whitespace-normal border-white/30 bg-transparent text-white hover:bg-white/10"
              onClick={() => setAdjustModalOpen(true)}
            >
              Solicitar ajustes
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-[52px] whitespace-normal bg-white text-[#171717] hover:bg-white/90"
              onClick={() => setApproveModalOpen(true)}
            >
              Aprovar álbum
            </Button>
          </div>
        </div>
      )}

      {/* Bottom sheet de comentários no mobile — no desktop os comentários já ficam sempre visíveis na lateral. */}
      {mobileCommentsOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end lg:hidden" onClick={() => setMobileCommentsOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={naGaleria ? 'Orientações de alteração' : 'Orientações desta lâmina'}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => {
              // Teclado do iOS cobre a base da tela: traz o campo para a área visível.
              const alvo = e.target
              if (alvo instanceof HTMLTextAreaElement) window.setTimeout(() => alvo.scrollIntoView({ block: 'center', behavior: rolagemSuave() }), 300)
            }}
            className="relative max-h-[75dvh] w-full overflow-y-auto overflow-x-hidden overscroll-contain break-words rounded-t-2xl bg-[#171717] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{naGaleria ? 'Orientações de alteração' : 'Orientações desta lâmina'}</p>
              <button
                type="button"
                onClick={() => setMobileCommentsOpen(false)}
                aria-label="Fechar"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {naGaleria ? ListaDaVersao : CommentsList}
          </div>
        </div>
      ) : null}

      <Modal open={approveModalOpen} onClose={() => setApproveModalOpen(false)} title="Tem certeza?">
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl bg-amber-50 p-3 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm">
              {temExcedente
                ? 'Após aprovar, o álbum não poderá mais ser alterado. Ele segue para a gráfica assim que as lâminas extras forem pagas.'
                : 'Após aprovar, o projeto vai para a gráfica e não poderá ser alterado.'}
            </p>
          </div>
          {temExcedente && excedente ? (
            <div className="rounded-xl border border-[#EAEAEA] p-3 text-sm">
              <p className="font-semibold">Lâminas extras nesta versão</p>
              <dl className="mt-2 space-y-1">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#595959]">Lâminas da versão {excedente.versao}{excedente.temCapa ? ' (capa não conta)' : ''}</dt>
                  <dd className="shrink-0 tabular-nums">{excedente.laminas}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#595959]">Incluídas no seu plano</dt>
                  <dd className="shrink-0 tabular-nums">{excedente.inclusas}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#595959]">
                    {excedente.excedente} {excedente.excedente === 1 ? 'extra' : 'extras'} × {formatBRL(excedente.preco)}
                  </dt>
                  <dd className="shrink-0 tabular-nums">{formatBRL(excedente.valor)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-[#EAEAEA] pt-2 font-semibold">
                  <dt>Cobrado do seu estúdio</dt>
                  <dd className="shrink-0 tabular-nums">{formatBRL(excedente.valor)}</dd>
                </div>
              </dl>
            </div>
          ) : null}
          <div className={MODAL_ACOES}>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setApproveModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="brand" className="min-h-[44px]" onClick={confirmarAprovacao} disabled={enviando}>
              <Check className="h-4 w-4" aria-hidden />
              {enviando ? 'Enviando…' : temExcedente ? 'Aprovar e seguir para o pagamento' : 'Sim, aprovar álbum'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upsell (0026): o momento de maior emoção — oferta elegante, nada
          pré-marcado e uma saída tão visível quanto a compra. */}
      <Modal
        open={ofertaAberta}
        onClose={() => setOfertaAberta(false)}
        title={perfil === 'fotografo' ? 'Quer incluir adicionais?' : 'Um presente para quem você ama?'}
        className="sm:max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#595959]">
            {perfil === 'fotografo'
              ? 'Os adicionais seguem para a gráfica junto com o álbum. Valores de custo para o seu estúdio.'
              : 'Leve estas memórias para mais perto da família. Seu fotógrafo confirma os detalhes com você.'}
          </p>
          <ul className="space-y-3">
            {ofertas.map((o) => {
              const qtd = escolhidos[o.id] ?? 0
              const definir = (n: number) => setEscolhidos((e) => ({ ...e, [o.id]: Math.max(0, Math.min(5, n)) }))
              return (
                <li
                  key={o.id}
                  className={cn(
                    'flex gap-3 rounded-2xl border p-3 transition-colors',
                    qtd > 0 ? 'border-[#171717] bg-[#FAFAFA]' : 'border-[#EAEAEA]',
                  )}
                >
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#F5F0EA] to-[#E8E1D8]">
                    {o.imagemUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- imagem do catálogo (URL pública).
                      <img src={o.imagemUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Gift className="h-7 w-7 text-[#8A7B6A]" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold leading-snug">{o.nome}</p>
                    {o.descricao ? <p className="mt-0.5 text-xs text-[#595959]">{o.descricao}</p> : null}
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {formatBRL(o.preco)}
                      {perfil === 'fotografo' ? (
                        <span className="ml-1 text-xs font-normal text-[#595959]">
                          · sugerido ao cliente {formatBRL(o.precoRevenda)}
                        </span>
                      ) : null}
                    </p>
                    {/* Controles abaixo do preço: no celular o texto não fica espremido. */}
                    <div className="mt-2">
                    {qtd === 0 ? (
                      <button
                        type="button"
                        onClick={() => definir(1)}
                        className="min-h-[44px] rounded-xl border border-[#171717] px-3 text-sm font-semibold hover:bg-[#171717] hover:text-white"
                      >
                        Adicionar
                      </button>
                    ) : (
                      <div className="flex items-center gap-1" role="group" aria-label={`Quantidade de ${o.nome}`}>
                        <button
                          type="button"
                          onClick={() => definir(qtd - 1)}
                          aria-label="Menos"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border hover:bg-[#F5F5F5]"
                        >
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">
                          {qtd}
                        </span>
                        <button
                          type="button"
                          onClick={() => definir(qtd + 1)}
                          aria-label="Mais"
                          disabled={qtd >= 5}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border hover:bg-[#F5F5F5] disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className={MODAL_ACOES}>
            <Button variant="outline" onClick={() => void confirmApprove([])} disabled={enviando}>
              Não, obrigado — aprovar sem adicionais
            </Button>
            {itensEscolhidos.length > 0 ? (
              <Button
                variant="brand"
                disabled={enviando}
                onClick={() =>
                  void confirmApprove(itensEscolhidos.map((o) => ({ adicionalId: o.id, quantidade: escolhidos[o.id] ?? 1 })))
                }
              >
                <Check className="h-4 w-4" aria-hidden />
                {enviando ? 'Enviando…' : `Aprovar com adicionais · ${formatBRL(totalEscolhido)}`}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal open={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title="Resumo dos seus comentários">
        <div className="space-y-4">
          {comments.filter((c) => c.versao === versaoMaisRecente).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você ainda não deixou nenhum comentário. Toque nas lâminas para marcar os pontos antes de enviar.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {comments
                .filter((c) => c.versao === versaoMaisRecente)
                .map((comment) => (
                  <li key={comment.id} className="rounded-xl border p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Lâmina {comment.pageIndex + 1}
                      {numeroDoPin.get(comment.id) ? ` · pin ${numeroDoPin.get(comment.id)}` : ''}
                    </p>
                    <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">{comment.texto}</p>
                  </li>
                ))}
            </ul>
          )}
          <div className={MODAL_ACOES}>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setAdjustModalOpen(false)}>
              Continuar revisando
            </Button>
            <Button
              variant="brand"
              className="min-h-[44px]"
              onClick={confirmAdjustments}
              disabled={comments.filter((c) => c.versao === versaoMaisRecente).length === 0 || enviando}
            >
              <Send className="h-4 w-4" aria-hidden />
              {enviando ? 'Enviando…' : 'Enviar solicitações para a equipe'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
