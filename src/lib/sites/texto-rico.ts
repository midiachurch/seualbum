/**
 * Editor de texto simples do site (sem contentEditable): o estúdio escreve em
 * texto com marcações leves e o app gera o HTML restrito. Seguro por
 * construção — tudo é escapado antes de aplicar as marcações — e o servidor
 * sanitiza de novo ao salvar (sanitizarHtmlSite).
 *
 *   linha em branco = novo parágrafo     ## Título / ### Subtítulo
 *   - item de lista                      **negrito**   *itálico*
 *   [texto](https://endereco)  (também mailto: e tel:)
 */
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(linha: string): string {
  let t = escapar(linha)
  t = t.replace(/\[([^\]\n]{1,200})\]\(((?:https?:\/\/|mailto:|tel:)[^\s)]{3,250})\)/gi, '<a href="$2">$1</a>')
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  return t
}

export function textoParaHtml(texto: string): string {
  const blocos = texto.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/).filter((b) => b.trim())
  return blocos.map((bloco) => {
    const linhas = bloco.split('\n')
    if (linhas.every((l) => /^- /.test(l))) return `<ul>${linhas.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`
    if (/^### /.test(bloco)) return `<h3>${inline(bloco.slice(4).replace(/\n/g, ' '))}</h3>`
    if (/^## /.test(bloco)) return `<h2>${inline(bloco.slice(3).replace(/\n/g, ' '))}</h2>`
    return `<p>${linhas.map(inline).join('<br>')}</p>`
  }).join('')
}

const ENTIDADES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

export function htmlParaTexto(html: string): string {
  const t = html
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>(.*?)<\/\1>/gi, '*$2*')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h[34][^>]*>(.*?)<\/h[34]>/gi, '### $1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTIDADES[e] ?? e)
  return t.replace(/\n{3,}/g, '\n\n').trim()
}
