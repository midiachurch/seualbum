'use client'

import { useEffect, useState } from 'react'
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
  const [nome, setNome] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [decisao, setDecisao] = useState<'aprovado' | 'alteracoes' | null>(null)
  const [mensagem, setMensagem] = useState('')
  const aberto = album.status === 'aguardando'
  const primeiro = album.laminas[0]
  const proporcao = primeiro ? primeiro.largura / primeiro.altura : 2

  useEffect(() => {
    try {
      setNome(window.localStorage.getItem(CHAVE_NOME) ?? album.cliente ?? '')
    } catch {
      setNome(album.cliente ?? '')
    }
  }, [album.cliente])

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

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0A] text-white lg:h-screen lg:flex-row">
      <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col">
        <header className="border-b border-white/10 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-white/50">Aprovação do álbum · versão {album.numero}</p>
          <h1 className="truncate text-lg font-semibold">{album.nome}</h1>
        </header>
        <div className="min-h-0 flex-1">
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
                    className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-pulse items-center justify-center rounded-full border-2 border-dashed border-white bg-amber-400/80"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#171717]" aria-hidden />
                  </span>
                ) : null}
              </div>
            )}
          />
        </div>
      </div>

      <aside className="flex w-full flex-col border-t border-white/10 bg-[#111] lg:w-96 lg:border-l lg:border-t-0">
        <div className="space-y-3 border-b border-white/10 p-4">
          {album.status === 'aprovado' ? (
            <p className="flex items-start gap-2 rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Álbum aprovado por {album.decididoPorNome}
              {album.decididoEm ? ` em ${formatDate(album.decididoEm)}` : ''}. Obrigado!
            </p>
          ) : album.status === 'alteracoes' ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-200">
              <PencilLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Alterações solicitadas por {album.decididoPorNome}. O designer vai preparar uma nova versão.
            </p>
          ) : (
            <>
              <p className="text-sm text-white/70">
                Navegue pelas páginas. Toque num ponto da lâmina para comentar exatamente ali — depois aprove ou peça alterações.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="brand" className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => setDecisao('aprovado')}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Aprovar
                </Button>
                <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={() => setDecisao('alteracoes')}>
                  <PencilLine className="h-4 w-4" aria-hidden /> Pedir alterações
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {album.laminas[indice]?.rotulo ?? 'Página'} — comentários
          </p>
          {daPagina.length === 0 ? <p className="text-sm text-white/50">Nenhum comentário nesta página.</p> : null}
          {daPagina.map((c) => (
            <div key={c.id} className={cn('rounded-xl p-3 text-sm', c.origem === 'equipe' ? 'bg-sky-500/15' : 'bg-white/10')}>
              <p className="flex items-start gap-2">
                {numeroDoPin.get(c.id) ? (
                  <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-[#171717]">{numeroDoPin.get(c.id)}</span>
                ) : null}
                <span className="whitespace-pre-line [overflow-wrap:anywhere]">{c.texto}</span>
              </p>
              <p className="mt-1 text-xs text-white/50">
                {c.origem === 'equipe' ? `${c.autor} (designer)` : c.autor} · {formatDate(c.criadoEm)}
              </p>
            </div>
          ))}
        </div>

        {aberto ? (
          <div className="space-y-2 border-t border-white/10 p-4">
            {pin ? (
              <p className="flex items-center justify-between text-xs text-amber-300">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Ponto marcado na lâmina
                </span>
                <button type="button" onClick={() => setPin(null)} className="text-white/60" aria-label="Tirar o ponto">
                  <X className="h-3.5 w-3.5" />
                </button>
              </p>
            ) : null}
            <input
              value={nome}
              onChange={(e) => lembrarNome(e.target.value)}
              placeholder="Seu nome"
              maxLength={80}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm"
              aria-label="Seu nome"
            />
            <div className="flex gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Ex.: gostaria de trocar esta foto"
                className="min-w-0 flex-1 resize-none rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm"
                aria-label="Comentário"
              />
              <Button variant="brand" onClick={comentar} disabled={enviando || !texto.trim() || !nome.trim()} aria-label="Enviar comentário">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {erro ? (
              <p role="alert" className="flex items-start gap-1.5 text-xs text-red-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {erro}
              </p>
            ) : null}
          </div>
        ) : null}
      </aside>

      <Modal open={decisao !== null} onClose={() => !enviando && setDecisao(null)} title={decisao === 'aprovado' ? 'Aprovar o álbum?' : 'Pedir alterações'}>
        <div className="space-y-3 text-sm text-[#171717]">
          <p>
            {decisao === 'aprovado'
              ? 'Ao aprovar, o álbum segue para a finalização e a impressão. Depois disso não dá para comentar.'
              : `Você deixou ${comentarios.filter((c) => c.origem === 'cliente').length} comentário(s). Se quiser, acrescente uma mensagem geral para o designer.`}
          </p>
          <input value={nome} onChange={(e) => lembrarNome(e.target.value)} placeholder="Seu nome" maxLength={80} className="w-full rounded-xl border px-3 py-2" aria-label="Seu nome" />
          {decisao === 'alteracoes' ? (
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} maxLength={2000} placeholder="Mensagem (opcional)" className="w-full rounded-xl border px-3 py-2" />
          ) : null}
          {erro ? <p className="text-destructive">{erro}</p> : null}
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
