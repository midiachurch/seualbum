'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Check, CheckCircle2, Copy, ExternalLink, Loader2, MessageSquare, RotateCcw, Send, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { carregarImagem, renderizarLaminaParaTela } from '@/lib/album/exportar'
import {
  cancelarAprovacao,
  criarAprovacao,
  duplicarAlbum,
  enviarParaProducao,
  finalizarAlbum,
  listarAprovacoesAlbum,
  reabrirAlbum,
  renovarLinksDasFotos,
  resolverComentarioAlbum,
  responderComentarioAlbum,
} from '@/lib/actions/album-editor'
import { enviarArquivoAlbum } from '@/lib/upload-album'
import { rotuloDaLamina, type DocumentoAlbum, type Geometria } from '@/lib/album/documento'
import type { AprovacaoDoAlbum } from '@/lib/supabase/queries'
import type { StatusAlbum } from '@/types/database'
import { cn, formatDate } from '@/lib/utils'
import { novoUuid } from '@/store/usePedidoWizardStore'

export const ROTULO_STATUS: Record<StatusAlbum, string> = {
  rascunho: 'Rascunho',
  em_edicao: 'Em edição',
  enviado_aprovacao: 'Enviado para aprovação',
  alteracoes_solicitadas: 'Alterações solicitadas',
  em_revisao: 'Em revisão',
  aprovado: 'Aprovado',
  finalizado: 'Finalizado',
  em_producao: 'Em produção',
}

const LARGURA_APROVACAO_PX = 2400
const UPLOADS_SIMULTANEOS = 2

/**
 * Compartilhar / aprovação. Álbum avulso: gera as lâminas (como o cliente vê,
 * sem sangria), sobe e cria um link sem login; o cliente comenta por página,
 * aprova ou pede alterações, e tudo volta para cá. Álbum de projeto: a
 * aprovação acontece na prova da esteira (com login do cliente).
 */
export function AprovacaoPainel({
  aberto,
  onFechar,
  albumId,
  projetoId,
  status,
  documento,
  geometria,
  urls,
  antesDeEnviar,
  onStatus,
  onIrPara,
  erros,
}: {
  aberto: boolean
  onFechar: () => void
  albumId: string
  projetoId: string | null
  status: StatusAlbum
  documento: DocumentoAlbum
  geometria: Geometria
  urls: Map<string, string>
  antesDeEnviar: () => Promise<boolean>
  onStatus: (s: StatusAlbum) => void
  onIrPara: (lamina: number) => void
  /** Erros da verificação: impedem finalizar. */
  erros: number
}) {
  const router = useRouter()
  const [aprovacoes, setAprovacoes] = useState<AprovacaoDoAlbum[] | null>(null)
  const [progresso, setProgresso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [resposta, setResposta] = useState<Record<string, string>>({})

  async function carregar() {
    if (projetoId) return
    const r = await listarAprovacoesAlbum(albumId)
    if (r.ok) setAprovacoes(r.aprovacoes)
    else setErro(r.erro)
  }

  useEffect(() => {
    if (aberto) void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const linkDe = (token: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/album/${token}`

  async function enviar() {
    setErro(null)
    try {
      setProgresso('Salvando o álbum…')
      if (!(await antesDeEnviar())) throw new Error('Não foi possível salvar o álbum antes de enviar.')
      const links = await renovarLinksDasFotos(albumId)
      const mapa = new Map(urls)
      if (links.ok) for (const [id, u] of Object.entries(links.urls)) mapa.set(id, u)

      const aprovacaoId = novoUuid()
      const laminas: { path: string; largura: number; altura: number; rotulo: string }[] = []
      const fila: { i: number; blob: Blob; largura: number; altura: number }[] = []
      for (let i = 0; i < documento.laminas.length; i++) {
        setProgresso(`Gerando lâmina ${i + 1} de ${documento.laminas.length}…`)
        const cache = new Map<string, Promise<HTMLImageElement>>()
        const imagem = (fotoId: string) => {
          const u = mapa.get(fotoId)
          if (!u) return Promise.reject(new Error('Uma foto do álbum não foi encontrada.'))
          if (!cache.has(fotoId)) cache.set(fotoId, carregarImagem(u))
          return cache.get(fotoId)!
        }
        const r = await renderizarLaminaParaTela(documento.laminas[i], geometria, imagem, LARGURA_APROVACAO_PX)
        fila.push({ i, ...r })
      }
      let feitas = 0
      let falhou = false
      const pendentes = [...fila]
      await Promise.all(
        Array.from({ length: UPLOADS_SIMULTANEOS }, async () => {
          while (pendentes.length > 0 && !falhou) {
            const item = pendentes.shift()!
            // Lâmina no Cloudflare R2 (albuns/{albumId}/aprovacoes/{aprovacaoId}/001.jpg);
            // `criarAprovacao` confere cada uma no R2 antes de criar o link.
            let path: string
            try {
              path = await enviarArquivoAlbum(albumId, { destino: 'aprovacao', aprovacaoId, ordem: item.i + 1 }, item.blob)
            } catch {
              falhou = true
              return
            }
            laminas[item.i] = { path, largura: item.largura, altura: item.altura, rotulo: rotuloDaLamina(item.i, documento.primeiraEhCapa) }
            feitas++
            setProgresso(`Enviando ${feitas} de ${fila.length}…`)
          }
        }),
      )
      if (falhou) throw new Error('Uma lâmina não subiu. Confira a conexão e tente de novo.')
      setProgresso('Criando o link…')
      const r = await criarAprovacao(albumId, aprovacaoId, laminas)
      if (!r.ok) throw new Error(r.erro)
      onStatus('enviado_aprovacao')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.')
    } finally {
      setProgresso(null)
    }
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(linkDe(token))
      setCopiado(token)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      setErro('Não foi possível copiar — selecione o link e copie à mão.')
    }
  }

  if (projetoId) {
    return (
      <Modal open={aberto} onClose={onFechar} title="Compartilhar com o cliente">
        <div className="space-y-3 text-sm">
          <p>
            Este álbum é de um projeto da esteira: a aprovação acontece na <strong>prova</strong>, onde o cliente (com login) comenta com pins,
            pede ajustes e aprova — e a aprovação já dispara cobrança de extras e a produção.
          </p>
          <p className="text-muted-foreground">
            Use <strong>Publicar versão</strong> para gerar as lâminas desta diagramação como a próxima versão; ela passa pela revisão interna e depois
            é liberada para o cliente.
          </p>
          <Button asChild variant="outline">
            <Link href={`/admin/projetos/${projetoId}/prova`}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Abrir a prova do projeto
            </Link>
          </Button>
        </div>
      </Modal>
    )
  }

  const ativa = aprovacoes?.find((a) => a.status === 'aguardando') ?? null

  return (
    <Modal open={aberto} onClose={() => !progresso && onFechar()} title="Compartilhar e aprovação" className="sm:max-w-2xl">
      <div className="space-y-4 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          Status:
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">{ROTULO_STATUS[status]}</span>
        </p>

        {status === 'aprovado' || status === 'finalizado' || status === 'em_producao' ? (
          <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-emerald-900">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {status === 'aprovado'
                ? 'O cliente aprovou o álbum. A edição está travada.'
                : status === 'finalizado'
                  ? 'Álbum finalizado — versão final bloqueada.'
                  : 'Álbum em produção.'}
            </p>
            {(() => {
              const aprovada = aprovacoes?.find((a) => a.status === 'aprovado')
              return aprovada ? (
                <p className="text-xs">
                  Versão aprovada: {String(aprovada.numero).padStart(2, '0')} · por {aprovada.decididoPorNome} em{' '}
                  {aprovada.decididoEm ? new Date(aprovada.decididoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </p>
              ) : null
            })()}
            {status === 'aprovado' && erros > 0 ? (
              <p className="text-xs text-red-700">A verificação tem {erros} erro(s): corrija antes de finalizar (as correções reabrem o álbum).</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {status === 'aprovado' ? (
                <Button
                  size="sm"
                  variant="brand"
                  disabled={erros > 0}
                  onClick={async () => {
                    const r = await finalizarAlbum(albumId)
                    if (r.ok) onStatus('finalizado')
                    else setErro(r.erro)
                  }}
                >
                  <Check className="h-4 w-4" aria-hidden /> Finalizar álbum
                </Button>
              ) : null}
              {status === 'finalizado' ? (
                <Button
                  size="sm"
                  variant="brand"
                  onClick={async () => {
                    const r = await enviarParaProducao(albumId)
                    if (r.ok) onStatus('em_producao')
                    else setErro(r.erro)
                  }}
                >
                  <Send className="h-4 w-4" aria-hidden /> Encaminhar para produção
                </Button>
              ) : null}
              {status === 'aprovado' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!window.confirm('Reabrir para edição? A aprovação continua registrada, e o álbum volta para "Em revisão".')) return
                    const r = await reabrirAlbum(albumId)
                    if (r.ok) onStatus('em_revisao')
                    else setErro(r.erro)
                  }}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> Reabrir edição
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const r = await duplicarAlbum(albumId)
                    if (r.ok) router.push(`/admin/albuns/${r.id}`)
                    else setErro(r.erro)
                  }}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> Criar nova versão a partir desta
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Gera as lâminas como o cliente vai ver e cria um link de aprovação — o cliente abre sem precisar de conta, comenta em cada página, aprova ou
              pede alterações.{ativa ? ' Enviar de novo substitui o link atual.' : ''}
            </p>
            <Button variant="brand" onClick={enviar} disabled={progresso !== null}>
              {progresso ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {progresso ?? (ativa ? 'Enviar nova versão para aprovação' : 'Enviar para aprovação')}
            </Button>
          </div>
        )}

        {erro ? (
          <p role="alert" className="flex items-start gap-2 text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {erro}
          </p>
        ) : null}

        {aprovacoes === null ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando envios…
          </p>
        ) : (
          <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
            {aprovacoes.map((a) => {
              const porLamina = new Map<number, AprovacaoDoAlbum['comentarios']>()
              for (const c of a.comentarios) porLamina.set(c.laminaIndice, [...(porLamina.get(c.laminaIndice) ?? []), c])
              return (
                <li key={a.id} className={cn('rounded-xl border p-3', a.status === 'cancelado' && 'opacity-60')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      Envio {a.numero} · {formatDate(a.criadoEm)}
                    </p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        a.status === 'aprovado' && 'bg-emerald-100 text-emerald-800',
                        a.status === 'alteracoes' && 'bg-amber-100 text-amber-900',
                        a.status === 'aguardando' && 'bg-sky-100 text-sky-900',
                        a.status === 'cancelado' && 'bg-secondary',
                      )}
                    >
                      {{ aguardando: 'Aguardando o cliente', aprovado: 'Aprovado', alteracoes: 'Alterações solicitadas', cancelado: 'Substituído' }[a.status]}
                    </span>
                  </div>
                  {a.status === 'aguardando' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1 text-xs">{linkDe(a.token)}</code>
                      <Button size="sm" variant="outline" onClick={() => copiar(a.token)}>
                        {copiado === a.token ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                        {copiado === a.token ? 'Copiado' : 'Copiar link'}
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={linkDe(a.token)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" aria-hidden /> Abrir
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const r = await cancelarAprovacao(albumId, a.id)
                          if (r.ok) {
                            onStatus('em_edicao')
                            void carregar()
                          } else setErro(r.erro)
                        }}
                      >
                        <XCircle className="h-4 w-4" aria-hidden /> Cancelar link
                      </Button>
                    </div>
                  ) : null}
                  {a.decididoEm ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {a.status === 'aprovado' ? 'Aprovado' : 'Alterações pedidas'} por {a.decididoPorNome} em {formatDate(a.decididoEm)}
                      {a.mensagemCliente ? ` — “${a.mensagemCliente}”` : ''}
                    </p>
                  ) : null}
                  {porLamina.size > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Comentários
                      </p>
                      {[...porLamina.entries()]
                        .sort(([x], [y]) => x - y)
                        .map(([lamina, cs]) => (
                          <div key={lamina} className="rounded-lg bg-secondary/50 p-2">
                            <button type="button" onClick={() => onIrPara(lamina)} className="text-xs font-semibold underline">
                              {a.laminas[lamina]?.rotulo ?? `Lâmina ${lamina + 1}`} — ir para a lâmina
                            </button>
                            <ul className="mt-1 space-y-1">
                              {cs.map((c) => (
                                <li key={c.id} className="flex items-start gap-2 text-xs">
                                  {c.origem === 'cliente' ? (
                                    <input
                                      type="checkbox"
                                      checked={c.resolvido}
                                      aria-label="Resolvido"
                                      onChange={async (e) => {
                                        const r = await resolverComentarioAlbum(c.id, e.target.checked)
                                        if (r.ok) void carregar()
                                      }}
                                      className="mt-0.5"
                                    />
                                  ) : (
                                    <span className="w-3.5" />
                                  )}
                                  <span className={cn(c.resolvido && 'text-muted-foreground line-through')}>
                                    <strong>{c.origem === 'equipe' ? `${c.autor} (equipe)` : c.autor}:</strong> {c.texto}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {a.status === 'aguardando' ? (
                              <form
                                className="mt-1 flex gap-1"
                                onSubmit={async (e) => {
                                  e.preventDefault()
                                  const chave = `${a.id}:${lamina}`
                                  const t = (resposta[chave] ?? '').trim()
                                  if (!t) return
                                  const r = await responderComentarioAlbum(a.id, lamina, t)
                                  if (r.ok) {
                                    setResposta((x) => ({ ...x, [chave]: '' }))
                                    void carregar()
                                  } else setErro(r.erro)
                                }}
                              >
                                <input
                                  value={resposta[`${a.id}:${lamina}`] ?? ''}
                                  onChange={(e) => setResposta((x) => ({ ...x, [`${a.id}:${lamina}`]: e.target.value }))}
                                  placeholder="Responder ao cliente…"
                                  className="min-w-0 flex-1 rounded border px-2 py-1 text-xs"
                                />
                                <Button size="sm" variant="outline" type="submit">
                                  Enviar
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
