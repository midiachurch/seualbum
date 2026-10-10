'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { Info, Loader2, Send, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { avisarMensagensLidas, useMensagensAoVivo } from '@/components/mensagens/realtime'
import { apagarMensagem, enviarMensagem, listarMensagens, marcarComoLida } from '@/lib/actions/mensagens'
import {
  TAMANHO_MAXIMO_MENSAGEM,
  mesclarMensagens,
  rotuloDoAutor,
  type MensagemView,
  type OpcaoLamina,
  type PaginaDeMensagens,
  type PerfilMensagens,
} from '@/lib/mensagens'
import { cn } from '@/lib/utils'

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Um fio de mensagens: histórico paginado, envio, "apagar" da própria
 * mensagem, citação de lâmina e "Visto". Ao vivo pelo Realtime; sem ele,
 * consulta a cada 15s (aviso discreto no rodapé).
 */
export function ConversaThread({
  conversaId,
  meuId,
  perfil,
  inicial,
  somenteLeitura = false,
  aviso,
  laminas = [],
  className,
}: {
  conversaId: string
  meuId: string
  perfil: PerfilMensagens
  inicial: PaginaDeMensagens
  /** Equipe no fio do cliente: lê para suporte, não escreve. */
  somenteLeitura?: boolean
  /** Faixa informativa no topo (ex.: "Conversa interna do estúdio com o cliente"). */
  aviso?: string
  laminas?: OpcaoLamina[]
  className?: string
}) {
  const [mensagens, setMensagens] = useState<MensagemView[]>(inicial.mensagens)
  const [temMais, setTemMais] = useState(inicial.temMais)
  const [vistoAte, setVistoAte] = useState(inicial.vistoAte)
  const [texto, setTexto] = useState('')
  const [laminaId, setLaminaId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarApagar, setConfirmarApagar] = useState<string | null>(null)
  const [enviando, startEnvio] = useTransition()
  const [carregandoAntigas, startAntigas] = useTransition()
  const lista = useRef<HTMLDivElement>(null)
  const colarNoFim = useRef(true)

  const rotuloLamina = new Map(laminas.map((l) => [l.id, l.rotulo]))

  const marcarLida = useCallback(() => {
    if (document.visibilityState !== 'visible') return
    void marcarComoLida(conversaId).then((r) => r.ok && avisarMensagensLidas())
  }, [conversaId])

  // Abriu o fio = leu.
  useEffect(() => {
    marcarLida()
  }, [marcarLida])

  const receber = useCallback(
    (m: MensagemView) => {
      setMensagens((atuais) => mesclarMensagens(atuais, [m]))
      if (m.autorId !== meuId && !m.apagada) marcarLida()
    },
    [meuId, marcarLida],
  )
  const { aoVivo } = useMensagensAoVivo(conversaId, receber)

  // Sem Realtime: busca a página mais recente a cada 15s (com a aba visível).
  useEffect(() => {
    if (aoVivo) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void listarMensagens(conversaId).then((r) => {
        if (!r.ok) return
        setMensagens((atuais) => {
          const novasDeOutros = r.mensagens.some((m) => m.autorId !== meuId && !atuais.some((a) => a.id === m.id))
          if (novasDeOutros) marcarLida()
          return mesclarMensagens(atuais, r.mensagens)
        })
        setVistoAte(r.vistoAte)
      })
    }, 15_000)
    return () => clearInterval(id)
  }, [aoVivo, conversaId, meuId, marcarLida])

  // Rola para o fim quando chega mensagem e a pessoa já estava no fim.
  useLayoutEffect(() => {
    const el = lista.current
    if (el && colarNoFim.current) el.scrollTop = el.scrollHeight
  }, [mensagens])

  function aoRolar() {
    const el = lista.current
    if (el) colarNoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  function carregarAntigas() {
    const maisAntiga = mensagens[0]?.criadaEm
    if (!maisAntiga) return
    colarNoFim.current = false
    startAntigas(async () => {
      const r = await listarMensagens(conversaId, maisAntiga)
      if (!r.ok) return setErro(r.erro)
      setMensagens((atuais) => mesclarMensagens(atuais, r.mensagens))
      setTemMais(r.temMais)
    })
  }

  function enviar() {
    const corpo = texto.trim()
    if (!corpo || enviando) return
    setErro(null)
    colarNoFim.current = true
    startEnvio(async () => {
      const r = await enviarMensagem({ conversaId, corpo, laminaId: laminaId || null })
      if (!r.ok) return setErro(r.erro)
      setMensagens((atuais) => mesclarMensagens(atuais, [r.mensagem]))
      setTexto('')
      setLaminaId('')
      avisarMensagensLidas()
    })
  }

  function apagar(id: string) {
    setConfirmarApagar(null)
    void apagarMensagem(id).then((r) => {
      if (!r.ok) return setErro(r.erro)
      setMensagens((atuais) => mesclarMensagens(atuais, [r.mensagem]))
    })
  }

  const minhaUltima = [...mensagens].reverse().find((m) => m.autorId === meuId && !m.apagada)

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white', className)}>
      {aviso ? (
        <p className="flex items-start gap-2 border-b border-[#EAEAEA] bg-[#FAFAFA] px-4 py-2 text-xs text-[#595959]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {aviso}
        </p>
      ) : null}

      <div
        ref={lista}
        onScroll={aoRolar}
        className="flex max-h-[60vh] min-h-[240px] flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
        aria-label="Mensagens"
      >
        {temMais ? (
          <button
            type="button"
            onClick={carregarAntigas}
            disabled={carregandoAntigas}
            className="mx-auto min-h-[36px] rounded-full px-3 text-xs font-medium text-[#595959] hover:bg-[#F5F5F5]"
          >
            {carregandoAntigas ? 'Carregando…' : 'Carregar mensagens anteriores'}
          </button>
        ) : null}

        {mensagens.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-[#6B6B6B]">
            {somenteLeitura ? 'Nenhuma mensagem nesta conversa ainda.' : 'Nenhuma mensagem ainda. Escreva a primeira.'}
          </p>
        ) : null}

        {mensagens.map((m) => {
          if (m.tipo === 'sistema') {
            return (
              <p key={m.id} className="mx-auto max-w-sm rounded-full bg-[#F5F5F5] px-3 py-1 text-center text-xs text-[#595959]">
                {m.corpo} <span className="text-[#8A8A8A]">· {DATA_HORA.format(new Date(m.criadaEm))}</span>
              </p>
            )
          }
          const minha = m.autorId === meuId
          return (
            <div key={m.id} className={cn('group flex max-w-[85%] flex-col gap-1', minha ? 'self-end items-end' : 'self-start items-start')}>
              {minha ? null : <span className="px-1 text-xs font-medium text-[#595959]">{rotuloDoAutor(m, perfil)}</span>}
              <div
                className={cn(
                  'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm',
                  m.apagada
                    ? 'border border-dashed border-[#DADADA] bg-white italic text-[#8A8A8A]'
                    : minha
                      ? 'bg-[#171717] text-white'
                      : 'bg-[#F5F5F5] text-[#171717]',
                )}
              >
                {m.apagada ? 'Mensagem apagada' : m.corpo}
                {!m.apagada && m.laminaId ? (
                  <span
                    className={cn(
                      'mt-1.5 block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold not-italic',
                      minha ? 'bg-white/15 text-white' : 'bg-white text-[#444444]',
                    )}
                  >
                    {rotuloLamina.get(m.laminaId) ?? 'Lâmina citada'}
                  </span>
                ) : null}
              </div>
              <span className="flex items-center gap-2 px-1 text-[11px] text-[#8A8A8A]">
                {DATA_HORA.format(new Date(m.criadaEm))}
                {minha && m.id === minhaUltima?.id && vistoAte && vistoAte >= m.criadaEm ? <span>· Visto</span> : null}
                {minha && !m.apagada && !somenteLeitura ? (
                  confirmarApagar === m.id ? (
                    <span className="flex items-center gap-1">
                      · Apagar?
                      <button type="button" onClick={() => apagar(m.id)} className="font-semibold text-[#171717] underline">
                        Sim
                      </button>
                      <button type="button" onClick={() => setConfirmarApagar(null)} className="underline">
                        Não
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmarApagar(m.id)}
                      className="opacity-100 underline-offset-2 hover:underline sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    >
                      Apagar
                    </button>
                  )
                ) : null}
              </span>
            </div>
          )
        })}
      </div>

      {erro ? (
        <p role="alert" className="border-t border-[#EAEAEA] px-4 py-2 text-xs text-destructive">
          {erro}
        </p>
      ) : null}

      {somenteLeitura ? null : (
        <form
          className="space-y-2 border-t border-[#EAEAEA] p-3"
          onSubmit={(e) => {
            e.preventDefault()
            enviar()
          }}
        >
          <label htmlFor={`msg-${conversaId}`} className="sr-only">
            Mensagem
          </label>
          <textarea
            id={`msg-${conversaId}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                enviar()
              }
            }}
            maxLength={TAMANHO_MAXIMO_MENSAGEM}
            rows={2}
            placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {laminas.length > 0 ? (
              <select
                value={laminaId}
                onChange={(e) => setLaminaId(e.target.value)}
                aria-label="Citar uma lâmina"
                className="h-9 max-w-[60%] rounded-lg border border-input bg-background px-2 text-xs"
              >
                <option value="">Sem lâmina</option>
                {laminas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.rotulo}
                  </option>
                ))}
              </select>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              {aoVivo ? null : (
                <span className="flex items-center gap-1 text-[11px] text-[#8A8A8A]" title="Sem conexão ao vivo: atualizando a cada 15 segundos">
                  <WifiOff className="h-3 w-3" aria-hidden />
                  Atualização periódica
                </span>
              )}
              <Button type="submit" variant="brand" size="sm" disabled={enviando || !texto.trim()}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                Enviar
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
