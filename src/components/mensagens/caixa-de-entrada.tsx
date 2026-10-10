'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { useNaoLidas } from '@/components/mensagens/realtime'
import { tituloDaConversa, type ConversaResumo, type PerfilMensagens } from '@/lib/mensagens'
import { cn } from '@/lib/utils'

const QUANDO = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Caixa de entrada: lista de fios à esquerda e o fio aberto (`?c=`) à
 * direita. No celular, uma coisa de cada vez. A lista é do servidor; quando o
 * contador de não lidas muda (Realtime ou consulta periódica), a página é
 * recarregada para trazer prévias e contagens novas.
 */
export function CaixaDeEntrada({
  conversas,
  selecionadaId,
  perfil,
  hrefDe,
  hrefVoltar,
  vazio,
  children,
}: {
  conversas: ConversaResumo[]
  selecionadaId: string | null
  perfil: PerfilMensagens
  /** Link de cada fio (mantém os filtros da página). */
  hrefDe: Record<string, string>
  /** Link da lista sem fio aberto (botão "voltar" no celular). */
  hrefVoltar: string
  vazio: React.ReactNode
  /** O fio aberto (renderizado pela página). */
  children?: React.ReactNode
}) {
  const router = useRouter()
  const { versao } = useNaoLidas()
  const primeira = useRef(true)
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false
      return
    }
    router.refresh()
  }, [versao, router])

  return (
    <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
      <nav aria-label="Conversas" className={cn(selecionadaId ? 'hidden md:block' : 'block')}>
        {conversas.length === 0 ? (
          vazio
        ) : (
          <ul className="divide-y divide-[#EAEAEA] overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
            {conversas.map((c) => {
              const ativa = c.id === selecionadaId
              return (
                <li key={c.id}>
                  <Link
                    href={hrefDe[c.id] ?? '#'}
                    aria-current={ativa ? 'true' : undefined}
                    className={cn('flex flex-col gap-1 px-4 py-3 transition-colors', ativa ? 'bg-[#F5F5F5]' : 'hover:bg-[#FAFAFA]')}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('truncate text-sm', c.naoLidas > 0 ? 'font-semibold text-[#171717]' : 'font-medium text-[#444444]')}>
                        {tituloDaConversa(c, perfil)}
                      </span>
                      {c.naoLidas > 0 ? (
                        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#171717] px-1.5 text-[11px] font-bold text-white">
                          {c.naoLidas}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center justify-between gap-2 text-xs text-[#6B6B6B]">
                      <span className="truncate">{c.ultimaMensagemPrevia ?? 'Sem mensagens ainda'}</span>
                      {c.ultimaMensagemEm ? <span className="shrink-0">{QUANDO.format(new Date(c.ultimaMensagemEm))}</span> : null}
                    </span>
                    {perfil === 'equipe' && c.canal === 'cliente_estudio' ? (
                      <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        Interna · cliente ↔ estúdio
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      <section aria-label="Conversa aberta" className={cn(selecionadaId ? 'block' : 'hidden md:block')}>
        {selecionadaId ? (
          <div className="space-y-3">
            <Link href={hrefVoltar} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-[#595959] md:hidden">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Conversas
            </Link>
            {children}
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#DADADA] p-8 text-center text-sm text-[#6B6B6B]">
            <MessageSquare className="h-6 w-6" aria-hidden />
            Escolha uma conversa na lista.
          </div>
        )}
      </section>
    </div>
  )
}
