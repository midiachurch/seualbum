import { describe, expect, it } from 'vitest'
import { conteudoInicial } from './tipos'
import { urlDeSiteValida, validarConteudoSite } from './validar'

const M1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const doc = (blocos: unknown[], extra: Record<string, unknown> = {}) => ({ v: 1, paginas: [{ slug: 'inicio', titulo: 'Início', blocos }], ...extra })
const hero = (dados: Record<string, unknown> = {}, id = 'h1') => ({ id, tipo: 'hero', dados: { titulo: 'Olá', ...dados } })
const erros = (r: ReturnType<typeof validarConteudoSite>) => (r.ok ? [] : r.erros)

describe('validação do documento de site', () => {
  it('aceita o conteúdo inicial e um documento completo', () => {
    expect(validarConteudoSite(conteudoInicial('Estúdio Luz')).ok).toBe(true)
    const r = validarConteudoSite({
      v: 1, tema: { cor: '#112233', fonte: 'serif', modo: 'escuro' }, seo: { titulo: 'T', descricao: 'D', midia_id: M1 },
      paginas: [
        { slug: 'inicio', titulo: 'Início', blocos: [
          hero({ midia_id: M1, alt: 'Casal', cta_texto: 'Fale', cta_url: 'https://wa.me/5511999999999' }),
          { id: 't1', tipo: 'texto', dados: { html: '<p>Oi <strong>você</strong></p>' } },
          { id: 'g1', tipo: 'galeria', dados: { colunas: 3, itens: [{ midia_id: M1, alt: 'Foto 1' }] } },
          { id: 's1', tipo: 'servicos', dados: { itens: [{ nome: 'Ensaio', preco: 'R$ 500' }] } },
          { id: 'c1', tipo: 'contato', dados: { titulo: 'Contato', email: 'oi@exemplo.com.br' } },
          { id: 'a1', tipo: 'sobre', dados: { titulo: 'Sobre', html: '<p>Eu</p>' } },
          { id: 'd1', tipo: 'depoimentos', dados: { itens: [{ texto: 'Lindo', autor: 'Ana' }] } },
          { id: 'r1', tipo: 'rodape', dados: { texto: '© x', links: [{ rotulo: 'IG', url: 'https://instagram.com/x' }] } },
        ] },
        { slug: 'contato', titulo: 'Contato', blocos: [] },
      ],
    })
    expect(r.ok).toBe(true)
  })

  it('remove campos opcionais vazios em vez de gravar strings vazias', () => {
    const r = validarConteudoSite(doc([hero({ subtitulo: '', cta_texto: '', cta_url: '' })]))
    expect(r.ok && r.conteudo.paginas[0].blocos[0].dados).toEqual({ titulo: 'Olá' })
  })

  it.each([
    ['tipo desconhecido', doc([{ id: 'x', tipo: 'iframe', dados: {} }])],
    ['campo desconhecido no bloco', doc([hero({ html: '<b>x</b>' })])],
    ['campo desconhecido no documento', { ...doc([]), extra: 1 }],
    ['hero sem título', doc([{ id: 'h', tipo: 'hero', dados: {} }])],
    ['id de bloco inválido', doc([hero({}, 'Id Inválido!')])],
    ['ids repetidos', doc([hero({}, 'a'), hero({}, 'a')])],
    ['primeira página fora do padrão', { v: 1, paginas: [{ slug: 'home', titulo: 'x', blocos: [] }] }],
    ['páginas com o mesmo endereço', { v: 1, paginas: [{ slug: 'inicio', titulo: 'a', blocos: [] }, { slug: 'x', titulo: 'b', blocos: [] }, { slug: 'x', titulo: 'c', blocos: [] }] }],
    ['versão errada', { v: 2, paginas: [{ slug: 'inicio', titulo: 'x', blocos: [] }] }],
    ['sem páginas', { v: 1, paginas: [] }],
    ['cor inválida', doc([], { tema: { cor: 'vermelho' } })],
    ['contato sem canal', doc([{ id: 'c', tipo: 'contato', dados: { titulo: 'x' } }])],
    ['whatsapp com letras', doc([{ id: 'c', tipo: 'contato', dados: { titulo: 'x', whatsapp: '55 11 abc' } }])],
    ['botão incompleto', doc([hero({ cta_texto: 'Ir' })])],
  ])('rejeita: %s', (_nome, entrada) => {
    expect(validarConteudoSite(entrada).ok).toBe(false)
  })

  it('exige texto alternativo quando há imagem', () => {
    expect(erros(validarConteudoSite(doc([hero({ midia_id: M1 })]))).join(' ')).toContain('alt')
    expect(erros(validarConteudoSite(doc([{ id: 'g', tipo: 'galeria', dados: { itens: [{ midia_id: M1 }] } }]))).join(' ')).toContain('alt')
    expect(validarConteudoSite(doc([{ id: 'a', tipo: 'sobre', dados: { titulo: 'S', html: '<p>x</p>', midia_id: M1 } }])).ok).toBe(false)
  })

  it('só aceita imagem da biblioteca da organização quando a lista é informada', () => {
    const entrada = doc([hero({ midia_id: M1, alt: 'ok' })])
    expect(validarConteudoSite(entrada, new Set([M1])).ok).toBe(true)
    expect(validarConteudoSite(entrada, new Set(['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'])).ok).toBe(false)
    expect(validarConteudoSite(doc([hero({ midia_id: 'sites/outro/arquivo.jpg', alt: 'x' })])).ok).toBe(false)
  })

  it('limita tamanhos e quantidades', () => {
    expect(validarConteudoSite(doc([hero({ titulo: 'x'.repeat(121) })])).ok).toBe(false)
    expect(validarConteudoSite(doc(Array.from({ length: 41 }, (_, i) => hero({}, `h${i}`)))).ok).toBe(false)
    expect(validarConteudoSite({ v: 1, paginas: Array.from({ length: 11 }, (_, i) => ({ slug: i ? `p${i}` : 'inicio', titulo: 'x', blocos: [] })) }).ok).toBe(false)
  })
})

describe('sanitização de HTML dos blocos (XSS)', () => {
  const html = (h: string) => {
    const r = validarConteudoSite(doc([{ id: 't', tipo: 'texto', dados: { html: h } }]))
    return r.ok ? (r.conteudo.paginas[0].blocos[0].dados as { html: string }).html : null
  }

  it('remove <script> junto com o conteúdo', () => {
    expect(html('<p>oi</p><script>alert(1)</script>')).toBe('<p>oi</p>')
  })
  it('remove handlers de evento e imagens', () => {
    expect(html('<p onclick="x()">a</p>')).toBe('<p>a</p>')
    expect(html('<p>a</p><img src=x onerror=alert(1)>')).toBe('<p>a</p>')
  })
  it('neutraliza javascript:, data: e vbscript: em links', () => {
    expect(html('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>')
    expect(html('<a href="JaVaScRiPt:alert(1)">x</a>')).toBe('<a>x</a>')
    expect(html('<a href="data:text/html;base64,AAAA">x</a>')).toBe('<a>x</a>')
    expect(html('<a href="vbscript:x">x</a>')).toBe('<a>x</a>')
    expect(html('<a href="&#106;avascript:alert(1)">x</a>')).not.toMatch(/javascript/i)
  })
  it('descarta estilos, iframes, formulários e SVG', () => {
    expect(html('<p style="position:fixed">a</p>')).toBe('<p>a</p>')
    expect(html('<iframe src="https://x"></iframe><p>a</p>')).toBe('<p>a</p>')
    expect(html('<form action="/x"><input></form><p>a</p>')).toContain('<p>a</p>')
    expect(html('<svg onload=alert(1)></svg><p>a</p>')).toBe('<p>a</p>')
  })
  it('mantém links http(s) com rel seguro e abre em nova aba', () => {
    expect(html('<a href="https://exemplo.com.br/x?a=1&b=2">ok</a>')).toBe('<a href="https://exemplo.com.br/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">ok</a>')
  })
  it('escapa texto com < e > em vez de interpretá-lo', () => {
    const r = html('1 < 2 e 3 > 2')
    expect(r).not.toContain('<2')
    expect(r).toContain('&lt;')
  })
  it('o resultado sanitizado sempre passa na lista branca do banco', () => {
    const ataques = ['<script>1</script>', '<img src=x onerror=1>', '<a href="javascript:1" onclick="1">x</a>', '<p title="a=b c=d">x</p>', '<<script>script>1</script>']
    for (const a of ataques) {
      const out = html(a)
      expect(out === null || !/<\s*(script|img|iframe|svg)|\son[a-z]+\s*=|javascript:/i.test(out)).toBe(true)
    }
  })
})

describe('URLs de botões e links', () => {
  it.each(['https://a.com', 'http://a.com/x?y=1', 'mailto:oi@a.com', 'tel:+5511999999999', '/contato', '#contato', '/'])('aceita %s', (u) => {
    expect(urlDeSiteValida(u)).toBe(true)
  })
  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//evil.com', 'ftp://x.com', 'https://a.com/"onclick=', 'x y', 'vbscript:x', ''])('rejeita %s', (u) => {
    expect(urlDeSiteValida(u)).toBe(false)
  })
})
