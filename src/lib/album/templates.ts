import { novoId, quadroNovo, type FotoEditor, type Geometria, type LaminaDoc, type Quadro } from '@/lib/album/documento'
import { layoutsVazios, type Estilo } from '@/lib/album/modelos'

/**
 * Templates de lâmina: só GEOMETRIA (frações da lâmina aberta, de 0 a 1 —
 * vale para qualquer formato) e a assinatura de compatibilidade ("P-L-P").
 * Um template nunca guarda fotos; aplicar um template cria quadros e associa
 * as fotos a eles, com o enquadramento inicial pelo ponto de interesse.
 */

export type Orientacao = 'P' | 'L' | 'S'

export type QuadroDoTemplate = { x: number; y: number; w: number; h: number; raio?: number }

export type TemplateLamina = {
  id: string
  nome: string
  origem: 'padrao' | 'personalizado'
  quadros: QuadroDoTemplate[]
  assinatura: string
  nFotos: number
  favorito?: boolean
  usos?: number
  ultimoUso?: string | null
}

/** Faixa em que a proporção conta como quadrada. */
const QUADRADO_MIN = 0.95
const QUADRADO_MAX = 1.05

export function orientacaoDe(largura: number | null | undefined, altura: number | null | undefined): Orientacao {
  if (!largura || !altura) return 'L'
  const a = largura / altura
  if (a >= QUADRADO_MIN && a <= QUADRADO_MAX) return 'S'
  return a > 1 ? 'L' : 'P'
}

/** "P-L-P" — na ordem das fotos. Sem dimensão conhecida, conta como horizontal. */
export function assinaturaDasFotos(fotos: Pick<FotoEditor, 'largura' | 'altura'>[]) {
  return fotos.map((f) => orientacaoDe(f.largura, f.altura)).join('-')
}

/**
 * Ordem de leitura dos quadros: página esquerda antes da direita; dentro da
 * página, de cima para baixo e da esquerda para a direita (com tolerância
 * para quadros "na mesma linha").
 */
export function ordemDeLeitura<T extends { x: number; y: number; w: number; h: number }>(quadros: T[], paginaW: number): T[] {
  const pagina = (q: T) => (q.x + q.w / 2 < paginaW ? 0 : 1)
  return [...quadros].sort((a, b) => {
    if (pagina(a) !== pagina(b)) return pagina(a) - pagina(b)
    if (Math.abs(a.y - b.y) > Math.min(a.h, b.h) * 0.3) return a.y - b.y
    return a.x - b.x
  })
}

export function assinaturaDosQuadros(quadros: { x: number; y: number; w: number; h: number }[], paginaW: number) {
  return ordemDeLeitura(quadros, paginaW)
    .map((q) => orientacaoDe(q.w, q.h))
    .join('-')
}

/** "Salvar como template": a geometria da lâmina, sem as fotos. */
export function templateDaLamina(lamina: LaminaDoc, g: Geometria, nome: string): TemplateLamina | null {
  const visiveis = lamina.quadros.filter((q) => !q.oculto)
  if (visiveis.length === 0) return null
  const ordenados = ordemDeLeitura(visiveis, g.paginaW)
  return {
    id: novoId('tpl'),
    nome: nome.trim().slice(0, 80) || `Template ${visiveis.length} fotos`,
    origem: 'personalizado',
    quadros: ordenados.map((q) => ({ x: q.x / g.laminaW, y: q.y / g.laminaH, w: q.w / g.laminaW, h: q.h / g.laminaH, ...(q.raio ? { raio: q.raio } : {}) })),
    assinatura: assinaturaDosQuadros(ordenados, g.paginaW),
    nFotos: visiveis.length,
  }
}

/** Quadros (vazios) do template no tamanho desta lâmina, na ordem de leitura. */
export function quadrosDoTemplate(t: Pick<TemplateLamina, 'quadros'>, g: Geometria): Quadro[] {
  return t.quadros.map((f) => {
    const q = quadroNovo(f.x * g.laminaW, f.y * g.laminaH, f.w * g.laminaW, f.h * g.laminaH)
    q.raio = f.raio ?? 0
    return q
  })
}

function custoDeProporcao(q: { w: number; h: number }, f: Pick<FotoEditor, 'largura' | 'altura'>) {
  const aq = q.w / q.h
  const af = f.largura && f.altura ? f.largura / f.altura : 1.5
  return Math.abs(Math.log(aq / af))
}

/**
 * Aplica o template às fotos. `respeitarOrdem`: a 1ª foto vai no 1º quadro
 * (ordem de leitura), e assim por diante — a sequência da história manda.
 * Senão, casa proporções (a foto mais "deitada" no quadro mais largo).
 * Sobrando quadros, ficam vazios; sobrando fotos, ficam de fora.
 */
export function aplicarTemplate(t: Pick<TemplateLamina, 'quadros'>, g: Geometria, fotos: FotoEditor[], respeitarOrdem: boolean): Quadro[] {
  const quadros = ordemDeLeitura(quadrosDoTemplate(t, g), g.paginaW)
  const usar = fotos.slice(0, quadros.length)
  const colocar = (q: Quadro, f: FotoEditor) => ({ ...q, fotoId: f.id, recorte: { zoom: 1, cx: f.fx ?? 0.5, cy: f.fy ?? 0.5 } })
  if (respeitarOrdem) return quadros.map((q, i) => (usar[i] ? colocar(q, usar[i]) : q))
  const porQuadro = quadros.map((q, i) => ({ i, a: q.w / q.h })).sort((a, b) => a.a - b.a)
  const porFoto = [...usar].sort((a, b) => (a.largura && a.altura ? a.largura / a.altura : 1.5) - (b.largura && b.altura ? b.largura / b.altura : 1.5))
  const saida = [...quadros]
  // Com menos fotos que quadros, as fotos ficam nos quadros que mais combinam.
  const escolhidos = porQuadro.length > porFoto.length ? escolherQuadros(porQuadro, porFoto) : porQuadro
  escolhidos.forEach((pq, k) => {
    if (porFoto[k]) saida[pq.i] = colocar(quadros[pq.i], porFoto[k])
  })
  return saida
}

function escolherQuadros(porQuadro: { i: number; a: number }[], porFoto: FotoEditor[]) {
  // Para cada foto (em ordem de proporção), pega o quadro livre mais parecido.
  const livres = [...porQuadro]
  const saida: { i: number; a: number }[] = []
  for (const f of porFoto) {
    const af = f.largura && f.altura ? f.largura / f.altura : 1.5
    let melhor = 0
    livres.forEach((q, k) => {
      if (Math.abs(Math.log(q.a / af)) < Math.abs(Math.log(livres[melhor].a / af))) melhor = k
    })
    saida.push(livres.splice(melhor, 1)[0])
  }
  return saida.sort((a, b) => a.a - b.a)
}

export type Compatibilidade = { nivel: 'exata' | 'proporcao' | 'quantidade' | 'incompativel'; custo: number }

/**
 * Compatibilidade de um template com as fotos selecionadas:
 *   - `exata`: mesma assinatura, na mesma ordem (P-L-P = P-L-P);
 *   - `proporcao`: mesmas orientações em outra ordem (casa por proporção);
 *   - `quantidade`: mesma quantidade, orientações diferentes (vai cortar mais);
 *   - `incompativel`: quantidade diferente.
 */
export function compatibilidade(t: TemplateLamina, fotos: FotoEditor[], g: Geometria): Compatibilidade {
  if (t.nFotos !== fotos.length) return { nivel: 'incompativel', custo: Infinity }
  const assinatura = assinaturaDasFotos(fotos)
  const quadros = ordemDeLeitura(quadrosDoTemplate(t, g), g.paginaW)
  const custoEmOrdem = quadros.reduce((s, q, i) => s + custoDeProporcao(q, fotos[i]), 0)
  if (assinatura === t.assinatura) return { nivel: 'exata', custo: custoEmOrdem }
  const ordenar = (s: string) => s.split('-').sort().join('-')
  if (ordenar(assinatura) === ordenar(t.assinatura)) return { nivel: 'proporcao', custo: custoEmOrdem + 1 }
  return { nivel: 'quantidade', custo: custoEmOrdem + 3 }
}

export type FiltroTemplates = {
  aba: 'todos' | 'favoritos' | 'recentes' | 'personalizados'
  nFotos: number | null
  orientacao: 'P' | 'L' | 'S' | 'misto' | null
}

export function filtrarTemplates(templates: TemplateLamina[], f: FiltroTemplates): TemplateLamina[] {
  let lista = templates
  if (f.aba === 'favoritos') lista = lista.filter((t) => t.favorito)
  if (f.aba === 'personalizados') lista = lista.filter((t) => t.origem === 'personalizado')
  if (f.aba === 'recentes') lista = lista.filter((t) => t.ultimoUso).sort((a, b) => (b.ultimoUso ?? '').localeCompare(a.ultimoUso ?? ''))
  if (f.nFotos) lista = lista.filter((t) => t.nFotos === f.nFotos)
  if (f.orientacao) {
    lista = lista.filter((t) => {
      const tipos = new Set(t.assinatura.split('-'))
      return f.orientacao === 'misto' ? tipos.size > 1 : tipos.size === 1 && tipos.has(f.orientacao!)
    })
  }
  return lista
}

/** Biblioteca padrão: as melhores grades vazias de 1 a 12 fotos, como templates. */
export function bibliotecaPadrao(g: Geometria, estilo?: Estilo, porQuantidade = 4): TemplateLamina[] {
  const saida: TemplateLamina[] = []
  for (let n = 1; n <= 12; n++) {
    layoutsVazios(n, g, estilo, porQuantidade).forEach((v, i) => {
      const ordenados = ordemDeLeitura(v.quadros, g.paginaW)
      saida.push({
        id: `padrao-${n}-${i}`,
        nome: `${n} foto${n > 1 ? 's' : ''} · ${String(i + 1).padStart(2, '0')}`,
        origem: 'padrao',
        quadros: ordenados.map((q) => ({ x: q.x / g.laminaW, y: q.y / g.laminaH, w: q.w / g.laminaW, h: q.h / g.laminaH })),
        assinatura: assinaturaDosQuadros(ordenados, g.paginaW),
        nFotos: n,
      })
    })
  }
  return saida
}

/**
 * "Reorganizar": outras ordens das fotos selecionadas, com quantos templates
 * da biblioteca combinam exatamente com cada uma — para achar um template
 * sem tirar e pôr as fotos de novo. Até 6 fotos testa todas as ordens
 * distintas; acima disso, rotações e trocas de vizinhos.
 */
export function reorganizacoes(fotos: FotoEditor[], templates: TemplateLamina[], limite = 6): { ordem: string[]; assinatura: string; exatos: number }[] {
  const n = fotos.length
  if (n === 0) return []
  const ordens: FotoEditor[][] = []
  if (n <= 6) {
    const permutar = (resto: FotoEditor[], atual: FotoEditor[]) => {
      if (resto.length === 0) ordens.push(atual)
      else resto.forEach((f, i) => permutar([...resto.slice(0, i), ...resto.slice(i + 1)], [...atual, f]))
    }
    permutar(fotos, [])
  } else {
    for (let r = 0; r < n; r++) ordens.push([...fotos.slice(r), ...fotos.slice(0, r)])
    for (let i = 0; i < n - 1; i++) {
      const o = [...fotos]
      ;[o[i], o[i + 1]] = [o[i + 1], o[i]]
      ordens.push(o)
    }
  }
  const atual = assinaturaDasFotos(fotos)
  const porAssinatura = new Map<string, FotoEditor[]>()
  for (const o of ordens) {
    const a = assinaturaDasFotos(o)
    if (!porAssinatura.has(a)) porAssinatura.set(a, o)
  }
  return [...porAssinatura.entries()]
    .map(([assinatura, o]) => ({ ordem: o.map((f) => f.id), assinatura, exatos: templates.filter((t) => t.nFotos === n && t.assinatura === assinatura).length }))
    .sort((a, b) => Number(b.assinatura === atual) - Number(a.assinatura === atual) || b.exatos - a.exatos)
    .slice(0, limite)
}
