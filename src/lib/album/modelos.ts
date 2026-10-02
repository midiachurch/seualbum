import { generateSmartLayout } from '@/lib/smart-layout'
import { novaLamina, novoId, quadroNovo, textoNovo, type DocumentoAlbum, type FonteChave, type FotoEditor, type Geometria, type LaminaDoc, type Quadro } from '@/lib/album/documento'
import type { Photo } from '@/types/platform'

/**
 * Modelos de grade, estilos e o Smart Layout geométrico. Cada página é
 * dividida em retângulos normalizados (0–1) dentro da margem; o espaço entre
 * fotos é fixo em mm. Para N fotos, testamos as divisões entre página
 * esquerda e direita × os modelos de cada página e ficamos com as
 * combinações em que a proporção dos quadros mais combina com a das fotos —
 * sem deformar (a foto sempre "cobre" o quadro), punindo recorte excessivo e
 * quadros pequenos demais. Fotos panorâmicas ganham uma faixa na lâmina.
 */

type Ret = [x: number, y: number, w: number, h: number]

const T3 = 1 / 3
const MODELOS_DE_PAGINA: Record<number, Ret[][]> = {
  1: [[[0, 0, 1, 1]], [[0.12, 0.12, 0.76, 0.76]]],
  2: [
    [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
    [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
    [[0, 0, 0.62, 1], [0.62, 0, 0.38, 1]],
    [[0, 0, 1, 0.62], [0, 0.62, 1, 0.38]],
  ],
  3: [
    [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]],
    [[0, 0, T3, 1], [T3, 0, T3, 1], [2 * T3, 0, T3, 1]],
    [[0, 0, 1, 0.55], [0, 0.55, 0.5, 0.45], [0.5, 0.55, 0.5, 0.45]],
    [[0, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0, 0.5, 1]],
  ],
  4: [
    [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
    [[0, 0, 1, 0.64], [0, 0.64, T3, 0.36], [T3, 0.64, T3, 0.36], [2 * T3, 0.64, T3, 0.36]],
    [[0, 0, 0.6, 1], [0.6, 0, 0.4, T3], [0.6, T3, 0.4, T3], [0.6, 2 * T3, 0.4, T3]],
  ],
  5: [
    [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, T3, 0.5], [T3, 0.5, T3, 0.5], [2 * T3, 0.5, T3, 0.5]],
    [[0, 0, 0.6, 0.6], [0.6, 0, 0.4, 0.3], [0.6, 0.3, 0.4, 0.3], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]],
  ],
  6: [
    [[0, 0, T3, 0.5], [T3, 0, T3, 0.5], [2 * T3, 0, T3, 0.5], [0, 0.5, T3, 0.5], [T3, 0.5, T3, 0.5], [2 * T3, 0.5, T3, 0.5]],
    [[0, 0, 0.5, T3], [0.5, 0, 0.5, T3], [0, T3, 0.5, T3], [0.5, T3, 0.5, T3], [0, 2 * T3, 0.5, T3], [0.5, 2 * T3, 0.5, T3]],
  ],
}

export const MAX_FOTOS_POR_LAMINA = 12
const PROPORCAO_PADRAO = 1.5
const PROPORCAO_PANORAMICA = 2.1
/** Recorte acima disso (proporção do quadro × da foto) corta demais. */
const RECORTE_EXCESSIVO = 1.6
const LADO_MINIMO_MM = 35

/* ------------------------------- estilos ------------------------------- */

export type EstiloId = 'classico' | 'editorial' | 'clean' | 'minimalista' | 'moderno' | 'luxo'

export type Estilo = {
  id: EstiloId
  nome: string
  descricao: string
  /** Fotos por lâmina, repetido ao longo do álbum. */
  ritmo: number[]
  /** mm somados à margem segura nas bordas da página. */
  margemExtra: number
  espaco: number
  fundo: string
  /** Variantes com foto sangrando/panorâmica valem mais. */
  gostaDeSangria: boolean
  /** Tipografia do estilo (capa, abertura, encerramento). */
  fonteTitulo: FonteChave
  fonteTexto: FonteChave
  corTexto: string
}

export const ESTILOS: Estilo[] = [
  { id: 'classico', nome: 'Clássico', descricao: 'Grades equilibradas de 2 a 4 fotos, margens regulares.', ritmo: [3, 2, 4, 2, 3], margemExtra: 5, espaco: 4, fundo: '#ffffff', gostaDeSangria: false, fonteTitulo: 'serifa', fonteTexto: 'classica', corTexto: '#2b2b2b' },
  { id: 'editorial', nome: 'Editorial', descricao: 'Panorâmicas e destaques sangrando, alternando com detalhes.', ritmo: [1, 3, 2, 4, 1, 2], margemExtra: 0, espaco: 3, fundo: '#ffffff', gostaDeSangria: true, fonteTitulo: 'editorial', fonteTexto: 'sans', corTexto: '#171717' },
  { id: 'clean', nome: 'Clean', descricao: 'Poucas fotos por lâmina, muito respiro e margens largas.', ritmo: [2, 1, 2, 3], margemExtra: 18, espaco: 8, fundo: '#ffffff', gostaDeSangria: false, fonteTitulo: 'sans', fonteTexto: 'sans-leve', corTexto: '#3a3a3a' },
  { id: 'minimalista', nome: 'Minimalista', descricao: 'Uma ou duas fotos por lâmina, centralizadas no branco.', ritmo: [1, 2, 1], margemExtra: 30, espaco: 10, fundo: '#fbfaf8', gostaDeSangria: false, fonteTitulo: 'sans-leve', fonteTexto: 'sans-leve', corTexto: '#4a4a4a' },
  { id: 'luxo', nome: 'Luxo', descricao: 'Fundo marfim, margens generosas, destaque único e tipografia clássica.', ritmo: [1, 2, 1, 3], margemExtra: 22, espaco: 6, fundo: '#f7f3ec', gostaDeSangria: false, fonteTitulo: 'classica', fonteTexto: 'classica', corTexto: '#5b4a35' },
  { id: 'moderno', nome: 'Moderno', descricao: 'Mosaicos densos, espaço fino entre fotos e fundo escuro.', ritmo: [4, 6, 3, 5, 8], margemExtra: 0, espaco: 2, fundo: '#1c1c1c', gostaDeSangria: true, fonteTitulo: 'sans', fonteTexto: 'sans', corTexto: '#f5f5f5' },
]

export function estiloPorId(id: string | null | undefined): Estilo {
  return ESTILOS.find((e) => e.id === id) ?? ESTILOS[0]
}

/* -------------------------------- geometria -------------------------------- */

type Opcoes = { margemExtra: number; espaco: number }
const PADRAO: Opcoes = { margemExtra: 5, espaco: 4 }

function margemExterna(g: Geometria, o: Opcoes) {
  return Math.max(g.margem + o.margemExtra, 8)
}

/** Retângulo normalizado → quadro em mm dentro de uma área. */
function naArea(r: Ret, area: { x: number; y: number; w: number; h: number }, o: Opcoes) {
  const [rx, ry, rw, rh] = r
  const meio = o.espaco / 2
  const esq = rx > 0.001 ? meio : 0
  const dir = rx + rw < 0.999 ? meio : 0
  const topo = ry > 0.001 ? meio : 0
  const base = ry + rh < 0.999 ? meio : 0
  return { x: area.x + rx * area.w + esq, y: area.y + ry * area.h + topo, w: rw * area.w - esq - dir, h: rh * area.h - topo - base }
}

function areaDaPagina(pagina: 0 | 1, g: Geometria, o: Opcoes) {
  const m = margemExterna(g, o)
  return { x: pagina * g.paginaW + m, y: m, w: g.paginaW - 2 * m, h: g.laminaH - 2 * m }
}

function proporcaoDe(f: FotoEditor | undefined) {
  return f?.largura && f.altura ? f.largura / f.altura : PROPORCAO_PADRAO
}

type Slot = { x: number; y: number; w: number; h: number }

/** Custo de pôr uma foto num quadro: diferença de proporção + punições. */
function custo(slot: Slot, aFoto: number) {
  const aSlot = slot.w / slot.h
  const razao = Math.max(aSlot / aFoto, aFoto / aSlot)
  let c = Math.log(razao)
  if (razao > RECORTE_EXCESSIVO) c += 1
  if (Math.min(slot.w, slot.h) < LADO_MINIMO_MM) c += 2
  return c
}

const PESO_PRIORIDADE = { principal: 0, secundaria: 1, complementar: 2 } as const

/**
 * Distribui as fotos nos quadros. Hierarquia primeiro: a foto "principal"
 * vai para o maior quadro e as "secundárias" para os seguintes; o resto casa
 * proporções (as mais "deitadas" com os quadros mais largos). Cada foto entra
 * centrada no próprio ponto de interesse (recorte inteligente).
 */
function casar(slots: Slot[], fotos: FotoEditor[]) {
  const quadros: Quadro[] = new Array(slots.length)
  let erro = 0
  const livres = slots.map((s, i) => ({ i, s }))
  const porArea = () => livres.sort((p, q) => q.s.w * q.s.h - p.s.w * p.s.h)
  const destaques = fotos
    .filter((f) => f.prioridade === 'principal' || f.prioridade === 'secundaria')
    .sort((a, b) => PESO_PRIORIDADE[a.prioridade!] - PESO_PRIORIDADE[b.prioridade!])
  const colocar = (slotI: number, f: FotoEditor) => {
    const slot = slots[slotI]
    const q = quadroNovo(slot.x, slot.y, slot.w, slot.h, f.id)
    q.recorte = { zoom: 1, cx: f.fx ?? 0.5, cy: f.fy ?? 0.5 }
    quadros[slotI] = q
    erro += custo(slot, proporcaoDe(f))
  }
  for (const f of destaques) {
    const [maior] = porArea()
    if (!maior) break
    livres.splice(livres.indexOf(maior), 1)
    colocar(maior.i, f)
  }
  const resto = fotos.filter((f) => !destaques.includes(f))
  const porSlot = livres.map((l) => ({ i: l.i, a: l.s.w / l.s.h })).sort((p, q) => p.a - q.a)
  const porFoto = resto.map((f) => ({ f, a: proporcaoDe(f) })).sort((p, q) => p.a - q.a)
  porSlot.forEach((s, k) => {
    if (porFoto[k]) colocar(s.i, porFoto[k].f)
  })
  return { quadros, erro }
}

export type Variante = { id: string; quadros: Quadro[]; erro: number }

/**
 * Troca fotos de lugar até a "principal" ocupar o maior quadro e as
 * "secundárias" os seguintes (a divisão por página pode ter separado).
 */
function garantirHierarquia(v: Variante, fotos: FotoEditor[]) {
  const destaque = fotos
    .filter((f) => f.prioridade === 'principal' || f.prioridade === 'secundaria')
    .sort((a, b) => PESO_PRIORIDADE[a.prioridade!] - PESO_PRIORIDADE[b.prioridade!])
  if (destaque.length === 0) return
  const porArea = [...v.quadros].sort((p, q) => q.w * q.h - p.w * p.h)
  destaque.forEach((f, k) => {
    const alvo = porArea[k]
    const atual = v.quadros.find((q) => q.fotoId === f.id)
    if (!alvo || !atual || alvo === atual) return
    const outra = fotos.find((x) => x.id === alvo.fotoId)
    alvo.fotoId = f.id
    alvo.recorte = { zoom: 1, cx: f.fx ?? 0.5, cy: f.fy ?? 0.5 }
    atual.fotoId = outra?.id ?? null
    atual.recorte = { zoom: 1, cx: outra?.fx ?? 0.5, cy: outra?.fy ?? 0.5 }
    v.erro += 0.2
  })
}

/** Nome do tipo de composição (para o designer escolher pelo efeito). */
export function tipoDaComposicao(v: Variante): 'Panorâmica' | 'Hero' | 'Destaque' | 'Mosaico' | 'Editorial' | 'Grid' | 'Minimalista' {
  if (v.id === 'panoramica' || v.id === 'faixa-panoramica') return 'Panorâmica'
  if (v.id.startsWith('sangra')) return 'Hero'
  const n = v.quadros.length
  if (n >= 7) return 'Mosaico'
  if (n <= 2 && /:0-|^0-/.test(v.id)) return 'Minimalista'
  const [e, d] = v.id.split(':').map((p) => Number(p.split('-')[0]))
  if (e === 1 || d === 1) return 'Destaque'
  if (Number(v.id.split(':')[0]?.split('-')[1] ?? 0) >= 2) return 'Editorial'
  return 'Grid'
}

function linhaDeQuadros(area: { x: number; y: number; w: number; h: number }, n: number, o: Opcoes): Slot[] {
  return Array.from({ length: n }, (_, i) => naArea([i / n, 0, 1 / n, 1], area, o))
}

/** Até `limite` grades para as fotos escolhidas, variadas e da que mais combina para a que menos combina. */
export function variantesDeLayout(fotos: FotoEditor[], g: Geometria, limite = 5, estilo?: Estilo): Variante[] {
  const n = fotos.length
  if (n === 0 || n > MAX_FOTOS_POR_LAMINA) return []
  const o: Opcoes = estilo ? { margemExtra: estilo.margemExtra, espaco: estilo.espaco } : PADRAO
  const bonusSangria = estilo?.gostaDeSangria ? -0.8 : 0
  const candidatas: Variante[] = []
  const s = g.sangria

  // Uma foto só: panorâmica sangrando a lâmina inteira (atravessa a dobra de propósito).
  if (n === 1) {
    const { quadros, erro } = casar([{ x: -s, y: -s, w: g.laminaW + 2 * s, h: g.laminaH + 2 * s }], fotos)
    candidatas.push({ id: 'panoramica', quadros, erro: erro + bonusSangria })
  }

  // Foto panorâmica no grupo: faixa atravessando a lâmina + o resto embaixo, por página.
  const iPano = fotos.findIndex((f) => proporcaoDe(f) >= PROPORCAO_PANORAMICA)
  if (iPano >= 0 && n >= 2 && n <= 7) {
    const m = margemExterna(g, o)
    const alturaFaixa = (g.laminaH - 2 * m) * 0.55
    const faixa = { x: m, y: m, w: g.laminaW - 2 * m, h: alturaFaixa - o.espaco / 2 }
    const resto = fotos.filter((_, i) => i !== iPano)
    const esq = Math.ceil(resto.length / 2)
    const baixo = (p: 0 | 1) => {
      const a = areaDaPagina(p, g, o)
      return { x: a.x, y: m + alturaFaixa + o.espaco / 2, w: a.w, h: a.h - alturaFaixa - o.espaco / 2 }
    }
    const slots = [faixa, ...linhaDeQuadros(baixo(0), esq, o), ...linhaDeQuadros(baixo(1), resto.length - esq, o)]
    const r = casar(slots, [fotos[iPano], ...resto])
    candidatas.push({ id: 'faixa-panoramica', quadros: r.quadros, erro: r.erro - 2 + bonusSangria })
  }

  // Página inteira sangrando + o resto na outra página.
  if (n >= 2 && n <= 7) {
    for (const lado of [0, 1] as const) {
      const cheia = { x: lado === 0 ? -s : g.paginaW, y: -s, w: g.paginaW + s, h: g.laminaH + 2 * s }
      const modelos = MODELOS_DE_PAGINA[n - 1] ?? []
      modelos.forEach((mod, im) => {
        const slots = [cheia, ...mod.map((r) => naArea(r, areaDaPagina(lado === 0 ? 1 : 0, g, o), o))]
        const res = casar(slots, fotos)
        candidatas.push({ id: `sangra${lado}-${im}`, quadros: res.quadros, erro: res.erro + 0.4 + bonusSangria })
      })
    }
  }

  // Divisões entre as páginas: equilibrada, "página de destaque" e tudo de um lado.
  const divisoes = new Set<number>([Math.ceil(n / 2), Math.floor(n / 2)])
  if (n >= 3) {
    divisoes.add(1)
    divisoes.add(n - 1)
  }
  if (n <= 6) divisoes.add(n)

  for (const esquerda of divisoes) {
    const direita = n - esquerda
    if (esquerda > 6 || direita > 6) continue
    const modelosE = esquerda > 0 ? MODELOS_DE_PAGINA[esquerda] : [[]]
    const modelosD = direita > 0 ? MODELOS_DE_PAGINA[direita] : [[]]
    modelosE.forEach((me, ie) =>
      modelosD.forEach((md, id) => {
        const a = casar(me.map((r) => naArea(r, areaDaPagina(0, g, o), o)), fotos.slice(0, esquerda))
        const b = casar(md.map((r) => naArea(r, areaDaPagina(1, g, o), o)), fotos.slice(esquerda))
        // Página em branco: natural com 1 foto; com mais, só se combinar muito melhor.
        const penalidade = esquerda === 0 || direita === 0 ? (n === 1 ? 0.3 : 1.5) : 0
        candidatas.push({ id: `${esquerda}-${ie}:${direita}-${id}`, quadros: [...a.quadros, ...b.quadros], erro: a.erro + b.erro + penalidade })
      }),
    )
  }

  // Hierarquia vale em todas as composições: principal no maior quadro, secundárias nos seguintes.
  for (const c of candidatas) garantirHierarquia(c, fotos)

  // Variedade: primeiro a melhor de cada família, depois o resto por nota.
  const ordenadas = candidatas.sort((p, q) => p.erro - q.erro)
  const familia = (v: Variante) => v.id.replace(/-\d+/g, '')
  const escolhidas: Variante[] = []
  const vistas = new Set<string>()
  for (const v of ordenadas) {
    if (escolhidas.length >= limite) break
    if (!vistas.has(familia(v))) {
      vistas.add(familia(v))
      escolhidas.push(v)
    }
  }
  for (const v of ordenadas) {
    if (escolhidas.length >= limite) break
    if (!escolhidas.includes(v)) escolhidas.push(v)
  }
  return escolhidas.sort((p, q) => p.erro - q.erro)
}

/* ----------------------------- preenchimento ----------------------------- */

/** Ordem editorial: obrigatórias e favoritas primeiro, depois por captura (EXIF), cena e nome. */
export function ordenarFotos(fotos: FotoEditor[]): FotoEditor[] {
  const comoPhoto: Photo[] = fotos.map((f) => ({
    id: f.id,
    url: f.url,
    grupo: f.grupo || f.nome,
    favorita: Boolean(f.favorita),
    obrigatoria: Boolean(f.obrigatoria),
    destaque: false,
    capa: false,
    observacao: null,
    capturadaEm: f.capturadaEm ?? null,
  }))
  // generateSmartLayout já ordena; com páginas de sobra ele devolve a ordem toda.
  const porId = new Map(fotos.map((f) => [f.id, f]))
  const ordem = generateSmartLayout(comoPhoto, fotos.length).flatMap((p) => p.fotoIds)
  return ordem.map((id) => porId.get(id)).filter((f): f is FotoEditor => Boolean(f))
}

/** Quantas fotos em cada lâmina: segue o ritmo do estilo e fecha a conta com o total. */
function distribuir(total: number, laminas: number, ritmo: number[]): number[] {
  const base = Array.from({ length: laminas }, (_, i) => ritmo[i % ritmo.length])
  const soma = base.reduce((a, b) => a + b, 0)
  const fator = total / soma
  const alvo = base.map((b) => Math.max(1, Math.min(MAX_FOTOS_POR_LAMINA, Math.round(b * fator))))
  let diferenca = total - alvo.reduce((a, b) => a + b, 0)
  for (let i = 0; diferenca !== 0 && i < laminas * 20; i++) {
    const k = i % laminas
    if (diferenca > 0 && alvo[k] < MAX_FOTOS_POR_LAMINA) {
      alvo[k]++
      diferenca--
    } else if (diferenca < 0 && alvo[k] > 1) {
      alvo[k]--
      diferenca++
    }
  }
  return alvo
}

/**
 * Primeira proposta editável do álbum inteiro: a ordem editorial decide quais
 * fotos vão em cada lâmina (no ritmo do estilo) e escolhemos a melhor grade.
 */
export function preencherAutomaticamente(
  fotos: FotoEditor[],
  laminasDesejadas: number,
  g: Geometria,
  primeiraEhCapa: boolean,
  estilo: Estilo = ESTILOS[0],
): DocumentoAlbum {
  const ordenadas = ordenarFotos(fotos)
  const n = Math.max(1, Math.min(laminasDesejadas, ordenadas.length || 1))
  const contagens = ordenadas.length > 0 ? distribuir(ordenadas.length, n, estilo.ritmo) : []
  let cursor = 0
  const laminas: LaminaDoc[] = contagens.map((qtd) => {
    const escolhidas = ordenadas.slice(cursor, cursor + qtd)
    cursor += qtd
    const [melhor] = variantesDeLayout(escolhidas, g, 1, estilo)
    return { ...novaLamina(estilo.fundo), quadros: melhor ? melhor.quadros.map((q) => ({ ...q, id: novoId() })) : [] }
  })
  // Pediu mais lâminas que fotos: completa com lâminas vazias.
  while (laminas.length < laminasDesejadas) laminas.push(novaLamina(estilo.fundo))
  const capa = primeiraEhCapa ? [novaLamina(estilo.fundo)] : []
  return { versao: 1, laminas: [...capa, ...laminas], primeiraEhCapa }
}

/** Preenche só os quadros vazios (de um modelo), na ordem editorial, casando proporções por lâmina. */
export function preencherQuadrosVazios(doc: DocumentoAlbum, fotos: FotoEditor[]): DocumentoAlbum {
  const usadas = new Set(doc.laminas.flatMap((l) => l.quadros.map((q) => q.fotoId).filter(Boolean)))
  const fila = ordenarFotos(fotos.filter((f) => !usadas.has(f.id)))
  return {
    ...doc,
    laminas: doc.laminas.map((l) => {
      const vazios = l.quadros.filter((q) => !q.fotoId)
      if (vazios.length === 0 || fila.length === 0) return l
      const escolhidas = fila.splice(0, vazios.length)
      const alvo = vazios.slice(0, escolhidas.length)
      const r = casar(alvo, escolhidas)
      const porId = new Map(alvo.map((q, i) => [q.id, r.quadros[i]]))
      return {
        ...l,
        quadros: l.quadros.map((q) => {
          const novo = porId.get(q.id)
          return novo ? { ...q, fotoId: novo.fotoId, recorte: novo.recorte } : q
        }),
      }
    }),
  }
}

export function temQuadrosVazios(doc: DocumentoAlbum) {
  return doc.laminas.some((l) => l.quadros.some((q) => !q.fotoId))
}

/* --------------------------- modelos de álbum --------------------------- */

export const CATEGORIAS = ['Casamento', 'Família', 'Infantil', '15 anos', 'Formatura', 'Corporativo', 'Viagem', 'Eventos', 'Editorial', 'Minimalista', 'Clássico', 'Moderno'] as const

export type ModeloAlbum = {
  id: string
  nome: string
  categoria: (typeof CATEGORIAS)[number]
  estilo: EstiloId
  laminas: number
  capa: boolean
  descricao: string
}

export const MODELOS_DE_ALBUM: ModeloAlbum[] = [
  { id: 'casamento-classico', nome: 'Casamento Clássico', categoria: 'Casamento', estilo: 'classico', laminas: 30, capa: true, descricao: 'Narrativa completa do dia, grades equilibradas.' },
  { id: 'casamento-editorial', nome: 'Casamento Editorial', categoria: 'Casamento', estilo: 'editorial', laminas: 24, capa: true, descricao: 'Panorâmicas e destaques, ritmo de revista.' },
  { id: 'casamento-clean', nome: 'Casamento Clean', categoria: 'Casamento', estilo: 'clean', laminas: 20, capa: true, descricao: 'Respiro e poucas fotos por lâmina.' },
  { id: 'infantil-alegre', nome: 'Infantil Alegre', categoria: 'Infantil', estilo: 'moderno', laminas: 15, capa: true, descricao: 'Mosaicos cheios de momentos.' },
  { id: 'infantil-suave', nome: 'Infantil Suave', categoria: 'Infantil', estilo: 'clean', laminas: 12, capa: true, descricao: 'Delicado, margens largas.' },
  { id: 'familia-classico', nome: 'Família Clássico', categoria: 'Família', estilo: 'classico', laminas: 15, capa: true, descricao: 'Retratos e grupos em grades.' },
  { id: 'familia-editorial', nome: 'Família Editorial', categoria: 'Família', estilo: 'editorial', laminas: 15, capa: true, descricao: 'Ensaio com cara de revista.' },
  { id: '15anos-editorial', nome: '15 anos Editorial', categoria: '15 anos', estilo: 'editorial', laminas: 20, capa: true, descricao: 'Ensaio + festa, panorâmicas.' },
  { id: '15anos-moderno', nome: '15 anos Moderno', categoria: '15 anos', estilo: 'moderno', laminas: 20, capa: true, descricao: 'Fundo escuro, mosaicos da pista.' },
  { id: 'corporativo-clean', nome: 'Corporativo Clean', categoria: 'Corporativo', estilo: 'clean', laminas: 12, capa: true, descricao: 'Sóbrio, institucional.' },
  { id: 'viagem-editorial', nome: 'Viagem Editorial', categoria: 'Viagem', estilo: 'editorial', laminas: 20, capa: true, descricao: 'Paisagens sangrando a lâmina.' },
  { id: 'viagem-mosaico', nome: 'Viagem Mosaico', categoria: 'Viagem', estilo: 'moderno', laminas: 15, capa: true, descricao: 'Muitos lugares por lâmina.' },
  { id: 'formatura-classico', nome: 'Formatura Clássico', categoria: 'Formatura', estilo: 'classico', laminas: 20, capa: true, descricao: 'Colação, baile e turma.' },
  { id: 'eventos-mosaico', nome: 'Eventos Mosaico', categoria: 'Eventos', estilo: 'moderno', laminas: 15, capa: false, descricao: 'Cobertura densa do evento.' },
  { id: 'minimalista-01', nome: 'Minimalista 01', categoria: 'Minimalista', estilo: 'minimalista', laminas: 20, capa: true, descricao: 'Uma foto por página, muito branco.' },
  { id: 'classico-01', nome: 'Clássico 01', categoria: 'Clássico', estilo: 'classico', laminas: 25, capa: true, descricao: 'O álbum atemporal.' },
  { id: 'editorial-01', nome: 'Editorial 01', categoria: 'Editorial', estilo: 'editorial', laminas: 24, capa: true, descricao: 'Revista: sangrias e detalhes.' },
  { id: 'casamento-luxo', nome: 'Casamento Luxo', categoria: 'Casamento', estilo: 'luxo', laminas: 25, capa: true, descricao: 'Marfim, destaques únicos, tipografia clássica.' },
  { id: '15anos-luxo', nome: '15 anos Luxo', categoria: '15 anos', estilo: 'luxo', laminas: 20, capa: true, descricao: 'Elegante, com muito respiro.' },
  { id: 'moderno-01', nome: 'Moderno 01', categoria: 'Moderno', estilo: 'moderno', laminas: 20, capa: true, descricao: 'Mosaicos, fundo escuro, ritmo rápido.' },
  { id: 'moderno-clean', nome: 'Moderno Clean', categoria: 'Moderno', estilo: 'clean', laminas: 18, capa: true, descricao: 'Contemporâneo e arejado.' },
]

export function modeloPorId(id: string | null | undefined) {
  return MODELOS_DE_ALBUM.find((m) => m.id === id) ?? null
}

/** Fotos de mentira só para desenhar os quadros do modelo (alternando horizontal e vertical). */
function fotosFantasma(n: number, seed: number): FotoEditor[] {
  return Array.from({ length: n }, (_, i) => {
    const vertical = (i + seed) % 3 === 1
    return { id: `__vazio_${i}`, url: '', nome: '', largura: vertical ? 4000 : 6000, altura: vertical ? 6000 : 4000 }
  })
}

/** Grades com quadros vazios para N fotos (página "com layout", aplicar layout vazio). */
export function layoutsVazios(n: number, g: Geometria, estilo?: Estilo, limite = 5): Variante[] {
  return variantesDeLayout(fotosFantasma(n, 0), g, limite, estilo).map((v) => ({
    ...v,
    quadros: v.quadros.map((q) => ({ ...q, id: novoId(), fotoId: null })),
  }))
}

function texto(estilo: Estilo, conteudo: string, x: number, y: number, w: number, tamanho: number, extra: Partial<ReturnType<typeof textoNovo>> = {}) {
  return { ...textoNovo(x, y, w, conteudo), fonte: estilo.fonteTitulo, tamanho, cor: estilo.corTexto, ...extra }
}

/**
 * Álbum "pré-configurado" no estilo do modelo: capa com título, lâmina de
 * abertura (texto + foto), miolo no ritmo do estilo e encerramento — tudo
 * com quadros vazios, prontos para receber as fotos (ou o "Preencher").
 */
export function documentoDoModelo(modelo: ModeloAlbum, laminas: number, g: Geometria, titulo = 'Título do álbum'): DocumentoAlbum {
  const estilo = estiloPorId(modelo.estilo)
  const m = Math.max(g.margem + estilo.margemExtra, 12)
  const vazios = (qtd: number, semente: number) => {
    const [v] = variantesDeLayout(fotosFantasma(qtd, semente), g, 1, estilo)
    return (v?.quadros ?? []).map((q) => ({ ...q, id: novoId(), fotoId: null }))
  }
  const total = Math.max(1, laminas)
  const lista: LaminaDoc[] = Array.from({ length: total }, (_, i) => {
    const l = novaLamina(estilo.fundo)
    if (total >= 3 && i === 0) {
      // Abertura: título na página esquerda, uma foto na direita.
      const q = quadroNovo(g.paginaW + m, m, g.paginaW - 2 * m, g.laminaH - 2 * m)
      return {
        ...l,
        quadros: [q],
        textos: [
          texto(estilo, titulo, m, g.laminaH / 2 - 20, g.paginaW - 2 * m, 40),
          texto(estilo, 'Data · local', m, g.laminaH / 2 + 12, g.paginaW - 2 * m, 12, { fonte: estilo.fonteTexto, entreLetras: 200 }),
        ],
      }
    }
    if (total >= 3 && i === total - 1) {
      // Encerramento: uma foto na página esquerda, frase na direita.
      const q = quadroNovo(m, m, g.paginaW - 2 * m, g.laminaH - 2 * m)
      return { ...l, quadros: [q], textos: [texto(estilo, 'Para sempre', g.paginaW + m, g.laminaH / 2 - 12, g.paginaW - 2 * m, 28, { italico: true })] }
    }
    return { ...l, quadros: vazios(estilo.ritmo[i % estilo.ritmo.length], i) }
  })
  const capa: LaminaDoc[] = modelo.capa
    ? [
        {
          ...novaLamina(estilo.fundo),
          // Capa: frente na página direita (foto + título), verso liso.
          quadros: [quadroNovo(g.paginaW + m, m, g.paginaW - 2 * m, (g.laminaH - 2 * m) * 0.7)],
          textos: [texto(estilo, titulo, g.paginaW + m, m + (g.laminaH - 2 * m) * 0.7 + 12, g.paginaW - 2 * m, 30)],
        },
      ]
    : []
  return { versao: 1, laminas: [...capa, ...lista], primeiraEhCapa: modelo.capa }
}
