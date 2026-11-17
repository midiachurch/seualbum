'use client'

import { useCallback, useEffect, useRef, useState, startTransition } from 'react'
import { consultarSelecoes, entregarSelecao, exportarSelecao } from '@/lib/actions/selecao-entregue'

type Resumo = Extract<Awaited<ReturnType<typeof consultarSelecoes>>, { ok: true }>
export function SelectionDeliveryPanel({
  projetoId,
  somenteRecebidas = false,
}: {
  projetoId: string
  somenteRecebidas?: boolean
}) {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [downloads, setDownloads] = useState<{ fotoId: string; nomeOriginal: string | null; url: string }[]>(
    [],
  )
  const chave = useRef<string | null>(null)
  const carregar = useCallback(async () => {
    const r = await consultarSelecoes(projetoId)
    if (r.ok) {
      setResumo(r)
      setErro(null)
    } else setErro(r.erro)
  }, [projetoId])
  useEffect(() => {
    startTransition(async () => {
      await carregar()
    })
  }, [carregar])
  async function confirmar() {
    if (!resumo || ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      chave.current ??= crypto.randomUUID()
      const r = await entregarSelecao(
        projetoId,
        resumo.favoritas,
        resumo.entregas[0]?.revisao ?? 0,
        chave.current,
      )
      if (!r.ok) {
        setErro(r.erro)
        if (r.conflito) {
          chave.current = null
          setConfirmando(false)
          await carregar()
        }
        return
      }
      chave.current = null
      setConfirmando(false)
      setAviso(`Seleção entregue: revisão ${r.entrega.revisao}, ${r.entrega.total} fotos.`)
      await carregar()
    } finally {
      setOcupado(false)
    }
  }
  async function exportar(id: string) {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      const r = await exportarSelecao(id)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      const url = URL.createObjectURL(new Blob(['\uFEFF', r.csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'selecao.csv'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDownloads(r.arquivos)
      setAviso(
        'Manifesto preparado. Links dos originais disponíveis por cinco minutos; nomes desconhecidos ficam identificados pelo ID.',
      )
    } finally {
      setOcupado(false)
    }
  }
  return (
    <section className="space-y-5 rounded-2xl border bg-white p-5 sm:p-7" aria-label="Entrega da seleção">
      <h2 className="text-xl font-semibold">
        {somenteRecebidas ? 'Seleções recebidas' : 'Entrega da seleção'}
      </h2>
      <p className="text-sm text-muted-foreground">
        Cada entrega guarda uma revisão da escolha do cliente. Exporte o CSV e acesse os originais pelos links
        temporários.
      </p>
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="text-sm">
          {aviso}
        </p>
      ) : null}
      {!resumo ? (
        <button
          type="button"
          className="min-h-11 underline"
          onClick={() =>
            startTransition(async () => {
              await carregar()
            })
          }
        >
          Carregar seleção salva
        </button>
      ) : (
        <>
          <p className="text-sm">
            {resumo.favoritas.length} favoritas salvas · {resumo.entregas.length} entregas
          </p>
          <button
            type="button"
            disabled={ocupado}
            className="min-h-11 underline"
            onClick={() => {
              chave.current = null
              setConfirmando(false)
              startTransition(async () => {
                await carregar()
              })
            }}
          >
            Atualizar favoritas salvas
          </button>
          {resumo.podeEntregar && !somenteRecebidas ? (
            <button
              type="button"
              disabled={ocupado || !resumo.favoritas.length}
              className="ml-3 min-h-11 rounded-lg border px-3"
              onClick={() => setConfirmando(true)}
            >
              Preparar entrega
            </button>
          ) : null}
          {confirmando ? (
            <div className="space-y-2 rounded-xl bg-secondary p-3">
              <p>
                Entregar exatamente as {resumo.favoritas.length} favoritas carregadas nesta lista como revisão{' '}
                {(resumo.entregas[0]?.revisao ?? 0) + 1}?
              </p>
              <button
                type="button"
                disabled={ocupado}
                className="min-h-11 rounded-lg border px-3"
                onClick={() =>
                  startTransition(async () => {
                    await confirmar()
                  })
                }
              >
                {ocupado ? 'Entregando…' : 'Confirmar entrega'}
              </button>
              <button
                type="button"
                disabled={ocupado}
                className="ml-3 min-h-11 underline"
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </button>
            </div>
          ) : null}
          {!resumo.entregas.length && (
            <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-600">
              Nenhuma seleção recebida ainda. Compartilhe a galeria para o cliente escolher e entregar as
              favoritas.
            </p>
          )}
          {resumo.entregas.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm"
            >
              <span>
                Revisão {e.revisao} · {e.total} fotos ·{' '}
                {new Date(e.criadaEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </span>
              <button
                type="button"
                disabled={ocupado}
                className="min-h-11 underline"
                onClick={() =>
                  startTransition(async () => {
                    await exportar(e.id)
                  })
                }
              >
                Exportar CSV
              </button>
            </div>
          ))}
        </>
      )}
      {downloads.length ? (
        <ul className="max-h-60 overflow-auto text-sm">
          {downloads.map((f) => (
            <li key={f.fotoId}>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center underline"
              >
                {f.nomeOriginal ?? `Original sem nome registrado (${f.fotoId})`}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
