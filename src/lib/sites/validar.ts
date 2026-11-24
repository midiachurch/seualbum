import { sanitizarHtmlSite } from './sanitizar'
import { LIMITES_SITE, type ConteudoSite } from './tipos'

/**
 * Validação + normalização do documento de site no servidor, ANTES de gravar.
 * Espelha `_site_validar_conteudo` (migration 0070), que continua sendo a
 * autoridade: aqui se dá a mensagem útil e se sanitiza o HTML; o banco recusa
 * o que escapar. Campos opcionais vazios são removidos; campos desconhecidos
 * são rejeitados (não se descarta em silêncio).
 */
export type ResultadoValidacao = { ok: true; conteudo: ConteudoSite } | { ok: false; erros: string[] }

type Obj = Record<string, unknown>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ID_BLOCO = /^[a-z0-9][a-z0-9-]{0,39}$/
const SLUG_PAGINA = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/
const COR = /^#[0-9a-fA-F]{6}$/
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[^\s@<>"']{2,}$/
const URL_OK = /^(https?:\/\/[^\s<>"']{3,255}|mailto:[^\s<>"']{3,200}|tel:[0-9+() -]{3,30}|\/[^/\s<>"'][^\s<>"']{0,250}|\/|#[a-z0-9_-]{1,60})$/i
const CONTROLE = /[\x00-\x08\x0b\x0c\x0e-\x1f]/

export const urlDeSiteValida = (url: string) => URL_OK.test(url)

const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

class Coletor {
  erros: string[] = []
  falha(caminho: string, msg: string) { this.erros.push(`${caminho}: ${msg}`) }
  chaves(o: unknown, permitidas: string[], c: string): o is Obj {
    if (!ehObj(o)) { this.falha(c, 'formato inválido'); return false }
    for (const k of Object.keys(o)) if (!permitidas.includes(k)) this.falha(c, `campo desconhecido "${k}"`)
    return true
  }
  /** Texto simples. Vazio/ausente = undefined (erro se `min > 0`). */
  texto(o: Obj, k: string, min: number, max: number, c: string): string | undefined {
    const v = o[k]
    if (v === undefined || v === null || v === '') {
      if (min > 0) this.falha(`${c}.${k}`, 'obrigatório')
      return undefined
    }
    if (typeof v !== 'string') { this.falha(`${c}.${k}`, 'deve ser texto'); return undefined }
    const t = v.trim()
    if (t.length < min || v.length > max || CONTROLE.test(v)) { this.falha(`${c}.${k}`, `use de ${min} a ${max} caracteres`); return undefined }
    return t
  }
  url(o: Obj, k: string, obrig: boolean, c: string): string | undefined {
    const t = this.texto(o, k, obrig ? 1 : 0, 255, c)
    if (t !== undefined && !URL_OK.test(t)) { this.falha(`${c}.${k}`, 'link inválido (use https://, mailto:, tel: ou um caminho do site)'); return undefined }
    return t
  }
  html(o: Obj, k: string, min: number, c: string): string | undefined {
    const bruto = this.texto(o, k, min, 20000, c)
    if (bruto === undefined) return undefined
    const limpo = sanitizarHtmlSite(bruto)
    if (limpo.length < min || limpo.length > 5000) { this.falha(`${c}.${k}`, 'texto vazio ou longo demais (máx. 5000)'); return undefined }
    return limpo
  }
  lista(o: Obj, k: string, min: number, max: number, c: string): unknown[] {
    const v = o[k]
    if (v === undefined || v === null) { if (min > 0) this.falha(`${c}.${k}`, 'obrigatório'); return [] }
    if (!Array.isArray(v) || v.length < min || v.length > max) { this.falha(`${c}.${k}`, `use de ${min} a ${max} itens`); return [] }
    return v
  }
  midia(o: Obj, k: string, obrig: boolean, c: string, permitidas?: ReadonlySet<string>): string | undefined {
    const v = o[k]
    if (v === undefined || v === null || v === '') { if (obrig) this.falha(`${c}.${k}`, 'obrigatória'); return undefined }
    if (typeof v !== 'string' || !UUID.test(v) || (permitidas && !permitidas.has(v.toLowerCase()))) {
      this.falha(`${c}.${k}`, 'imagem inválida ou de outro estúdio'); return undefined
    }
    return v.toLowerCase()
  }
}

const limpar = <T extends Obj>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

function bloco(c: Coletor, b: unknown, cam: string, midias?: ReadonlySet<string>): Obj | null {
  if (!c.chaves(b, ['id', 'tipo', 'dados'], cam)) return null
  const id = typeof b.id === 'string' && ID_BLOCO.test(b.id) ? b.id : (c.falha(cam, 'identificador de bloco inválido'), '')
  if (!ehObj(b.dados)) { c.falha(cam, 'dados inválidos'); return null }
  const d = b.dados
  const k = `${cam}.dados`
  let dados: Obj | null = null
  switch (b.tipo) {
    case 'hero': {
      if (!c.chaves(d, ['titulo', 'subtitulo', 'midia_id', 'alt', 'cta_texto', 'cta_url'], k)) break
      const midia_id = c.midia(d, 'midia_id', false, k, midias)
      const cta_texto = c.texto(d, 'cta_texto', 0, 40, k); const cta_url = c.url(d, 'cta_url', false, k)
      if ((cta_texto === undefined) !== (cta_url === undefined)) c.falha(k, 'botão incompleto: informe texto e link')
      dados = limpar({ titulo: c.texto(d, 'titulo', 1, 120, k), subtitulo: c.texto(d, 'subtitulo', 0, 240, k), midia_id, alt: c.texto(d, 'alt', midia_id ? 1 : 0, 200, k), cta_texto, cta_url })
      if (!midia_id) delete dados.alt
      break
    }
    case 'texto':
      if (!c.chaves(d, ['titulo', 'html'], k)) break
      dados = limpar({ titulo: c.texto(d, 'titulo', 0, 120, k), html: c.html(d, 'html', 1, k) })
      break
    case 'sobre': {
      if (!c.chaves(d, ['titulo', 'html', 'midia_id', 'alt'], k)) break
      const midia_id = c.midia(d, 'midia_id', false, k, midias)
      dados = limpar({ titulo: c.texto(d, 'titulo', 1, 120, k), html: c.html(d, 'html', 1, k), midia_id, alt: c.texto(d, 'alt', midia_id ? 1 : 0, 200, k) })
      if (!midia_id) delete dados.alt
      break
    }
    case 'galeria': {
      if (!c.chaves(d, ['titulo', 'colunas', 'itens'], k)) break
      if (d.colunas !== undefined && ![2, 3, 4].includes(d.colunas as number)) c.falha(`${k}.colunas`, 'use 2, 3 ou 4')
      const itens = c.lista(d, 'itens', 1, 30, k).map((it, i) => {
        const ik = `${k}.itens[${i}]`
        if (!c.chaves(it, ['midia_id', 'alt', 'legenda'], ik)) return null
        return limpar({ midia_id: c.midia(it, 'midia_id', true, ik, midias), alt: c.texto(it, 'alt', 1, 200, ik), legenda: c.texto(it, 'legenda', 0, 200, ik) })
      })
      dados = limpar({ titulo: c.texto(d, 'titulo', 0, 120, k), colunas: d.colunas as number | undefined, itens })
      break
    }
    case 'servicos': {
      if (!c.chaves(d, ['titulo', 'itens'], k)) break
      const itens = c.lista(d, 'itens', 1, 12, k).map((it, i) => {
        const ik = `${k}.itens[${i}]`
        if (!c.chaves(it, ['nome', 'descricao', 'preco'], ik)) return null
        return limpar({ nome: c.texto(it, 'nome', 1, 80, ik), descricao: c.texto(it, 'descricao', 0, 300, ik), preco: c.texto(it, 'preco', 0, 40, ik) })
      })
      dados = limpar({ titulo: c.texto(d, 'titulo', 0, 120, k), itens })
      break
    }
    case 'contato': {
      if (!c.chaves(d, ['titulo', 'texto', 'email', 'telefone', 'whatsapp', 'instagram', 'cta_texto'], k)) break
      const email = c.texto(d, 'email', 0, 254, k)
      if (email !== undefined && !EMAIL.test(email)) c.falha(`${k}.email`, 'e-mail inválido')
      const telefone = c.texto(d, 'telefone', 0, 30, k)
      if (telefone !== undefined && !/^[0-9+() -]{6,30}$/.test(telefone)) c.falha(`${k}.telefone`, 'telefone inválido')
      const whatsapp = c.texto(d, 'whatsapp', 0, 15, k)
      if (whatsapp !== undefined && !/^[0-9]{10,15}$/.test(whatsapp)) c.falha(`${k}.whatsapp`, 'use só dígitos com DDI e DDD')
      const instagram = c.texto(d, 'instagram', 0, 30, k)
      if (instagram !== undefined && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) c.falha(`${k}.instagram`, 'usuário inválido (sem @)')
      if (!email && !telefone && !whatsapp && !instagram) c.falha(k, 'informe ao menos um canal de contato')
      dados = limpar({ titulo: c.texto(d, 'titulo', 1, 120, k), texto: c.texto(d, 'texto', 0, 500, k), email, telefone, whatsapp, instagram, cta_texto: c.texto(d, 'cta_texto', 0, 40, k) })
      break
    }
    case 'depoimentos': {
      if (!c.chaves(d, ['titulo', 'itens'], k)) break
      const itens = c.lista(d, 'itens', 1, 10, k).map((it, i) => {
        const ik = `${k}.itens[${i}]`
        if (!c.chaves(it, ['texto', 'autor', 'detalhe'], ik)) return null
        return limpar({ texto: c.texto(it, 'texto', 1, 500, ik), autor: c.texto(it, 'autor', 1, 80, ik), detalhe: c.texto(it, 'detalhe', 0, 80, ik) })
      })
      dados = limpar({ titulo: c.texto(d, 'titulo', 0, 120, k), itens })
      break
    }
    case 'rodape': {
      if (!c.chaves(d, ['texto', 'instagram', 'links'], k)) break
      const instagram = c.texto(d, 'instagram', 0, 30, k)
      if (instagram !== undefined && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) c.falha(`${k}.instagram`, 'usuário inválido (sem @)')
      const links = c.lista(d, 'links', 0, 6, k).map((it, i) => {
        const ik = `${k}.links[${i}]`
        if (!c.chaves(it, ['rotulo', 'url'], ik)) return null
        return limpar({ rotulo: c.texto(it, 'rotulo', 1, 40, ik), url: c.url(it, 'url', true, ik) })
      })
      dados = limpar({ texto: c.texto(d, 'texto', 0, 200, k), instagram, links: links.length ? links : undefined })
      break
    }
    default:
      c.falha(cam, 'tipo de bloco desconhecido')
  }
  return dados ? { id, tipo: b.tipo, dados } : null
}

/** `midiasPermitidas`: ids de mídia da organização (opcional; o banco confere de qualquer forma). */
export function validarConteudoSite(entrada: unknown, midiasPermitidas?: ReadonlySet<string>): ResultadoValidacao {
  const c = new Coletor()
  if (!c.chaves(entrada, ['v', 'tema', 'seo', 'paginas'], 'conteudo')) return { ok: false, erros: c.erros }
  if (entrada.v !== 1) c.falha('conteudo', 'versão do conteúdo inválida')
  if (JSON.stringify(entrada).length > LIMITES_SITE.bytes) c.falha('conteudo', 'conteúdo grande demais')

  let tema: Obj | undefined
  if (entrada.tema !== undefined && c.chaves(entrada.tema, ['cor', 'fonte', 'modo'], 'tema')) {
    const t = entrada.tema
    const cor = c.texto(t, 'cor', 0, 7, 'tema'); if (cor !== undefined && !COR.test(cor)) c.falha('tema.cor', 'use #RRGGBB')
    const fonte = c.texto(t, 'fonte', 0, 10, 'tema'); if (fonte !== undefined && !['sans', 'serif'].includes(fonte)) c.falha('tema.fonte', 'fonte inválida')
    const modo = c.texto(t, 'modo', 0, 10, 'tema'); if (modo !== undefined && !['claro', 'escuro'].includes(modo)) c.falha('tema.modo', 'modo inválido')
    tema = limpar({ cor, fonte, modo })
  }
  let seo: Obj | undefined
  if (entrada.seo !== undefined && c.chaves(entrada.seo, ['titulo', 'descricao', 'midia_id'], 'seo')) {
    const s = entrada.seo
    seo = limpar({ titulo: c.texto(s, 'titulo', 0, 70, 'seo'), descricao: c.texto(s, 'descricao', 0, 200, 'seo'), midia_id: c.midia(s, 'midia_id', false, 'seo', midiasPermitidas) })
  }

  const paginas: Obj[] = []
  const brutas = entrada.paginas
  if (!Array.isArray(brutas) || brutas.length < 1 || brutas.length > LIMITES_SITE.paginas) c.falha('paginas', `use de 1 a ${LIMITES_SITE.paginas} páginas`)
  else {
    const slugs = new Set<string>()
    brutas.forEach((p, i) => {
      const pk = `paginas[${i}]`
      if (!c.chaves(p, ['slug', 'titulo', 'blocos'], pk)) return
      const slug = c.texto(p, 'slug', 1, 40, pk)
      if (slug !== undefined && (!SLUG_PAGINA.test(slug) || (i === 0 && slug !== 'inicio') || slugs.has(slug))) c.falha(`${pk}.slug`, i === 0 ? 'a primeira página deve ser "inicio"' : 'endereço de página inválido ou repetido')
      if (slug) slugs.add(slug)
      const ids = new Set<string>()
      const blocos = c.lista(p, 'blocos', 0, LIMITES_SITE.blocosPorPagina, pk).map((b, j) => {
        const r = bloco(c, b, `${pk}.blocos[${j}]`, midiasPermitidas)
        if (r) { if (ids.has(r.id as string)) c.falha(`${pk}.blocos[${j}]`, 'identificador repetido'); ids.add(r.id as string) }
        return r
      })
      paginas.push({ slug, titulo: c.texto(p, 'titulo', 1, 60, pk), blocos })
    })
  }
  if (c.erros.length) return { ok: false, erros: c.erros }
  return { ok: true, conteudo: limpar({ v: 1 as const, tema, seo, paginas }) as unknown as ConteudoSite }
}
