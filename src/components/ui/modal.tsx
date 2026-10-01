'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn, rolagemSuave } from '@/lib/utils'

/**
 * Modal simples sem dependência externa (não há @radix-ui/react-dialog
 * instalado) — overlay + painel centralizado, fecha com Esc ou clique fora.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    // Sem isso a página de trás rola junto com o painel no celular.
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflowAnterior
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        // O teclado do iOS não encolhe a viewport: o campo focado numa folha
        // presa na base ficaria atrás dele. Espera o teclado subir e traz o
        // campo para o meio da área visível.
        onFocus={(e) => {
          const alvo = e.target
          if (alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement) {
            window.setTimeout(() => alvo.scrollIntoView({ block: 'center', behavior: rolagemSuave() }), 300)
          }
        }}
        className={cn(
          // text-[#171717] explícito: o Modal pode ser aberto de dentro de
          // telas com fundo escuro (ex.: a prova digital), e sem isso o
          // texto herdava branco-sobre-branco e ficava invisível.
          // dvh = altura visível real (barra do navegador aberta ou não);
          // safe-area = indicador de home do iPhone.
          // break-words + overflow-x-hidden: e-mail, link ou nome longo quebra
          // dentro da caixa em vez de empurrar a largura (e esconder botões).
          'max-h-[90dvh] w-full max-w-md overflow-y-auto overflow-x-hidden overscroll-contain break-words rounded-t-2xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[#171717] shadow-xl sm:rounded-2xl sm:pb-6',
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          {title ? <h2 className="min-w-0 break-words text-lg font-semibold tracking-tight">{title}</h2> : <span />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Rodapé de ações dos diálogos. No celular os botões empilham em largura
 * total (o principal por cima, ao alcance do polegar) e o texto quebra em
 * vez de vazar — "Enviar solicitações para a equipe" não cabia lado a lado
 * com "Continuar revisando" em 375px. No desktop, alinhados à direita.
 */
export const MODAL_ACOES =
  'flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end [&>*]:min-h-[44px] [&>*]:w-full [&>*]:whitespace-normal [&>*]:text-center sm:[&>*]:w-auto'
