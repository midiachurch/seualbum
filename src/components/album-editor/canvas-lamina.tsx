'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Ellipse, Group, Image as KImage, Layer, Line, Path, Rect, Stage, Text as KText, Transformer } from 'react-konva'
import type Konva from 'konva'
import { MIME_FOTO, type FotoNoCanvas, type Selecao } from '@/components/album-editor/tipos'
import { aplicarAjustes } from '@/lib/album/ajustes'
import { familiaDe } from '@/lib/album/fontes'
import { tamanhoEmMm } from '@/lib/album/texto'
import { ornamentoPorId } from '@/lib/album/ornamentos'
import { LADO_TEXTURA_MM, ladrilhoDeTextura } from '@/lib/album/texturas'
import { aplicarDivisoria, encontrarDivisorias } from '@/lib/album/divisorias'
import {
  ajustesNeutros,
  dpiBaixo,
  moverRecorte,
  posicaoDaFoto,
  type FormaDoc,
  type Geometria,
  type LaminaDoc,
  type Quadro,
  type TextoDoc,
} from '@/lib/album/documento'

/**
 * Canvas de uma lâmina (react-konva). Tudo dentro do grupo `mundo` está em
 * milímetros — o grupo é escalado (ajuste à tela × zoom) e o palco pode ser
 * arrastado quando há zoom. Cada elemento gira em torno do próprio centro.
 * Mostra a PRÉVIA leve de cada foto; proporção e DPI vêm do original.
 * Shift+clique seleciona vários (movem juntos); soltar uma foto sobre outra
 * troca as duas. Guias: sangria (vermelho), corte, área segura (azul), dobra.
 * Só roda no navegador (o editor carrega este arquivo com `ssr: false`).
 */

const SNAP_MM = 2.5
const PADDING_PX = 28
const MIN_MM = 5
const ZOOM_MIN = 0.25
const ZOOM_MAX = 8

const cacheDeImagens = new Map<string, HTMLImageElement>()

function useImagem(url: string | null, onCarregada?: (img: HTMLImageElement) => void) {
  const [img, setImg] = useState<HTMLImageElement | null>(() => (url ? (cacheDeImagens.get(url) ?? null) : null))
  const aoCarregar = useRef(onCarregada)
  aoCarregar.current = onCarregada
  useEffect(() => {
    if (!url) {
      setImg(null)
      return
    }
    const pronta = cacheDeImagens.get(url)
    if (pronta?.complete && pronta.naturalWidth) {
      setImg(pronta)
      aoCarregar.current?.(pronta)
      return
    }
    const nova = pronta ?? new Image()
    if (!url.startsWith('blob:')) nova.crossOrigin = 'anonymous'
    const ok = () => {
      setImg(nova)
      aoCarregar.current?.(nova)
    }
    nova.addEventListener('load', ok)
    if (!pronta) {
      nova.src = url
      cacheDeImagens.set(url, nova)
    }
    return () => nova.removeEventListener('load', ok)
  }, [url])
  return img
}

type Comum = {
  escala: number
  somenteLeitura: boolean
  bloqueado: boolean
  onSelecionar: (aditivo: boolean) => void
  onArrastoInicio: (no: Konva.Node) => void
  onArrastando: (no: Konva.Node, w: number, h: number) => void
  onArrastoFim: (no: Konva.Node) => boolean
  registrarNo: (no: Konva.Node | null) => void
}

/** Converte o fim de uma transformação (nó centrado) de volta para x/y/w/h/rotação. */
function fimDeTransformacao(no: Konva.Node, w: number, h: number, redimensionaAltura = true) {
  const nw = Math.max(MIN_MM, w * no.scaleX())
  const nh = redimensionaAltura ? Math.max(0.1, h * no.scaleY()) : h
  no.scaleX(1)
  no.scaleY(1)
  return { x: no.x() - nw / 2, y: no.y() - nh / 2, w: nw, ...(redimensionaAltura ? { h: nh } : {}), rotacao: Math.round(no.rotation() * 10) / 10 }
}

function eventosComuns(c: Comum, w: number, h: number, mover: (x: number, y: number) => void) {
  const arrastavel = !c.somenteLeitura && !c.bloqueado
  return {
    draggable: arrastavel,
    listening: !c.bloqueado,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => c.onSelecionar(e.evt.shiftKey),
    onTap: () => c.onSelecionar(false),
    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target === e.currentTarget) c.onArrastoInicio(e.currentTarget)
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target === e.currentTarget) c.onArrastando(e.currentTarget, w, h)
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target !== e.currentTarget) return
      if (c.onArrastoFim(e.currentTarget)) return
      mover(e.target.x() - w / 2, e.target.y() - h / 2)
    },
  }
}

function QuadroNoCanvas({
  quadro: q,
  foto,
  fundo,
  recortando,
  onAlterar,
  onDimensoes,
  ...c
}: Comum & {
  quadro: Quadro
  foto: (FotoNoCanvas & { id: string }) | null
  fundo: string
  recortando: boolean
  onAlterar: (patch: Partial<Quadro>) => void
  onDimensoes: (fotoId: string, w: number, h: number) => void
}) {
  // A tela usa a prévia; as dimensões do ORIGINAL decidem proporção e DPI.
  const urlTela = foto ? (foto.urlPreview ?? foto.url) : null
  const img = useImagem(urlTela, (i) => {
    if (foto && !foto.urlPreview && (foto.largura !== i.naturalWidth || foto.altura !== i.naturalHeight)) onDimensoes(foto.id, i.naturalWidth, i.naturalHeight)
  })
  const imagemRef = useRef<Konva.Image>(null)
  const imgW = foto?.largura ?? img?.naturalWidth ?? null
  const imgH = foto?.altura ?? img?.naturalHeight ?? null
  const pos = img && imgW && imgH ? posicaoDaFoto(q, imgW, imgH) : null
  const alerta = dpiBaixo(q, imgW, imgH)
  const traco = 1 / c.escala
  const xImg = pos ? (q.espelharH ? q.w - pos.x : pos.x) : 0
  const yImg = pos ? (q.espelharV ? q.h - pos.y : pos.y) : 0

  // Ajustes de cor: o Konva só filtra nós em cache — refaz quando muda algo que aparece.
  const ajustes = q.ajustes
  const chave = `${JSON.stringify(ajustes)}|${pos?.w}|${pos?.h}|${c.escala}|${img?.src}`
  useEffect(() => {
    const no = imagemRef.current
    if (!no) return
    if (ajustesNeutros(ajustes)) {
      no.clearCache()
      no.filters([])
    } else {
      no.filters([(dados: ImageData) => aplicarAjustes(dados, ajustes)])
      no.cache({ pixelRatio: Math.min(2, window.devicePixelRatio || 1) })
    }
    no.getLayer()?.batchDraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  if (q.oculto) return null
  return (
    <Group
      ref={c.registrarNo}
      x={q.x + q.w / 2}
      y={q.y + q.h / 2}
      offsetX={q.w / 2}
      offsetY={q.h / 2}
      rotation={q.rotacao}
      opacity={q.opacidade}
      {...eventosComuns({ ...c, somenteLeitura: c.somenteLeitura || recortando }, q.w, q.h, (x, y) => onAlterar({ x, y }))}
      onTransformEnd={(e) => onAlterar(fimDeTransformacao(e.currentTarget, q.w, q.h))}
    >
      {q.sombra ? <Rect width={q.w} height={q.h} fill={fundo} shadowColor="#000" shadowBlur={3} shadowOpacity={0.35} shadowOffsetY={1.2} listening={false} /> : null}
      {recortando && pos && img ? (
        // Recortando: a foto inteira aparece translúcida para mostrar o que sobra fora do quadro.
        <KImage image={img} x={xImg} y={yImg} width={pos.w} height={pos.h} scaleX={q.espelharH ? -1 : 1} scaleY={q.espelharV ? -1 : 1} opacity={0.3} listening={false} />
      ) : null}
      <Group clipFunc={(ctx) => ctx.rect(0, 0, q.w, q.h)}>
        {pos && img ? (
          <KImage
            ref={imagemRef}
            image={img}
            x={xImg}
            y={yImg}
            width={pos.w}
            height={pos.h}
            scaleX={q.espelharH ? -1 : 1}
            scaleY={q.espelharV ? -1 : 1}
            draggable={recortando && !c.somenteLeitura}
            onDragEnd={(e) => {
              if (!imgW || !imgH) return
              const recorte = moverRecorte(q, e.target.x() - xImg, e.target.y() - yImg, imgW, imgH)
              e.target.position({ x: xImg, y: yImg })
              onAlterar({ recorte })
            }}
          />
        ) : (
          <>
            <Rect width={q.w} height={q.h} fill="#ECECEC" />
            <KText
              width={q.w}
              height={q.h}
              align="center"
              verticalAlign="middle"
              text={foto ? 'Carregando…' : 'Arraste uma foto'}
              fontSize={12 / c.escala}
              fill="#8A8A8A"
              listening={false}
            />
          </>
        )}
        {q.borda ? (
          <Rect
            x={q.borda.espessura / 2}
            y={q.borda.espessura / 2}
            width={q.w - q.borda.espessura}
            height={q.h - q.borda.espessura}
            stroke={q.borda.cor}
            strokeWidth={q.borda.espessura}
            listening={false}
          />
        ) : null}
      </Group>
      {alerta ? <Rect width={q.w} height={q.h} stroke="#D97706" strokeWidth={3 * traco} dash={[6 * traco, 4 * traco]} listening={false} /> : null}
      {!foto ? <Rect width={q.w} height={q.h} stroke="#9A9A9A" strokeWidth={traco} dash={[4 * traco, 4 * traco]} listening={false} /> : null}
      {recortando ? <Rect width={q.w} height={q.h} stroke="#2563EB" strokeWidth={2 * traco} listening={false} /> : null}
    </Group>
  )
}

function FormaNoCanvas({ forma: f, onAlterar, ...c }: Comum & { forma: FormaDoc; onAlterar: (patch: Partial<FormaDoc>) => void }) {
  if (f.oculto) return null
  const traco = f.espessura
  const ornamento = f.forma === 'ornamento' ? ornamentoPorId(f.ornamento) : null
  return (
    <Group
      ref={c.registrarNo}
      x={f.x + f.w / 2}
      y={f.y + f.h / 2}
      offsetX={f.w / 2}
      offsetY={f.h / 2}
      rotation={f.rotacao}
      opacity={f.opacidade}
      {...eventosComuns(c, f.w, f.h, (x, y) => onAlterar({ x, y }))}
      onTransformEnd={(e) => onAlterar(fimDeTransformacao(e.currentTarget, f.w, f.h, f.forma !== 'linha'))}
    >
      {ornamento ? (
        <>
          <Rect width={f.w} height={f.h} fill="transparent" />
          <Path
            data={ornamento.d}
            scaleX={f.w / 100}
            scaleY={f.h / 100}
            fill={ornamento.preenchido ? (f.preenchimento ?? undefined) : undefined}
            stroke={f.contorno ?? undefined}
            strokeWidth={(traco * 100) / Math.max(f.w, f.h)}
          />
        </>
      ) : f.forma === 'elipse' ? (
        <Ellipse x={f.w / 2} y={f.h / 2} radiusX={f.w / 2} radiusY={f.h / 2} fill={f.preenchimento ?? undefined} stroke={f.contorno ?? undefined} strokeWidth={traco} />
      ) : f.forma === 'linha' ? (
        <>
          {/* Área de clique maior que a linha fina. */}
          <Rect y={f.h / 2 - 3 / c.escala} width={f.w} height={6 / c.escala} fill="transparent" />
          <Line points={[0, f.h / 2, f.w, f.h / 2]} stroke={f.contorno ?? '#171717'} strokeWidth={traco} />
        </>
      ) : (
        <Rect width={f.w} height={f.h} fill={f.preenchimento ?? undefined} stroke={f.contorno ?? undefined} strokeWidth={traco} />
      )}
    </Group>
  )
}

function TextoNoCanvas({ texto: t, onAlterar, ...c }: Comum & { texto: TextoDoc; onAlterar: (patch: Partial<TextoDoc>) => void }) {
  const ref = useRef<Konva.Text | null>(null)
  const [altura, setAltura] = useState(10)
  const tamanho = tamanhoEmMm(t)
  useLayoutEffect(() => {
    if (ref.current) setAltura(ref.current.height())
  }, [t, tamanho])
  // Fontes da web chegam depois: redesenha quando carregarem.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    let vivo = true
    void document.fonts.ready.then(() => {
      if (!vivo || !ref.current) return
      ref.current.getLayer()?.batchDraw()
      setAltura(ref.current.height())
    })
    return () => {
      vivo = false
    }
  }, [t.fonte])
  if (t.oculto) return null
  return (
    <KText
      ref={(no) => {
        ref.current = no
        c.registrarNo(no)
      }}
      x={t.x + t.w / 2}
      y={t.y + altura / 2}
      offsetX={t.w / 2}
      offsetY={altura / 2}
      width={t.w}
      rotation={t.rotacao}
      opacity={t.opacidade}
      text={t.texto || ' '}
      fontFamily={familiaDe(t.fonte)}
      fontSize={tamanho}
      fontStyle={`${t.italico ? 'italic ' : ''}${t.peso}`}
      fill={t.cor}
      align={t.alinhamento}
      lineHeight={t.entreLinhas}
      letterSpacing={(t.entreLetras / 1000) * tamanho}
      {...eventosComuns(c, t.w, altura, (x, y) => onAlterar({ x, y }))}
      onTransformEnd={(e) => {
        const r = fimDeTransformacao(e.currentTarget, t.w, altura, false)
        onAlterar({ x: r.x, y: r.y, w: r.w, rotacao: r.rotacao })
      }}
    />
  )
}

function FundoImagem({ url, opacidade, g }: { url: string; opacidade: number; g: Geometria }) {
  const img = useImagem(url)
  if (!img) return null
  const s = g.sangria
  const total = { w: g.laminaW + 2 * s, h: g.laminaH + 2 * s, recorte: { zoom: 1, cx: 0.5, cy: 0.5 } }
  const p = posicaoDaFoto(total, img.naturalWidth, img.naturalHeight)
  return (
    <Group x={-s} y={-s} clipFunc={(ctx) => ctx.rect(0, 0, total.w, total.h)} listening={false}>
      <KImage image={img} x={p.x} y={p.y} width={p.w} height={p.h} opacity={opacidade} />
    </Group>
  )
}

export function CanvasLamina({
  geometria: g,
  lamina,
  fotos,
  selecao,
  selecionados,
  recortando,
  mostrarGuias,
  zoom,
  somenteLeitura,
  onZoom,
  onSelecionar,
  onAlterarQuadro,
  onAlterarTexto,
  onAlterarForma,
  onMoverVarios,
  onAjustarQuadros,
  onTrocarFotos,
  onSoltarFoto,
  onDimensoes,
}: {
  geometria: Geometria
  lamina: LaminaDoc
  fotos: Map<string, FotoNoCanvas>
  selecao: Selecao | null
  /** Seleção múltipla (inclui a principal). */
  selecionados: Selecao[]
  recortando: boolean
  mostrarGuias: boolean
  /** 1 = lâmina inteira na tela. */
  zoom: number
  somenteLeitura: boolean
  onZoom: (z: number) => void
  onSelecionar: (s: Selecao | null, aditivo?: boolean) => void
  onAlterarQuadro: (id: string, patch: Partial<Quadro>) => void
  onAlterarTexto: (id: string, patch: Partial<TextoDoc>) => void
  onAlterarForma: (id: string, patch: Partial<FormaDoc>) => void
  onMoverVarios: (deslocamentos: { sel: Selecao; dx: number; dy: number }[]) => void
  /** Divisória arrastada: vários quadros mudam juntos (um passo de desfazer). */
  onAjustarQuadros: (patches: { id: string; patch: Partial<Quadro> }[]) => void
  onTrocarFotos: (a: string, b: string) => void
  onSoltarFoto: (fotoId: string, xMm: number, yMm: number, quadroAlvo: string | null) => void
  onDimensoes: (fotoId: string, w: number, h: number) => void
}) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const nos = useRef(new Map<string, Konva.Node>())
  const inicioArrasto = useRef<Map<string, { x: number; y: number }> | null>(null)
  const [tamanho, setTamanho] = useState({ w: 0, h: 0 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [linhasSnap, setLinhasSnap] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const [soltando, setSoltando] = useState(false)
  const [alvoTroca, setAlvoTroca] = useState<string | null>(null)
  // Prévia ao vivo da divisória sendo arrastada (o commit é no fim do arraste).
  const [previaDivisoria, setPreviaDivisoria] = useState<Map<string, Partial<Quadro>> | null>(null)
  const quadrosNaTela = previaDivisoria
    ? lamina.quadros.map((q) => (previaDivisoria.has(q.id) ? { ...q, ...previaDivisoria.get(q.id) } : q))
    : lamina.quadros

  useLayoutEffect(() => {
    const el = caixaRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setTamanho({ w: e.contentRect.width, h: e.contentRect.height }))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Zoom de volta ao "caber na tela": recentraliza.
  const [zoomAnterior, setZoomAnterior] = useState(zoom)
  if (zoom !== zoomAnterior) {
    setZoomAnterior(zoom)
    if (zoom === 1) setPan({ x: 0, y: 0 })
  }

  const s = g.sangria
  const totalW = g.laminaW + 2 * s
  const totalH = g.laminaH + 2 * s
  const ajuste = tamanho.w > 0 ? Math.max(0.05, Math.min((tamanho.w - 2 * PADDING_PX) / totalW, (tamanho.h - 2 * PADDING_PX) / totalH)) : 1
  const escala = ajuste * zoom
  const origemX = (tamanho.w - totalW * escala) / 2 + s * escala
  const origemY = (tamanho.h - totalH * escala) / 2 + s * escala
  const traco = 1 / escala

  const bloqueados = useMemo(
    () => new Set([...lamina.quadros, ...lamina.textos, ...lamina.formas].filter((e) => e.bloqueado || e.oculto).map((e) => e.id)),
    [lamina],
  )

  // Transformer nos elementos selecionados (fora do modo recorte; bloqueados não).
  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    const alvos = recortando || somenteLeitura ? [] : selecionados.filter((s) => !bloqueados.has(s.id)).map((s) => nos.current.get(s.id)).filter((n): n is Konva.Node => Boolean(n))
    tr.nodes(alvos)
    const so = selecionados.length === 1 ? selecionados[0] : null
    const linha = so?.tipo === 'forma' && lamina.formas.find((f) => f.id === so.id)?.forma === 'linha'
    tr.enabledAnchors(
      so?.tipo === 'texto' || linha
        ? ['middle-left', 'middle-right']
        : ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right'],
    )
    tr.getLayer()?.batchDraw()
  }, [selecionados, recortando, lamina, somenteLeitura, bloqueados])

  // Linhas onde os elementos "grudam": bordas, dobra, área segura, sangria e bordas/centros dos outros.
  const alvosSnap = useMemo(() => {
    const v = [-s, 0, g.margem, g.paginaW / 2, g.paginaW - g.margem, g.paginaW, g.paginaW + g.margem, g.paginaW * 1.5, g.laminaW - g.margem, g.laminaW, g.laminaW + s]
    const h = [-s, 0, g.margem, g.laminaH / 2, g.laminaH - g.margem, g.laminaH, g.laminaH + s]
    return { v, h }
  }, [g, s])

  const selecionadoIds = new Set(selecionados.map((x) => x.id))

  function aoIniciarArrasto(id: string) {
    // Vários selecionados: guarda onde cada um estava para moverem juntos.
    if (!selecionadoIds.has(id) || selecionados.length < 2) {
      inicioArrasto.current = null
      return
    }
    const mapa = new Map<string, { x: number; y: number }>()
    for (const sel of selecionados) {
      const no = nos.current.get(sel.id)
      if (no) mapa.set(sel.id, { x: no.x(), y: no.y() })
    }
    inicioArrasto.current = mapa
  }

  function aoArrastar(id: string, no: Konva.Node, w: number, h: number) {
    const grupo = inicioArrasto.current
    if (grupo) {
      const ini = grupo.get(id)
      if (!ini) return
      const dx = no.x() - ini.x
      const dy = no.y() - ini.y
      for (const [outro, pos] of grupo) if (outro !== id) nos.current.get(outro)?.position({ x: pos.x + dx, y: pos.y + dy })
      return
    }
    // Arrastando uma foto: marca o quadro sob o ponteiro (soltar ali troca as fotos).
    const quadro = lamina.quadros.find((q) => q.id === id)
    if (quadro?.fotoId) {
      const p = no.getStage()?.getPointerPosition()
      if (p) {
        const mm = { x: (p.x - pan.x - origemX) / escala, y: (p.y - pan.y - origemY) / escala }
        const sob = lamina.quadros.find((q) => q.id !== id && !q.oculto && mm.x >= q.x && mm.x <= q.x + q.w && mm.y >= q.y && mm.y <= q.y + q.h)
        setAlvoTroca(sob?.id ?? null)
        if (sob) return
      }
    }
    if (no.rotation()) return // encaixe só sem rotação
    const limiar = Math.max(SNAP_MM, 6 / escala)
    const v = [...alvosSnap.v]
    const hs = [...alvosSnap.h]
    for (const o of [...lamina.quadros, ...lamina.formas]) {
      if (o.id === id || o.oculto) continue
      v.push(o.x, o.x + o.w / 2, o.x + o.w)
      hs.push(o.y, o.y + o.h / 2, o.y + o.h)
    }
    const ativasV: number[] = []
    const ativasH: number[] = []
    let esq = no.x() - w / 2
    let topo = no.y() - h / 2
    for (const borda of [0, w / 2, w]) {
      const alvo = v.find((t) => Math.abs(esq + borda - t) < limiar)
      if (alvo !== undefined) {
        esq = alvo - borda
        ativasV.push(alvo)
        break
      }
    }
    for (const borda of [0, h / 2, h]) {
      const alvo = hs.find((t) => Math.abs(topo + borda - t) < limiar)
      if (alvo !== undefined) {
        topo = alvo - borda
        ativasH.push(alvo)
        break
      }
    }
    no.position({ x: esq + w / 2, y: topo + h / 2 })
    setLinhasSnap({ v: ativasV, h: ativasH })
  }

  /** Fim do arraste: grupo → um commit só; foto sobre foto → troca. true = já tratado. */
  function aoTerminarArrasto(id: string, no: Konva.Node): boolean {
    setLinhasSnap({ v: [], h: [] })
    const grupo = inicioArrasto.current
    inicioArrasto.current = null
    if (grupo) {
      const ini = grupo.get(id)!
      const dx = no.x() - ini.x
      const dy = no.y() - ini.y
      onMoverVarios(selecionados.filter((sel) => grupo.has(sel.id)).map((sel) => ({ sel, dx, dy })))
      return true
    }
    if (alvoTroca) {
      const q = lamina.quadros.find((x) => x.id === id)
      if (q) no.position({ x: q.x + q.w / 2, y: q.y + q.h / 2 })
      onTrocarFotos(id, alvoTroca)
      setAlvoTroca(null)
      return true
    }
    return false
  }

  function pontoEmMm(clientX: number, clientY: number) {
    const r = caixaRef.current!.getBoundingClientRect()
    return { x: (clientX - r.left - pan.x - origemX) / escala, y: (clientY - r.top - pan.y - origemY) / escala }
  }

  function comum(id: string, tipo: Selecao['tipo']): Comum {
    return {
      escala,
      somenteLeitura,
      bloqueado: bloqueados.has(id),
      onSelecionar: (aditivo) => onSelecionar({ tipo, id }, aditivo),
      onArrastoInicio: () => aoIniciarArrasto(id),
      onArrastando: (no, w, h) => aoArrastar(id, no, w, h),
      onArrastoFim: (no) => aoTerminarArrasto(id, no),
      registrarNo: (no) => {
        if (no) nos.current.set(id, no)
        else nos.current.delete(id)
      },
    }
  }

  const paginaGuias = [0, 1].map((p) => ({
    x: p * g.paginaW + g.margem,
    y: g.margem,
    w: g.paginaW - 2 * g.margem,
    h: g.laminaH - 2 * g.margem,
  }))
  // Divisórias só das fotos selecionadas (sem poluir a lâmina inteira).
  const divisorias = useMemo(() => {
    if (somenteLeitura || recortando) return []
    const ids = new Set(selecionados.filter((x) => x.tipo === 'quadro').map((x) => x.id))
    if (ids.size === 0) return []
    return encontrarDivisorias(lamina.quadros).filter((d) => d.antes.some((id) => ids.has(id)) || d.depois.some((id) => ids.has(id)))
  }, [lamina.quadros, selecionados, somenteLeitura, recortando])

  const fotoFundo = lamina.fundoImagem ? fotos.get(lamina.fundoImagem.fotoId) : undefined
  const urlFundo = fotoFundo ? (fotoFundo.urlPreview ?? fotoFundo.url) : undefined
  const gr = lamina.fundoGradiente
  const rad = gr ? (gr.angulo * Math.PI) / 180 : 0
  const ladrilho = lamina.textura && typeof document !== 'undefined' ? ladrilhoDeTextura(lamina.textura.tipo) : null
  const alvoQuadro = alvoTroca ? lamina.quadros.find((q) => q.id === alvoTroca) : null

  return (
    <div
      ref={caixaRef}
      className={`relative h-full w-full overflow-hidden ${soltando ? 'bg-sky-500/10' : ''}`}
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          // Zoom no ponteiro: o ponto sob o mouse fica parado.
          const r = caixaRef.current!.getBoundingClientRect()
          const novo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
          const px = e.clientX - r.left - tamanho.w / 2
          const py = e.clientY - r.top - tamanho.h / 2
          const fator = novo / zoom
          setPan((p) => ({ x: px - (px - p.x) * fator, y: py - (py - p.y) * fator }))
          onZoom(novo)
        } else if (zoom > 1) {
          setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
        }
      }}
      onDragOver={(e) => {
        if (somenteLeitura || !e.dataTransfer.types.includes(MIME_FOTO)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setSoltando(true)
      }}
      onDragLeave={() => setSoltando(false)}
      onDrop={(e) => {
        setSoltando(false)
        const fotoId = e.dataTransfer.getData(MIME_FOTO)
        if (!fotoId || somenteLeitura) return
        e.preventDefault()
        const p = pontoEmMm(e.clientX, e.clientY)
        // O quadro mais de cima sob o ponto recebe a foto (troca).
        const alvo = [...lamina.quadros].reverse().find((q) => !q.oculto && p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h)
        onSoltarFoto(fotoId, p.x, p.y, alvo?.id ?? null)
      }}
    >
      {tamanho.w > 0 ? (
        <Stage
          width={tamanho.w}
          height={tamanho.h}
          x={pan.x}
          y={pan.y}
          draggable={zoom > 1}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) setPan({ x: e.target.x(), y: e.target.y() })
          }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage() || e.target.name() === 'fundo') onSelecionar(null)
          }}
          onTouchStart={(e) => {
            if (e.target === e.target.getStage() || e.target.name() === 'fundo') onSelecionar(null)
          }}
        >
          <Layer>
            <Group x={origemX} y={origemY} scaleX={escala} scaleY={escala}>
              <Rect name="fundo" x={-s} y={-s} width={totalW} height={totalH} fill={lamina.fundo} shadowColor="#000" shadowBlur={8} shadowOpacity={0.18} />
              {gr ? (
                <Rect
                  x={-s}
                  y={-s}
                  width={totalW}
                  height={totalH}
                  listening={false}
                  fillLinearGradientStartPoint={{ x: totalW / 2 - (Math.cos(rad) * totalW) / 2, y: totalH / 2 - (Math.sin(rad) * totalH) / 2 }}
                  fillLinearGradientEndPoint={{ x: totalW / 2 + (Math.cos(rad) * totalW) / 2, y: totalH / 2 + (Math.sin(rad) * totalH) / 2 }}
                  fillLinearGradientColorStops={[0, gr.de, 1, gr.para]}
                />
              ) : null}
              {ladrilho && lamina.textura ? (
                <Rect
                  x={-s}
                  y={-s}
                  width={totalW}
                  height={totalH}
                  listening={false}
                  opacity={lamina.textura.opacidade}
                  fillPatternImage={ladrilho as unknown as HTMLImageElement}
                  fillPatternScale={{ x: LADO_TEXTURA_MM / ladrilho.width, y: LADO_TEXTURA_MM / ladrilho.width }}
                  fillPatternRepeat="repeat"
                />
              ) : null}
              {urlFundo && lamina.fundoImagem ? <FundoImagem url={urlFundo} opacidade={lamina.fundoImagem.opacidade} g={g} /> : null}
              {lamina.formas
                .filter((f) => f.camada === 'tras')
                .map((f) => (
                  <FormaNoCanvas key={f.id} forma={f} {...comum(f.id, 'forma')} onAlterar={(p) => onAlterarForma(f.id, p)} />
                ))}
              {quadrosNaTela.map((q) => (
                <QuadroNoCanvas
                  key={q.id}
                  quadro={q}
                  foto={q.fotoId && fotos.get(q.fotoId) ? { id: q.fotoId, ...fotos.get(q.fotoId)! } : null}
                  fundo={lamina.fundo}
                  recortando={recortando && selecao?.id === q.id}
                  onAlterar={(p) => onAlterarQuadro(q.id, p)}
                  onDimensoes={onDimensoes}
                  {...comum(q.id, 'quadro')}
                />
              ))}
              {lamina.formas
                .filter((f) => f.camada === 'frente')
                .map((f) => (
                  <FormaNoCanvas key={f.id} forma={f} {...comum(f.id, 'forma')} onAlterar={(p) => onAlterarForma(f.id, p)} />
                ))}
              {lamina.textos.map((t) => (
                <TextoNoCanvas key={t.id} texto={t} {...comum(t.id, 'texto')} onAlterar={(p) => onAlterarTexto(t.id, p)} />
              ))}
              {divisorias.map((d, i) => {
                const meio = (d.bordaAntes + d.bordaDepois) / 2
                const largura = Math.max(d.bordaDepois - d.bordaAntes, 7 / escala)
                const vertical = d.eixo === 'v'
                const x0 = vertical ? meio - largura / 2 : d.inicio
                const y0 = vertical ? d.inicio : meio - largura / 2
                return (
                  <Rect
                    key={`div-${i}-${d.eixo}-${d.bordaAntes.toFixed(1)}`}
                    x={x0}
                    y={y0}
                    width={vertical ? largura : d.fim - d.inicio}
                    height={vertical ? d.fim - d.inicio : largura}
                    fill="rgba(56,189,248,0.45)"
                    stroke="#0EA5E9"
                    strokeWidth={traco}
                    cornerRadius={largura / 2}
                    draggable
                    onMouseEnter={(e) => {
                      const c = e.target.getStage()?.container()
                      if (c) c.style.cursor = vertical ? 'ew-resize' : 'ns-resize'
                    }}
                    onMouseLeave={(e) => {
                      const c = e.target.getStage()?.container()
                      if (c) c.style.cursor = ''
                    }}
                    onMouseDown={(e) => {
                      e.cancelBubble = true
                    }}
                    onDragMove={(e) => {
                      const no = e.target
                      // Só no eixo da divisória.
                      if (vertical) no.y(y0)
                      else no.x(x0)
                      const delta = vertical ? no.x() - x0 : no.y() - y0
                      setPreviaDivisoria(new Map(aplicarDivisoria(d, lamina.quadros, delta).map((p) => [p.id, p.patch])))
                    }}
                    onDragEnd={(e) => {
                      const no = e.target
                      const delta = vertical ? no.x() - x0 : no.y() - y0
                      no.position({ x: x0, y: y0 })
                      setPreviaDivisoria(null)
                      const patches = aplicarDivisoria(d, lamina.quadros, delta)
                      if (patches.length > 0 && Math.abs(delta) > 0.05) onAjustarQuadros(patches)
                    }}
                  />
                )
              })}
              {alvoQuadro ? (
                <Rect x={alvoQuadro.x} y={alvoQuadro.y} width={alvoQuadro.w} height={alvoQuadro.h} stroke="#22C55E" strokeWidth={3 * traco} dash={[8 * traco, 4 * traco]} listening={false} />
              ) : null}
              {/* Seleção múltipla: contorno nos que estão juntos. */}
              {selecionados.length > 1
                ? [...lamina.quadros, ...lamina.formas]
                    .filter((e) => selecionadoIds.has(e.id))
                    .map((e) => (
                      <Rect key={`sel-${e.id}`} x={e.x} y={e.y} width={e.w} height={e.h} rotation={0} stroke="#38BDF8" strokeWidth={traco} listening={false} />
                    ))
                : null}
              {mostrarGuias ? (
                <Group listening={false}>
                  {/* Sangria sombreada por cima (mostra o que será cortado). */}
                  <Rect x={-s} y={-s} width={totalW} height={s} fill="rgba(220,38,38,0.08)" />
                  <Rect x={-s} y={g.laminaH} width={totalW} height={s} fill="rgba(220,38,38,0.08)" />
                  <Rect x={-s} y={0} width={s} height={g.laminaH} fill="rgba(220,38,38,0.08)" />
                  <Rect x={g.laminaW} y={0} width={s} height={g.laminaH} fill="rgba(220,38,38,0.08)" />
                  <Rect x={-s} y={-s} width={totalW} height={totalH} stroke="#DC2626" strokeWidth={traco} dash={[5 * traco, 4 * traco]} />
                  <Rect x={0} y={0} width={g.laminaW} height={g.laminaH} stroke="#525252" strokeWidth={traco} />
                  {paginaGuias.map((r, i) => (
                    <Rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} stroke="#2563EB" strokeWidth={traco} dash={[3 * traco, 3 * traco]} opacity={0.7} />
                  ))}
                  <Line points={[g.paginaW, -s, g.paginaW, g.laminaH + s]} stroke="#171717" strokeWidth={traco} dash={[8 * traco, 5 * traco]} opacity={0.6} />
                  <KText x={g.paginaW + 1.5} y={-s + 1} text="DOBRA" fontSize={9 / escala} fill="#525252" />
                </Group>
              ) : null}
              <Group listening={false}>
                {linhasSnap.v.map((x, i) => (
                  <Line key={`v${i}`} points={[x, -s, x, g.laminaH + s]} stroke="#EC4899" strokeWidth={traco} />
                ))}
                {linhasSnap.h.map((y, i) => (
                  <Line key={`h${i}`} points={[-s, y, g.laminaW + s, y]} stroke="#EC4899" strokeWidth={traco} />
                ))}
              </Group>
            </Group>
            <Transformer
              ref={transformerRef}
              rotateEnabled
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              keepRatio={false}
              flipEnabled={false}
              anchorSize={9}
              borderStroke="#2563EB"
              anchorStroke="#2563EB"
              boundBoxFunc={(antes, depois) => (Math.abs(depois.width) < MIN_MM * escala ? antes : depois)}
            />
          </Layer>
        </Stage>
      ) : null}
    </div>
  )
}
