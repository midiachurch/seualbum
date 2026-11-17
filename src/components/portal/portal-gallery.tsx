'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { entrarPortal, favoritoPortal, entregarPortal } from '@/lib/actions/portal'
import type { PortalProjeto } from '@/lib/portal/servidor'

export function PortalGallery({
  link,
  projeto,
  paginada,
}: {
  link: string
  projeto: PortalProjeto | null
  paginada: boolean
}) {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [pendente, iniciar] = useTransition()
  const [filtro, setFiltro] = useState(false)
  const [indice, setIndice] = useState<number | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [falhas, setFalhas] = useState<Set<string>>(new Set())
  const chave = useRef<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  const deliverButton = useRef<HTMLButtonElement>(null)
  const ultimoFoco = useRef<HTMLElement | null>(null)
  const abertas = projeto?.fotos.filter((f) => !filtro || f.favorita) ?? []
  const foto = indice === null ? null : abertas[indice]
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (foto && !d.open) {
      ultimoFoco.current = document.activeElement as HTMLElement
      d.showModal()
    }
    if (!foto && d.open) {
      d.close()
      ultimoFoco.current?.focus()
    }
  }, [foto])
  useEffect(() => {
    const d = confirmation.current
    if (!d) return
    if (confirmar && !d.open) d.showModal()
    if (!confirmar && d.open) {
      d.close()
      deliverButton.current?.focus()
    }
  }, [confirmar])
  function marcar(id: string, valor: boolean) {
    iniciar(async () => {
      const r = await favoritoPortal(link, id, valor)
      setMensagem(r.ok ? 'Favorito salvo.' : r.erro)
      if (r.ok) {
        chave.current = null
        router.refresh()
      }
    })
  }
  if (!projeto)
    return (
      <main className="mx-auto my-10 max-w-md space-y-6 rounded-2xl border bg-white px-6 py-10 shadow-sm sm:my-20 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Seu Álbum · Acesso privado
        </p>
        <h1 className="text-3xl font-semibold">Sua galeria privada</h1>
        <p className="text-sm text-muted-foreground">
          Suas fotos estão esperando por você. Digite o código de 8 dígitos enviado pelo fotógrafo.
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            iniciar(async () => {
              const r = await entrarPortal(link, codigo)
              if (r.ok) {
                setCodigo('')
                router.refresh()
              } else setMensagem(r.erro)
            })
          }}
        >
          <label className="block" htmlFor="codigo">
            Código de acesso
          </label>
          <input
            id="codigo"
            type="password"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{8}"
            maxLength={8}
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="min-h-14 w-full rounded-xl border bg-slate-50 px-4 text-center text-xl tracking-[0.3em]"
          />
          <button
            disabled={pendente}
            className="min-h-12 w-full rounded-xl bg-primary px-5 font-medium text-primary-foreground"
          >
            {pendente ? 'Entrando…' : 'Entrar na galeria'}
          </button>
        </form>
        <p role="alert">{mensagem}</p>
      </main>
    )
  return (
    <main className="mx-auto max-w-6xl space-y-7 px-4 pb-28 pt-8 sm:px-6 sm:pt-12">
      <header className="space-y-2">
        {projeto.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- logo público do estúdio já configurado.
          <img
            src={projeto.logo}
            alt={projeto.estudio ?? 'Estúdio'}
            className="max-h-16 max-w-48 object-contain"
          />
        )}
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {projeto.estudio ?? 'Seu Álbum'}
        </p>
        <h1 className="text-3xl font-semibold">{projeto.nome}</h1>
        <p className="text-sm text-muted-foreground">Galeria privada · {projeto.total} fotos</p>
      </header>
      <section className="space-y-4 rounded-2xl border bg-white p-5 sm:p-6">
        <p role="status">
          {projeto.favoritas} {projeto.favoritas === 1 ? 'foto favorita' : 'fotos favoritas'} ·{' '}
          {projeto.revisao ? `Seleção entregue: revisão ${projeto.revisao}` : 'Seleção ainda em rascunho'}
        </p>
        <p className="text-sm text-muted-foreground">
          Toque na estrela para guardar suas favoritas. Revise suas escolhas e entregue a seleção ao
          fotógrafo. As favoritas são compartilhadas entre as pessoas com acesso à galeria.
        </p>
        <button
          className="min-h-11 rounded-full border px-4"
          aria-pressed={filtro}
          onClick={() => {
            setFiltro(!filtro)
            setIndice(null)
          }}
        >
          {filtro ? 'Mostrar todas nesta página' : 'Mostrar favoritas nesta página'}
        </button>
        <button
          ref={deliverButton}
          className="fixed inset-x-4 bottom-4 z-20 min-h-12 rounded-xl bg-primary px-5 font-medium text-white shadow-lg sm:static sm:ml-3 sm:shadow-none"
          disabled={pendente || projeto.favoritas === 0 || projeto.favoritas > 1000}
          onClick={() => setConfirmar(true)}
        >
          {pendente ? 'Salvando…' : 'Entregar seleção'}
        </button>
        <dialog
          ref={confirmation}
          aria-labelledby="confirmar-selecao"
          onCancel={(e) => {
            if (pendente) e.preventDefault()
            else setConfirmar(false)
          }}
          onClose={() => setConfirmar(false)}
          className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl backdrop:bg-slate-950/50"
        >
          <div className="space-y-5">
            <h2 id="confirmar-selecao" className="text-xl font-semibold">
              Tudo pronto para entregar?
            </h2>
            <p className="text-sm leading-relaxed">
              Confirmar a entrega das {projeto.favoritas} favoritas de todas as páginas ao fotógrafo?
            </p>
            <button
              className="min-h-11 rounded-full border px-4"
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  chave.current ??= crypto.randomUUID()
                  const r = await entregarPortal(link, projeto.revisao, chave.current, projeto.favorita_ids)
                  setMensagem(
                    r.ok
                      ? 'Seleção entregue ao fotógrafo. Você pode continuar escolhendo e enviar uma nova revisão.'
                      : r.erro,
                  )
                  if (r.ok) {
                    chave.current = null
                    setConfirmar(false)
                    router.refresh()
                  }
                })
              }
            >
              Confirmar entrega
            </button>
            <button
              className="ml-3 min-h-11 underline"
              disabled={pendente}
              onClick={() => setConfirmar(false)}
            >
              Continuar escolhendo
            </button>
          </div>
        </dialog>
        <p
          role="alert"
          className={
            mensagem.startsWith('Seleção entregue')
              ? 'rounded-xl bg-emerald-50 p-4 text-emerald-900'
              : 'text-sm'
          }
        >
          {mensagem}
        </p>
        {projeto.favoritas > 1000 && (
          <p>
            O limite técnico desta versão é de 1000 fotos por entrega. Fale com seu fotógrafo para organizar a
            seleção.
          </p>
        )}
      </section>
      {!abertas.length && (
        <p className="rounded-2xl border border-dashed p-8 text-center">
          {filtro ? 'Nenhuma favorita nesta página.' : 'As fotografias ainda não foram disponibilizadas.'}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {abertas.map((f, i) => (
          <article key={f.id} className="relative overflow-hidden rounded-xl border">
            <button
              className="block aspect-square w-full bg-secondary"
              onClick={() => setIndice(i)}
              aria-label={`Ampliar ${f.nome_original ?? 'foto'}`}
            >
              {falhas.has(f.id) ? (
                <span className="block p-4 text-sm">
                  Arquivo temporariamente indisponível. Contate seu fotógrafo.
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- rota privada revalida capacidade.
                <img
                  src={`/portal/${link}/foto/${f.id}`}
                  loading="lazy"
                  alt={f.nome_original ?? f.grupo ?? 'Foto do projeto'}
                  onError={() => setFalhas((prev) => new Set(prev).add(f.id))}
                  className="h-full w-full object-cover"
                />
              )}
            </button>
            <button
              disabled={pendente}
              aria-pressed={f.favorita}
              aria-label={f.favorita ? 'Remover dos favoritos' : 'Marcar como favorita'}
              onClick={() => marcar(f.id, !f.favorita)}
              className="absolute bottom-10 right-2 min-h-12 min-w-12 rounded-full bg-black/80 text-2xl text-white shadow-sm"
            >
              {f.favorita ? '★' : '☆'}
            </button>
            {f.nome_original && <p className="truncate px-3 py-2 text-xs">{f.nome_original}</p>}
          </article>
        ))}
      </div>
      <nav className="flex gap-4">
        {paginada && (
          <Link className="min-h-11 underline" href={`/portal/${link}`}>
            Primeira página
          </Link>
        )}
        {projeto.fotos.length === 100 && (
          <Link className="min-h-11 underline" href={`/portal/${link}?apos=${projeto.fotos[99].id}`}>
            Próxima página
          </Link>
        )}
      </nav>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Histórico da galeria</h2>
        <ol className="mt-3 space-y-3">
          {projeto.eventos.map((e, i) => (
            <li key={i} className="text-sm">
              <strong>{e.tipo === 'projeto_criado' ? 'Galeria criada' : 'Seleção entregue'}</strong>
              <span className="block text-muted-foreground">
                {new Date(e.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                {e.tipo !== 'projeto_criado' && ` · ${e.responsavel}`}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <dialog
        ref={dialog}
        aria-label="Foto ampliada"
        onCancel={() => setIndice(null)}
        onClose={() => setIndice(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && indice !== null && indice < abertas.length - 1) setIndice(indice + 1)
          if (e.key === 'ArrowLeft' && indice !== null && indice > 0) setIndice(indice - 1)
        }}
        className="fixed inset-0 h-[100dvh] max-h-none w-screen max-w-none bg-black p-4 text-white backdrop:bg-black/80"
      >
        {foto && (
          <div className="flex h-full flex-col gap-3">
            <button
              autoFocus
              className="min-h-11 self-end rounded-full border px-5"
              onClick={() => setIndice(null)}
            >
              Fechar
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto privada do portal. */}
            <img
              src={`/portal/${link}/foto/${foto.id}`}
              alt={foto.nome_original ?? 'Foto ampliada'}
              className="min-h-0 flex-1 object-contain"
            />
            <div className="flex justify-between gap-2">
              <button
                disabled={indice === 0}
                className="min-h-11 px-4"
                onClick={() => setIndice((n) => Math.max(0, (n ?? 0) - 1))}
              >
                Anterior
              </button>
              <button
                disabled={pendente}
                className="min-h-11 px-4"
                onClick={() => marcar(foto.id, !foto.favorita)}
              >
                {foto.favorita ? 'Remover favorito' : 'Favoritar'}
              </button>
              <button
                disabled={indice === abertas.length - 1}
                className="min-h-11 px-4"
                onClick={() => setIndice((n) => Math.min(abertas.length - 1, (n ?? 0) + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </dialog>
    </main>
  )
}
