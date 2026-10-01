'use client'

import { useEffect, useRef } from 'react'
import { Bold, Heading2, Heading3, Italic, Link2, List } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOOLBAR = [
  { command: 'bold', icon: Bold, label: 'Negrito' },
  { command: 'italic', icon: Italic, label: 'Itálico' },
  { command: 'formatBlock:h2', icon: Heading2, label: 'Título 2' },
  { command: 'formatBlock:h3', icon: Heading3, label: 'Título 3' },
  { command: 'insertUnorderedList', icon: List, label: 'Lista' },
] as const

/**
 * Editor rich-text caseiro (contentEditable + `document.execCommand`) — sem
 * adicionar uma dependência nova só para isto. `execCommand` está deprecated
 * na spec mas continua amplamente suportado nos navegadores para esse tipo de
 * edição básica, que é exatamente o escopo pedido ("editor de texto simples
 * ou Rich Text").
 *
 * Não controlado de propósito: o pai guarda `conteudoHtml` no próprio estado
 * e repassa como `initialValue`, então este componente re-renderiza a cada
 * tecla. Se o innerHTML fosse setado via `dangerouslySetInnerHTML` (uma prop
 * comum do React), o React reaplicaria essa prop sempre que a string mudasse
 * — ou seja, a cada tecla — reescrevendo o DOM inteiro e jogando o cursor de
 * volta pro início (o próximo caractere entra na posição 0, invertendo o
 * texto letra a letra). Por isso o innerHTML só é escrito uma vez, à mão, num
 * `useEffect` sem dependências — depois disso o navegador toma conta do
 * cursor sozinho. Quando o admin troca de página, passe uma `key` diferente
 * no componente pai para forçar remontagem.
 */
// Um <div contentEditable> totalmente vazio (innerHTML="") não tem nenhum nó
// de texto pra ancorar o cursor — o Chromium não estabiliza a posição do
// caret nesse estado e a digitação pode inserir cada caractere no início do
// nó anterior em vez de no fim, produzindo texto invertido. Um parágrafo
// vazio com <br> dá ao editor um nó real pra âncora desde o primeiro toque.
const CONTEUDO_VAZIO = '<p><br></p>'

export function RichTextEditor({
  initialValue,
  onChange,
  className,
}: {
  initialValue: string
  onChange: (html: string) => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- de propósito: só na montagem (ver comentário acima).
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialValue || CONTEUDO_VAZIO
  }, [])

  function exec(command: string) {
    ref.current?.focus()
    if (command.startsWith('formatBlock:')) {
      document.execCommand('formatBlock', false, command.split(':')[1])
    } else {
      document.execCommand(command)
    }
    onChange(ref.current?.innerHTML ?? '')
  }

  function insertLink() {
    const url = window.prompt('URL do link:')
    if (!url) return
    ref.current?.focus()
    document.execCommand('createLink', false, url)
    onChange(ref.current?.innerHTML ?? '')
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-input', className)}>
      <div className="flex flex-wrap gap-1 border-b bg-secondary/40 p-1.5">
        {TOOLBAR.map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(command)}
            aria-label={label}
            title={label}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
          aria-label="Link"
          title="Link"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Link2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => {
          const html = e.currentTarget.innerHTML
          onChange(html === CONTEUDO_VAZIO ? '' : html)
        }}
        className="prose-outbox min-h-[240px] max-w-none px-4 py-3 text-sm focus:outline-none"
      />
    </div>
  )
}
