'use client'

import { useRef, useState } from 'react'
import { AlertCircle, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { gerarLinksDownloadAction } from '@/lib/actions/pedidos-admin'
import { formatarTamanho } from '@/lib/utils'
import type { ArquivoPedido } from '@/lib/supabase/queries'

const LOTE_ASSINATURA = 100
/** Intervalo entre downloads do "Baixar tudo": rápido demais e o navegador descarta alguns. */
const INTERVALO_DOWNLOAD_MS = 400

interface OrderMediaCardProps {
  orderId: string
  linkExterno: string | null
  fotosEnviadas: number
  /** `null` = erro ao listar o Storage. */
  arquivos: ArquivoPedido[] | null
}

function baixar(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function OrderMediaCard({ orderId, linkExterno, fotosEnviadas, arquivos }: OrderMediaCardProps) {
  const [baixando, setBaixando] = useState<string | null>(null)
  const [progressoTudo, setProgressoTudo] = useState<{ feitos: number; total: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const cancelarRef = useRef(false)

  const pesoTotal = (arquivos ?? []).reduce((s, a) => s + a.tamanho, 0)
  const ocupado = baixando !== null || progressoTudo !== null

  async function baixarUm(arquivo: ArquivoPedido) {
    setErro(null)
    setBaixando(arquivo.path)
    try {
      const result = await gerarLinksDownloadAction(orderId, [arquivo.path])
      if (!result.ok) return setErro(result.erro)
      baixar(result.links[0].url)
    } catch {
      setErro('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setBaixando(null)
    }
  }

  async function baixarTudo() {
    if (!arquivos || arquivos.length === 0) return
    setErro(null)
    cancelarRef.current = false
    setProgressoTudo({ feitos: 0, total: arquivos.length })

    try {
      let feitos = 0
      for (let i = 0; i < arquivos.length; i += LOTE_ASSINATURA) {
        const lote = arquivos.slice(i, i + LOTE_ASSINATURA).map((a) => a.path)
        const result = await gerarLinksDownloadAction(orderId, lote)
        if (!result.ok) {
          setErro(result.erro)
          return
        }
        for (const link of result.links) {
          if (cancelarRef.current) return
          baixar(link.url)
          feitos += 1
          setProgressoTudo({ feitos, total: arquivos.length })
          await new Promise((r) => setTimeout(r, INTERVALO_DOWNLOAD_MS))
        }
      }
    } catch {
      setErro('Sem conexão com o servidor. Os downloads pararam — tente de novo.')
    } finally {
      setProgressoTudo(null)
    }
  }

  const semMidia = !linkExterno && fotosEnviadas === 0 && (arquivos?.length ?? 0) === 0

  return (
    <section aria-labelledby="midia-pedido" className="rounded-2xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 id="midia-pedido" className="text-base font-semibold">
            Mídia do pedido
          </h2>
          {arquivos && arquivos.length > 0 ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {arquivos.length} {arquivos.length === 1 ? 'arquivo' : 'arquivos'} · {formatarTamanho(pesoTotal)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {linkExterno ? (
            <Button asChild variant="outline">
              <a href={linkExterno} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden />
                Acessar galeria externa (Drive/Dropbox)
              </a>
            </Button>
          ) : null}
          {arquivos && arquivos.length > 1 ? (
            progressoTudo ? (
              <Button type="button" variant="outline" onClick={() => (cancelarRef.current = true)}>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Baixando {progressoTudo.feitos}/{progressoTudo.total} · Parar
              </Button>
            ) : (
              <Button type="button" variant="brand" onClick={baixarTudo} disabled={ocupado}>
                <Download className="h-4 w-4" aria-hidden />
                Baixar tudo
              </Button>
            )
          ) : null}
        </div>
      </header>

      {erro ? (
        <p role="alert" className="flex items-center gap-2 border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : null}

      {arquivos && arquivos.length > 1 ? (
        <p className="border-b px-5 py-2 text-xs text-muted-foreground">
          &quot;Baixar tudo&quot; dispara um download por arquivo. Na primeira vez o navegador pode pedir
          permissão para baixar vários arquivos.
        </p>
      ) : null}

      <div className="p-5">
        {arquivos === null ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            Não foi possível listar as fotos no Storage. Recarregue a página.
          </p>
        ) : arquivos.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {arquivos.map((arquivo) => (
              <li key={arquivo.path} className="flex items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{arquivo.nome}</p>
                  <p className="text-xs text-muted-foreground">{formatarTamanho(arquivo.tamanho)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => baixarUm(arquivo)}
                  disabled={ocupado}
                  aria-label={`Baixar ${arquivo.nome}`}
                >
                  {baixando === arquivo.path ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden />
                  )}
                  Download
                </Button>
              </li>
            ))}
          </ul>
        ) : fotosEnviadas > 0 ? (
          // O banco diz que houve upload, mas a pasta está vazia: arquivos apagados à mão?
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            O pedido registra {fotosEnviadas} {fotosEnviadas === 1 ? 'foto' : 'fotos'}, mas a pasta no Storage está vazia.
          </p>
        ) : linkExterno ? (
          <p className="text-sm text-muted-foreground">
            As fotos deste pedido estão só na galeria externa.
          </p>
        ) : null}

        {semMidia ? <EmptyState title="Nenhuma mídia neste pedido" /> : null}
      </div>
    </section>
  )
}
