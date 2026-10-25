'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, MapPin, MessageSquare, PencilLine, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { Flipbook } from '@/components/album-editor/flipbook'
import { comentarNoAlbum, decidirAlbum } from '@/lib/actions/album-aprovacao-publica'
import { cn, formatDate } from '@/lib/utils'

export type AlbumPublico = {
  token: string
  numero: number
  status: 'aguardando' | 'aprovado' | 'alteracoes' | 'cancelado'
  nome: string
  cliente: string | null
  laminas: { url: string | null; rotulo: string; largura: number; altura: number }[]
  mensagemCliente: string | null
  decididoPorNome: string | null
  decididoEm: string | null
  comentarios: { id: string; laminaIndice: number; x: number | null; y: number | null; texto: string; autor: string; origem: 'cliente' | 'equipe'; criadoEm: string }[]
}

const CHAVE_NOME = 'seualbum:nome-cliente'

// Nome lembrado neste aparelho, lido do localStorage sem efeito (null no servidor).
function assinarArmazenamento(aviso: () => void) {
  window.addEventListener('storage', aviso)
  return () => window.removeEventListener('storage', aviso)
}
function lerNomeSalvo(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_NOME)
  } catch {
    return null
  }
}

/**
 * O que o cliente vê pelo link: o álbum virando as páginas, comentários
 * presos ao ponto da lâmina (toque para marcar) e as duas decisões —
 * aprovar ou pedir alterações. Depois de responder, fica só leitura.
 */
export function AprovacaoCliente({ album }: { album: AlbumPublico }) {
  const router = useRouter()
  const [indice, setIndice] = useState(0)
  const [comentarios, setComentarios] = useState(album.comentarios)
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const [texto, setTexto] = useState('')
  // null = ainda não digitado aqui: vale o nome lembrado ou o do álbum.
  const [nomeDigitado, setNome] = useState<string | null>(null)
  const nomeSalvo = useSyncExternalStore(assinarArmazenamento, lerNomeSalvo, () => null)
  const nome = nomeDigitado ?? nomeSalvo ?? album.cliente ?? ''
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [decisao, setDecisao] = useState<'aprovado' | 'alteracoes' | null>(null)
  const [mensagem, setMensagem] = useState('')
  const aberto = album.status === 'aguardando'
  const primeiro = album.laminas[0]
  const proporcao = primeiro ? primeiro.largura / primeiro.altura : 2

  function lembrarNome(n: string) {
    setNome(n)
    try {
      window.localStorage.setItem(CHAVE_NOME, n)
    } catch {
      // Sem armazenamento local: pede o nome de novo na próxima vez.
    }
  }

  const daPagina = comentarios.filter((c) => c.laminaIndice === indice)
  const numeroDoPin = new Map(daPagina.filter((c) => c.x !== null).map((c, i) => [c.id, i + 1]))

  async function comentar() {
    if (!texto.trim() || !nome.trim()) return
    setEnviando(true)
    setErro(null)
    const r = await comentarNoAlbum(album.token, indice, pin?.x ?? null, pin?.y ?? null, texto, nome)
    setEnviando(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    setComentarios((cs) => [
      ...cs,
      { id: r.id, laminaIndice: indice, x: pin?.x ?? null, y: pin?.y ?? null, texto: texto.trim(), autor: nome.trim(), origem: 'cliente', criadoEm: new Date().toISOString() },
    ])
    setTexto('')
    setPin(null)
  }

  async function decidir() {
    if (!decisao || !nome.trim()) return
    setEnviando(true)
    setErro(null)
    const r = await decidirAlbum(album.token, decisao, nome, mensagem)
    setEnviando(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    setDecisao(null)
    router.refresh()
  }

  const status = {
    aguardando: { rotulo: 'Aguardando aprovação', classe: 'bg-amber-50 text-amber-800' },
    aprovado: { rotulo: 'Aprovado', classe: 'bg-emerald-50 text-emerald-700' },
    alteracoes: { rotulo: 'Alterações pedidas', classe: 'bg-sky-50 text-sky-700' },
    cancelado: { rotulo: 'Cancelado', classe: 'bg-red-50 text-red-700' },
  }[album.status]

  // As duas decisões são os únicos botões de destaque da tela.
  const acoes = (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        className="min-h-[48px] rounded-xl border-[#DDDDDD] bg-white text-[#171717] hover:bg-[#F5F5F5]"
        onClick={() => setDecisao('alteracoes')}
      >
        <PencilLine className="h-4 w-4" aria-hidden /> Pedir alterações
      </Button>
      <Button variant="brand" className="min-h-[48px] rounded-xl" onClick={() => setDecisao('aprovado')}>
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Aprovar
      </Button>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F5] text-[#171717] lg:h-screen">
      <header className="flex items-center gap-3 border-b border-[#EAEAEA] bg-white px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold sm:text-base">{album.nome}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#6B6B6B]">
            Versão {album.numero}
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', status.classe)}>{status.rotulo}</span>
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* No celular a lâmina ocupa só a altura dela; o resto da tela fica para comentários e decisão. */}
        <main className="flex min-w-0 flex-col lg:min-h-[60vh] lg:flex-1">
          <div className="lg:min-h-0 lg:flex-1">
            <Flipbook
              paginas={album.laminas.map((l) => ({ url: l.url, rotulo: l.rotulo }))}
              proporcao={proporcao}
              indice={indice}
              onIndice={(i) => {
                setIndice(i)
                setPin(null)
              }}
              sobreposicao={() => (
                <div
                  className={cn('absolute inset-0', aberto && 'cursor-crosshair')}
                  onClick={(e) => {
                    if (!aberto) return
                    const r = e.currentTarget.getBoundingClientRect()
                    setPin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
                  }}
                >
                  {daPagina
                    .filter((c) => c.x !== null && c.y !== null)
                    .map((c) => (
                      <span
                        key={c.id}
                        className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-xs font-bold text-[#171717] shadow-lg"
                        style={{ left: `${c.x}%`, top: `${c.y}%` }}
                        title={c.texto}
                      >
                        {numeroDoPin.get(c.id)}
                      </span>
                    ))}
                  {pin ? (
                    <span
                      className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-pulse items-center justify-center rounded-full border-2 border-dashed border-white bg-amber-400/80 shadow-lg"
                      style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    >
                      <MapPin className="h-3.5 w-3.5 text-[#171717]" aria-hidden />
                    </span>
                  ) : null}
                </div>
              )}
            />
          </div>
        </main>

        <aside className="flex w-full flex-col border-t border-[#EAEAEA] bg-white lg:w-96 lg:border-l lg:border-t-0">
          <div className="space-y-3 border-b border-[#EAEAEA] p-4">
            {album.status === 'aprovado' ? (
              <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Álbum aprovado por {album.decididoPorNome}
                {album.decididoEm ? ` em ${formatDate(album.decididoEm)}` : ''}. Obrigado!
              </p>
            ) : album.status === 'alteracoes' ? (
              <p className="flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-700">
                <PencilLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Alterações solicitadas por {album.decididoPorNome}. O designer vai preparar uma nova versão.
              </p>
            ) : (
              <>
                <p className="text-sm text-[#6B6B6B]">
                  Folheie o álbum. Toque num ponto da lâmina para comentar exatamente ali — depois aprove ou peça alterações.
                </p>
                <div className="hidden lg:block">{acoes}</div>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#9A9A9A]">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              {album.laminas[indice]?.rotulo ?? 'Página'} — comentários
            </p>
            {daPagina.length === 0 ? <p className="text-sm text-[#6B6B6B]">Nenhum comentário nesta página.</p> : null}
            {daPagina.map((c) => (
              <div
                key={c.id}
                className={cn('rounded-xl border p-3 text-sm', c.origem === 'equipe' ? 'border-sky-100 bg-sky-50' : 'border-[#EAEAEA] bg-white')}
              >
                <p className="flex items-start gap-2">
                  {numeroDoPin.get(c.id) ? (
                    <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-[#171717]">{numeroDoPin.get(c.id)}</span>
                  ) : null}
                  <span className="whitespace-pre-line [overflow-wrap:anywhere]">{c.texto}</span>
                </p>
                <p className="mt-1 text-xs text-[#9A9A9A]">
                  {c.origem === 'equipe' ? `${c.autor} (designer)` : c.autor} · {formatDate(c.criadoEm)}
                </p>
              </div>
            ))}
          </div>

          {aberto ? (
            <div className="space-y-2 border-t border-[#EAEAEA] p-4">
              {pin ? (
                <p className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> Ponto marcado na lâmina
                  </span>
                  <button
                    type="button"
                    onClick={() => setPin(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-amber-800 hover:bg-amber-100"
                    aria-label="Tirar o ponto"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </p>
              ) : null}
              <input
                value={nome}
                onChange={(e) => lembrarNome(e.target.value)}
                placeholder="Seu nome"
                maxLength={80}
                className="w-full rounded-lg border border-[#DDDDDD] bg-white px-3 py-2 text-base text-[#171717] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#171717] sm:text-sm"
                aria-label="Seu nome"
              />
              <div className="flex gap-2">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Ex.: gostaria de trocar esta foto"
                  className="min-w-0 flex-1 resize-none rounded-lg border border-[#DDDDDD] bg-white px-3 py-2 text-base text-[#171717] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#171717] sm:text-sm"
                  aria-label="Comentário"
                />
                <Button
                  variant="brand"
                  size="icon"
                  className="h-11 w-11 shrink-0 self-end rounded-xl"
                  onClick={comentar}
                  disabled={enviando || !texto.trim() || !nome.trim()}
                  aria-label="Enviar comentário"
                >
                  <Send className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              {erro ? (
                <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {erro}
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>

      {/* Celular: as decisões ficam sempre à mão, presas na base da tela. */}
      {album.status !== 'aprovado' && album.status !== 'alteracoes' ? (
        <div className="sticky bottom-0 z-10 border-t border-[#EAEAEA] bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          {acoes}
        </div>
      ) : null}

      <Modal open={decisao !== null} onClose={() => !enviando && setDecisao(null)} title={decisao === 'aprovado' ? 'Aprovar o álbum?' : 'Pedir alterações'}>
        <div className="space-y-3 text-sm text-[#171717]">
          <p>
            {decisao === 'aprovado'
              ? 'Ao aprovar, o álbum segue para a finalização e a impressão. Depois disso não dá para comentar.'
              : `Você deixou ${comentarios.filter((c) => c.origem === 'cliente').length} comentário(s). Se quiser, acrescente uma mensagem geral para o designer.`}
          </p>
          <input value={nome} onChange={(e) => lembrarNome(e.target.value)} placeholder="Seu nome" maxLength={80} className="w-full rounded-xl border border-[#DDDDDD] bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#171717] sm:text-sm" aria-label="Seu nome" />
          {decisao === 'alteracoes' ? (
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} maxLength={2000} placeholder="Mensagem (opcional)" className="w-full rounded-xl border border-[#DDDDDD] bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#171717] sm:text-sm" />
          ) : null}
          {erro ? <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{erro}</p> : null}
          <div className={MODAL_ACOES}>
            <Button variant="outline" onClick={() => setDecisao(null)} disabled={enviando}>
              Voltar
            </Button>
            <Button variant="brand" onClick={decidir} disabled={enviando || !nome.trim()}>
              {enviando ? 'Enviando…' : decisao === 'aprovado' ? 'Sim, aprovar' : 'Enviar pedido de alterações'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
