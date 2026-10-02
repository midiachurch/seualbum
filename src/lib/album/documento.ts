import { laminaEmCm, DPI_MINIMO } from '@/lib/resolucao'
import type { AlbumOrientationValue } from '@/types/platform'

/**
 * Documento do editor de álbum (migration 0027). Tudo em MILÍMETROS, com a
 * origem no canto superior esquerdo da lâmina aberta (linha de corte, sem a
 * sangria). Assim a mesma lâmina sai exata em qualquer tela e no JPG final de
 * 300 DPI, e a sangria/dobra/área segura são só contas sobre a geometria.
 *
 * Rotação de qualquer elemento: em graus, em torno do centro do retângulo
 * (x, y, w, h continuam descrevendo o retângulo SEM rotação).
 */

/** Parte visível da foto dentro do quadro: zoom ≥ 1 sobre o "cobrir" e o centro (0–1). */
export type Recorte = { zoom: number; cx: number; cy: number }

/** −100 a 100 (0 = original). */
export type Ajustes = { brilho: number; contraste: number; saturacao: number; temperatura: number; exposicao: number; pb: boolean }

export type Quadro = {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** null = quadro vazio (veio de um modelo e ainda não recebeu foto). */
  fotoId: string | null
  recorte: Recorte
  rotacao: number
  espelharH: boolean
  espelharV: boolean
  /** 0–1 */
  opacidade: number
  borda: { cor: string; espessura: number } | null
  /** Cantos arredondados (mm). */
  raio: number
  sombra: boolean
  ajustes: Ajustes
  /** Bloqueado: não move nem seleciona pelo canvas (só pelo painel de camadas). */
  bloqueado: boolean
  /** Oculto: não aparece no canvas nem na impressão. */
  oculto: boolean
}

export type FonteChave = 'editorial' | 'serifa' | 'classica' | 'sans' | 'sans-leve' | 'manuscrita'

export type TextoDoc = {
  id: string
  x: number
  y: number
  w: number
  texto: string
  fonte: FonteChave
  /** Pontos tipográficos. */
  tamanho: number
  peso: 300 | 400 | 500 | 600 | 700
  italico: boolean
  cor: string
  alinhamento: 'left' | 'center' | 'right'
  /** Milésimos de em (tracking), −100 a 500. */
  entreLetras: number
  /** Múltiplo do tamanho, 0,8 a 3. */
  entreLinhas: number
  rotacao: number
  opacidade: number
  bloqueado: boolean
  oculto: boolean
}

export type FormaDoc = {
  id: string
  forma: 'retangulo' | 'elipse' | 'linha' | 'ornamento'
  /** Só ornamentos: qual desenho (ver `lib/album/ornamentos`). */
  ornamento: string | null
  x: number
  y: number
  w: number
  h: number
  preenchimento: string | null
  contorno: string | null
  /** mm */
  espessura: number
  opacidade: number
  rotacao: number
  /** Atrás das fotos (moldura/fundo) ou na frente. */
  camada: 'tras' | 'frente'
  bloqueado: boolean
  oculto: boolean
}

export type Textura = 'papel' | 'linho' | 'pontos' | 'listras' | 'granulado'

export type LaminaDoc = {
  id: string
  fundo: string
  /** Degradê sobre a cor de fundo (ângulo em graus). */
  fundoGradiente: { de: string; para: string; angulo: number } | null
  /** Textura procedural por cima do fundo. */
  textura: { tipo: Textura; opacidade: number } | null
  /** Uma foto cobrindo a lâmina inteira (com sangria) como fundo. */
  fundoImagem: { fotoId: string; opacidade: number } | null
  quadros: Quadro[]
  textos: TextoDoc[]
  formas: FormaDoc[]
}

export type DocumentoAlbum = {
  versao: 1
  laminas: LaminaDoc[]
  /** A 1ª lâmina é a capa: aparece na prova, mas não conta na franquia (0023). */
  primeiraEhCapa: boolean
}

export type Geometria = {
  /** Lâmina aberta (duas páginas), sem sangria. */
  laminaW: number
  laminaH: number
  paginaW: number
  sangria: number
  margem: number
}

export type FotoEditor = {
  id: string
  url: string
  nome: string
  /** Dimensões do arquivo original; null até a imagem carregar. */
  largura: number | null
  altura: number | null
  grupo?: string
  capturadaEm?: string | null
  favorita?: boolean
  obrigatoria?: boolean
  /** Fração de pixels estourados (0–1), medida no navegador. */
  estouro?: number | null
  /** Versões leves para a interface (o `url` é o original, para a exportação). */
  urlMini?: string | null
  urlPreview?: string | null
  /** Ponto de interesse (0–1) para o recorte inteligente. */
  fx?: number | null
  fy?: number | null
  prioridade?: 'principal' | 'secundaria' | 'complementar' | null
  /** Modo de cor medido: true = preto e branco. */
  monocromatica?: boolean | null
  pasta?: string | null
}

export const LIMITES = { laminas: 200, quadrosPorLamina: 40, textosPorLamina: 30, formasPorLamina: 30 }
export const AJUSTES_NEUTROS: Ajustes = { brilho: 0, contraste: 0, saturacao: 0, temperatura: 0, exposicao: 0, pb: false }
const RECORTE_PADRAO: Recorte = { zoom: 1, cx: 0.5, cy: 0.5 }
const ZOOM_MAXIMO = 8
export const PT_EM_MM = 25.4 / 72

export function novoId(prefixo = 'q') {
  return `${prefixo}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function geometria(album: {
  formato: string
  orientacao: AlbumOrientationValue
  sangriaMm: number
  margemSeguraMm: number
}): Geometria | null {
  const cm = laminaEmCm({ formato: album.formato, orientacao: album.orientacao })
  if (!cm) return null
  return {
    laminaW: cm.largura * 10,
    laminaH: cm.altura * 10,
    paginaW: (cm.largura * 10) / 2,
    sangria: album.sangriaMm,
    margem: album.margemSeguraMm,
  }
}

export function novaLamina(fundo = '#ffffff'): LaminaDoc {
  return { id: novoId('l'), fundo, fundoGradiente: null, textura: null, fundoImagem: null, quadros: [], textos: [], formas: [] }
}

export function documentoVazio(laminas = 1): DocumentoAlbum {
  return { versao: 1, laminas: Array.from({ length: Math.max(1, laminas) }, () => novaLamina()), primeiraEhCapa: false }
}

export function ajustesNeutros(a: Ajustes) {
  return a.brilho === 0 && a.contraste === 0 && a.saturacao === 0 && a.temperatura === 0 && a.exposicao === 0 && !a.pb
}

const finito = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao)
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const cor = (v: unknown, padrao: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : padrao)
const corOuNull = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null)
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const idValido = (v: unknown, prefixo: string) => (typeof v === 'string' && v.length > 0 && v.length <= 40 ? v : novoId(prefixo))
const FONTES: FonteChave[] = ['editorial', 'serifa', 'classica', 'sans', 'sans-leve', 'manuscrita']
const PESOS = [300, 400, 500, 600, 700] as const

function normalizarQuadro(bruto: unknown): Quadro {
  const qd = obj(bruto)
  const r = obj(qd.recorte)
  const a = obj(qd.ajustes)
  const b = qd.borda ? obj(qd.borda) : null
  return {
    id: idValido(qd.id, 'q'),
    x: limitar(finito(qd.x, 0), -5000, 5000),
    y: limitar(finito(qd.y, 0), -5000, 5000),
    w: limitar(finito(qd.w, 50), 1, 5000),
    h: limitar(finito(qd.h, 50), 1, 5000),
    fotoId: typeof qd.fotoId === 'string' && qd.fotoId.length <= 64 ? qd.fotoId : null,
    recorte: {
      zoom: limitar(finito(r.zoom, 1), 1, ZOOM_MAXIMO),
      cx: limitar(finito(r.cx, 0.5), 0, 1),
      cy: limitar(finito(r.cy, 0.5), 0, 1),
    },
    rotacao: limitar(finito(qd.rotacao, 0), -360, 360),
    espelharH: qd.espelharH === true,
    espelharV: qd.espelharV === true,
    opacidade: limitar(finito(qd.opacidade, 1), 0, 1),
    borda: b ? { cor: cor(b.cor, '#ffffff'), espessura: limitar(finito(b.espessura, 1), 0.1, 30) } : null,
    raio: limitar(finito(qd.raio, 0), 0, 200),
    sombra: qd.sombra === true,
    ajustes: {
      brilho: limitar(finito(a.brilho, 0), -100, 100),
      contraste: limitar(finito(a.contraste, 0), -100, 100),
      saturacao: limitar(finito(a.saturacao, 0), -100, 100),
      temperatura: limitar(finito(a.temperatura, 0), -100, 100),
      exposicao: limitar(finito(a.exposicao, 0), -100, 100),
      pb: a.pb === true,
    },
    bloqueado: qd.bloqueado === true,
    oculto: qd.oculto === true,
  }
}

function normalizarTexto(bruto: unknown): TextoDoc {
  const t = obj(bruto)
  const peso = PESOS.find((p) => p === t.peso) ?? 400
  return {
    id: idValido(t.id, 't'),
    x: limitar(finito(t.x, 0), -5000, 5000),
    y: limitar(finito(t.y, 0), -5000, 5000),
    w: limitar(finito(t.w, 120), 5, 5000),
    texto: typeof t.texto === 'string' ? t.texto.slice(0, 2000) : '',
    fonte: FONTES.includes(t.fonte as FonteChave) ? (t.fonte as FonteChave) : 'editorial',
    tamanho: limitar(finito(t.tamanho, 24), 4, 400),
    peso,
    italico: t.italico === true,
    cor: cor(t.cor, '#171717'),
    alinhamento: t.alinhamento === 'left' || t.alinhamento === 'right' ? t.alinhamento : 'center',
    entreLetras: limitar(finito(t.entreLetras, 0), -100, 500),
    entreLinhas: limitar(finito(t.entreLinhas, 1.2), 0.8, 3),
    rotacao: limitar(finito(t.rotacao, 0), -360, 360),
    opacidade: limitar(finito(t.opacidade, 1), 0, 1),
    bloqueado: t.bloqueado === true,
    oculto: t.oculto === true,
  }
}

function normalizarForma(bruto: unknown): FormaDoc {
  const f = obj(bruto)
  return {
    id: idValido(f.id, 'f'),
    forma: f.forma === 'elipse' || f.forma === 'linha' || f.forma === 'ornamento' ? f.forma : 'retangulo',
    ornamento: typeof f.ornamento === 'string' && f.ornamento.length <= 40 ? f.ornamento : null,
    x: limitar(finito(f.x, 0), -5000, 5000),
    y: limitar(finito(f.y, 0), -5000, 5000),
    w: limitar(finito(f.w, 50), 0.1, 5000),
    h: limitar(finito(f.h, 50), 0.1, 5000),
    preenchimento: corOuNull(f.preenchimento),
    contorno: corOuNull(f.contorno),
    espessura: limitar(finito(f.espessura, 0.5), 0, 50),
    opacidade: limitar(finito(f.opacidade, 1), 0, 1),
    rotacao: limitar(finito(f.rotacao, 0), -360, 360),
    camada: f.camada === 'tras' ? 'tras' : 'frente',
    bloqueado: f.bloqueado === true,
    oculto: f.oculto === true,
  }
}

const TEXTURAS: Textura[] = ['papel', 'linho', 'pontos', 'listras', 'granulado']

/** Lê o JSON do banco (ou do navegador) sem confiar no formato: descarta o que não reconhece. */
export function normalizarDocumento(bruto: unknown): DocumentoAlbum {
  const raiz = obj(bruto)
  const laminasBrutas = Array.isArray(raiz.laminas) ? raiz.laminas.slice(0, LIMITES.laminas) : []
  const laminas: LaminaDoc[] = laminasBrutas.map((l) => {
    const lam = obj(l)
    const fi = lam.fundoImagem ? obj(lam.fundoImagem) : null
    const gr = lam.fundoGradiente ? obj(lam.fundoGradiente) : null
    const tx = lam.textura ? obj(lam.textura) : null
    return {
      id: idValido(lam.id, 'l'),
      fundo: cor(lam.fundo, '#ffffff'),
      fundoGradiente: gr ? { de: cor(gr.de, '#ffffff'), para: cor(gr.para, '#e8e1d8'), angulo: limitar(finito(gr.angulo, 90), -360, 360) } : null,
      textura: tx && TEXTURAS.includes(tx.tipo as Textura) ? { tipo: tx.tipo as Textura, opacidade: limitar(finito(tx.opacidade, 0.3), 0, 1) } : null,
      fundoImagem:
        fi && typeof fi.fotoId === 'string' && fi.fotoId.length <= 64 ? { fotoId: fi.fotoId, opacidade: limitar(finito(fi.opacidade, 1), 0, 1) } : null,
      quadros: (Array.isArray(lam.quadros) ? lam.quadros.slice(0, LIMITES.quadrosPorLamina) : []).map(normalizarQuadro),
      textos: (Array.isArray(lam.textos) ? lam.textos.slice(0, LIMITES.textosPorLamina) : []).map(normalizarTexto),
      formas: (Array.isArray(lam.formas) ? lam.formas.slice(0, LIMITES.formasPorLamina) : []).map(normalizarForma),
    }
  })
  return { versao: 1, laminas: laminas.length > 0 ? laminas : [novaLamina()], primeiraEhCapa: raiz.primeiraEhCapa === true }
}

export function quadroNovo(x: number, y: number, w: number, h: number, fotoId: string | null = null): Quadro {
  return {
    id: novoId(),
    x,
    y,
    w,
    h,
    fotoId,
    recorte: { ...RECORTE_PADRAO },
    rotacao: 0,
    espelharH: false,
    espelharV: false,
    opacidade: 1,
    borda: null,
    raio: 0,
    sombra: false,
    ajustes: { ...AJUSTES_NEUTROS },
    bloqueado: false,
    oculto: false,
  }
}

export function textoNovo(x: number, y: number, w: number, texto = 'Seu texto aqui'): TextoDoc {
  return {
    id: novoId('t'),
    x,
    y,
    w,
    texto,
    fonte: 'editorial',
    tamanho: 28,
    peso: 400,
    italico: false,
    cor: '#171717',
    alinhamento: 'center',
    entreLetras: 0,
    entreLinhas: 1.2,
    rotacao: 0,
    opacidade: 1,
    bloqueado: false,
    oculto: false,
  }
}

export function formaNova(forma: FormaDoc['forma'], x: number, y: number, w: number, h: number): FormaDoc {
  return {
    id: novoId('f'),
    forma,
    ornamento: null,
    x,
    y,
    w,
    h: forma === 'linha' ? 0.1 : h,
    preenchimento: forma === 'linha' ? null : '#E8E1D8',
    contorno: forma === 'linha' ? '#171717' : null,
    espessura: forma === 'linha' ? 0.5 : 0.5,
    opacidade: 1,
    rotacao: 0,
    camada: forma === 'linha' || forma === 'ornamento' ? 'frente' : 'tras',
    bloqueado: false,
    oculto: false,
  }
}

/** mm por pixel da foto no quadro (o "cobrir" vezes o zoom). */
function escala(q: Pick<Quadro, 'w' | 'h' | 'recorte'>, imgW: number, imgH: number) {
  return Math.max(q.w / imgW, q.h / imgH) * q.recorte.zoom
}

/** Mantém o centro dentro do que a foto alcança: o quadro nunca mostra borda vazia. */
export function ajustarRecorte(q: Pick<Quadro, 'w' | 'h'>, recorte: Recorte, imgW: number, imgH: number): Recorte {
  const zoom = limitar(recorte.zoom, 1, ZOOM_MAXIMO)
  const s = Math.max(q.w / imgW, q.h / imgH) * zoom
  const meiaW = q.w / (2 * imgW * s)
  const meiaH = q.h / (2 * imgH * s)
  return { zoom, cx: limitar(recorte.cx, meiaW, 1 - meiaW), cy: limitar(recorte.cy, meiaH, 1 - meiaH) }
}

/** Onde a foto inteira fica, em mm, relativo ao canto do quadro (o quadro recorta). */
export function posicaoDaFoto(q: Pick<Quadro, 'w' | 'h' | 'recorte'>, imgW: number, imgH: number) {
  const r = ajustarRecorte(q, q.recorte, imgW, imgH)
  const s = escala({ ...q, recorte: r }, imgW, imgH)
  const w = imgW * s
  const h = imgH * s
  return { x: q.w / 2 - r.cx * w, y: q.h / 2 - r.cy * h, w, h }
}

/** Arrastar a foto dentro do quadro: desloca o centro do recorte (já descontando o espelhamento). */
export function moverRecorte(q: Quadro, dxMm: number, dyMm: number, imgW: number, imgH: number): Recorte {
  const s = escala(q, imgW, imgH)
  const dx = q.espelharH ? -dxMm : dxMm
  const dy = q.espelharV ? -dyMm : dyMm
  return ajustarRecorte(q, { ...q.recorte, cx: q.recorte.cx - dx / (imgW * s), cy: q.recorte.cy - dy / (imgH * s) }, imgW, imgH)
}

/** Resolução efetiva da foto impressa no quadro. */
export function dpiDoQuadro(q: Pick<Quadro, 'w' | 'h' | 'recorte'>, imgW: number, imgH: number) {
  return Math.floor(25.4 / escala(q, imgW, imgH))
}

export function dpiBaixo(q: Quadro, imgW: number | null, imgH: number | null) {
  return imgW !== null && imgH !== null && dpiDoQuadro(q, imgW, imgH) < DPI_MINIMO
}

/** Retângulo que envolve o elemento já rotacionado (para verificação e encaixe). */
export function caixaRotacionada(e: { x: number; y: number; w: number; h: number; rotacao: number }) {
  if (!e.rotacao) return { x: e.x, y: e.y, w: e.w, h: e.h }
  const rad = (e.rotacao * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const w = e.w * cos + e.h * sin
  const h = e.w * sin + e.h * cos
  const cx = e.x + e.w / 2
  const cy = e.y + e.h / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** Quadro passa a ter a proporção da foto (mantém a largura e o centro). */
export function ajustarQuadroAFoto(q: Quadro, imgW: number, imgH: number): Partial<Quadro> {
  const h = q.w * (imgH / imgW)
  return { y: q.y + q.h / 2 - h / 2, h, recorte: { zoom: 1, cx: 0.5, cy: 0.5 } }
}

/** Fotos usadas em qualquer lugar da lâmina (quadros e fundo). */
export function fotosDaLamina(l: LaminaDoc): string[] {
  const ids = l.quadros.map((q) => q.fotoId).filter((id): id is string => Boolean(id))
  if (l.fundoImagem) ids.push(l.fundoImagem.fotoId)
  return ids
}

export function laminaVazia(l: LaminaDoc) {
  return l.quadros.length === 0 && l.textos.length === 0 && l.formas.length === 0 && !l.fundoImagem
}

/** Recorte inicial de uma foto num quadro: centrado no ponto de interesse (recorte inteligente). */
export function recorteInicial(foto: Pick<FotoEditor, 'fx' | 'fy'> | undefined): Recorte {
  return { zoom: 1, cx: foto?.fx ?? 0.5, cy: foto?.fy ?? 0.5 }
}

/** "Capa", "Lâmina 3 · págs. 5–6". */
export function rotuloDaLamina(indice: number, primeiraEhCapa: boolean, comPaginas = true) {
  if (primeiraEhCapa && indice === 0) return 'Capa'
  const n = primeiraEhCapa ? indice : indice + 1
  return comPaginas ? `Lâmina ${n} · págs. ${2 * n - 1}–${2 * n}` : `Lâmina ${n}`
}
