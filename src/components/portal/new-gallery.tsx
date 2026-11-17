'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { criarGaleriaDigital } from '@/lib/actions/galeria-digital'
export function NewGallery() {
  const [pending, start] = useTransition(),
    [error, setError] = useState('')
  const id = useRef<string | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    router = useRouter()
  return (
    <>
      <button
        ref={trigger}
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-medium text-white shadow-sm"
      >
        <Plus size={18} aria-hidden />
        Criar galeria
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="nova-galeria"
        onClose={() => trigger.current?.focus()}
        onCancel={(e) => {
          if (pending) e.preventDefault()
        }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl backdrop:bg-slate-950/50 sm:p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Um novo começo</p>
            <h2 id="nova-galeria" className="mt-2 text-2xl font-semibold">
              Criar galeria
            </h2>
          </div>
          <button
            disabled={pending}
            aria-label="Fechar criação"
            onClick={() => dialog.current?.close()}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Organize suas fotos e receba a seleção do cliente. Ele não precisa criar uma conta.
        </p>
        <form
          className="mt-6 space-y-5"
          onChange={() => {
            id.current = null
            setError('')
          }}
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            start(async () => {
              id.current ??= crypto.randomUUID()
              const result = await criarGaleriaDigital(
                id.current,
                String(f.get('nome')),
                String(f.get('cliente')),
                String(f.get('email')),
              )
              if (result.ok) router.push(`/dashboard/galerias/${result.id}`)
              else setError(result.erro)
            })
          }}
        >
          <fieldset disabled={pending} className="space-y-5">
            <label className="block text-sm font-medium">
              Nome da galeria
              <input
                autoFocus
                name="nome"
                required
                minLength={2}
                maxLength={160}
                placeholder="Ex.: Ensaio de família"
                className="mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4"
              />
            </label>
            <label className="block text-sm font-medium">
              Nome do cliente
              <input
                name="cliente"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                className="mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4"
              />
            </label>
            <label className="block text-sm font-medium">
              E-mail do cliente
              <input
                name="email"
                autoComplete="email"
                type="email"
                required
                maxLength={254}
                className="mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4"
              />
              <span className="mt-2 block text-xs font-normal text-slate-600">
                Para identificar o cliente. Nenhum convite será enviado automaticamente.
              </span>
            </label>
            <button className="min-h-12 w-full rounded-xl bg-primary px-5 font-medium text-white">
              {pending ? 'Criando…' : 'Criar e adicionar fotos'}
            </button>
          </fieldset>
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        </form>
      </dialog>
    </>
  )
}
