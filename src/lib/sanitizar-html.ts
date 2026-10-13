import sanitizeHtml from 'sanitize-html'

/**
 * Sanitização de HTML que vai para `dangerouslySetInnerHTML`. Roda no servidor
 * (queries, server actions e server components) — `sanitize-html` não depende
 * de DOM e não entra no bundle do navegador.
 *
 * Whitelists estritas: tudo o que não está listado some (a tag vira só o
 * texto; `<script>`, `<style>` e afins somem com o conteúdo).
 */

/** Só cor (hex/rgb), tamanho em px/em, família sans-serif e altura de linha — o que o gatilho usa. */
const ESTILOS_DO_GATILHO: sanitizeHtml.IOptions['allowedStyles'] = {
  '*': {
    color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i],
    'font-size': [/^\d{1,2}(?:\.\d+)?(?:px|em)$/],
    'font-family': [/^sans-serif$/],
    'line-height': [/^\d(?:\.\d+)?$/],
  },
}

/**
 * Corpo dos e-mails simulados (`comunicacoes_log.corpo_html`), montado pelo
 * gatilho `registrar_comunicacao_status` concatenando nomes digitados por
 * usuários (projeto, cliente, estúdio, itens da fatura). Só as tags que o
 * gatilho gera: div, p, strong, em, ul, li — e `style` com valores restritos.
 */
export function sanitizarHtmlComunicacao(html: string | null | undefined): string {
  return sanitizeHtml(html ?? '', {
    allowedTags: ['div', 'p', 'strong', 'em', 'ul', 'li', 'br'],
    allowedAttributes: { div: ['style'], p: ['style'] },
    allowedStyles: ESTILOS_DO_GATILHO,
    allowedSchemes: [],
    disallowedTagsMode: 'discard',
  })
}

/**
 * Conteúdo editorial do CMS (`paginas_conteudo.conteudo_html`), produzido pelo
 * `RichTextEditor` (contentEditable + execCommand: negrito, itálico, h2/h3,
 * lista, link) ou colado de outro lugar. Links só http(s)/mailto/tel e
 * relativos; imagens só http(s). Links externos ganham `rel="noopener
 * noreferrer"`.
 */
export function sanitizarHtmlPagina(html: string | null | undefined): string {
  return sanitizeHtml(html ?? '', {
    allowedTags: [
      'h2', 'h3', 'h4', 'p', 'br', 'hr', 'div', 'span', 'blockquote',
      'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sub', 'sup', 'code', 'pre',
      'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => {
        const attrs: sanitizeHtml.Attributes = { ...attribs }
        if (attrs.target && attrs.target !== '_blank') delete attrs.target
        if (attrs.target === '_blank' || /^https?:/i.test(attrs.href ?? '')) attrs.rel = 'noopener noreferrer'
        return { tagName, attribs: attrs }
      },
    },
  })
}
