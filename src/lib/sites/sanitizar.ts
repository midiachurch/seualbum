import sanitizeHtml from 'sanitize-html'

/**
 * HTML dos blocos de texto/sobre. Lista branca estrita, igual à conferida pelo
 * banco (`_site_html`, migration 0070): sem imagens, estilos, scripts nem
 * atributos além de href/target/rel. Roda SEMPRE no servidor, ao salvar e de
 * novo ao renderizar (defesa em profundidade).
 */
export const TAGS_PERMITIDAS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4', 'blockquote']

const HREF_OK = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i

export function sanitizarHtmlSite(html: string | null | undefined): string {
  return sanitizeHtml(html ?? '', {
    allowedTags: TAGS_PERMITIDAS,
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => {
        const attrs: sanitizeHtml.Attributes = {}
        const href = (attribs.href ?? '').trim()
        if (HREF_OK.test(href)) {
          attrs.href = href
          if (/^https?:/i.test(href)) {
            attrs.target = '_blank'
            attrs.rel = 'noopener noreferrer'
          }
        }
        return { tagName, attribs: attrs }
      },
    },
  }).trim()
}

/** Texto puro de um trecho HTML (para pré-visualização/SEO). */
export function textoDeHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim()
}
