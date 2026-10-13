import { describe, expect, it } from 'vitest'
import { sanitizarHtmlComunicacao, sanitizarHtmlPagina } from './sanitizar-html'

const RODAPE = '<p style="color:#595959;font-size:12px">Este é um e-mail simulado.</p>'

describe('sanitizarHtmlComunicacao (corpo do gatilho registrar_comunicacao_status)', () => {
  it('preserva o HTML que o gatilho gera', () => {
    const html =
      '<div style="font-family:sans-serif;color:#171717;line-height:1.5">' +
      '<p>Olá, Ana!</p><p>O álbum <strong>Casamento</strong> foi aprovado.</p>' +
      '<ul><li>2× Lâmina extra <em>(pedido do cliente — aguarda sua confirmação)</em></li></ul>' +
      RODAPE +
      '</div>'
    expect(sanitizarHtmlComunicacao(html)).toBe(html)
  })

  it('remove <img onerror> e <script> injetados pelo nome do projeto', () => {
    const nome = '<img src=x onerror="alert(1)"><script>alert(2)</script>Casamento'
    const r = sanitizarHtmlComunicacao(`<p>O álbum <strong>${nome}</strong> foi aprovado.</p>`)
    expect(r).toBe('<p>O álbum <strong>Casamento</strong> foi aprovado.</p>')
    expect(r).not.toMatch(/onerror|<script|<img|alert/)
  })

  it('não deixa passar links, nem javascript: em href', () => {
    const r = sanitizarHtmlComunicacao('<p><a href="javascript:alert(1)">clique</a></p>')
    expect(r).toBe('<p>clique</p>')
  })

  it('descarta atributos de evento e estilos fora da lista', () => {
    const r = sanitizarHtmlComunicacao(
      '<p onclick="x()" style="position:fixed;top:0;background:url(javascript:alert(1));color:#171717">oi</p>',
    )
    expect(r).toBe('<p style="color:#171717">oi</p>')
  })

  it('aguenta nulo', () => {
    expect(sanitizarHtmlComunicacao(null)).toBe('')
  })
})

describe('sanitizarHtmlPagina (CMS de páginas)', () => {
  it('preserva o que o editor produz', () => {
    const html =
      '<h2>Sobre</h2><h3>Quem somos</h3><p><b>Negrito</b> e <i>itálico</i>.</p>' +
      '<ul><li>Um</li><li>Dois</li></ul><p><a href="mailto:oi@seualbum.com.br">fale</a></p>'
    expect(sanitizarHtmlPagina(html)).toBe(html)
  })

  it('remove <img onerror>, <script> e iframes', () => {
    const r = sanitizarHtmlPagina(
      '<p>a</p><img src="https://midia.seualbum.com.br/a.jpg" onerror="alert(1)"><script>alert(2)</script><iframe src="https://evil.example"></iframe>',
    )
    expect(r).toBe('<p>a</p><img src="https://midia.seualbum.com.br/a.jpg" />')
  })

  it('tira href javascript:/data: e src não-http', () => {
    expect(sanitizarHtmlPagina('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>')
    expect(sanitizarHtmlPagina('<a href=" JaVaScRiPt:alert(1)">x</a>')).toBe('<a>x</a>')
    expect(sanitizarHtmlPagina('<a href="data:text/html,<script>alert(1)</script>">x</a>')).toBe('<a>x</a>')
    expect(sanitizarHtmlPagina('<img src="javascript:alert(1)">')).toBe('<img />')
    expect(sanitizarHtmlPagina('<img src="data:image/svg+xml;base64,PHN2Zz4=">')).toBe('<img />')
    expect(sanitizarHtmlPagina('<a href="//evil.example">x</a>')).toBe('<a>x</a>')
  })

  it('links externos ganham rel=noopener noreferrer; relativos ficam como estão', () => {
    expect(sanitizarHtmlPagina('<a href="https://exemplo.com" target="_blank">x</a>')).toBe(
      '<a href="https://exemplo.com" target="_blank" rel="noopener noreferrer">x</a>',
    )
    expect(sanitizarHtmlPagina('<a href="/planos">x</a>')).toBe('<a href="/planos">x</a>')
  })

  it('descarta style e classes', () => {
    expect(sanitizarHtmlPagina('<p style="position:fixed" class="x">oi</p>')).toBe('<p>oi</p>')
  })
})
