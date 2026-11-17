'use client'
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border bg-white p-8">
      <h2 className="text-xl font-semibold">Não foi possível abrir a galeria</h2>
      <p className="mt-3 text-slate-600">Confira sua conexão e tente novamente.</p>
      <button onClick={reset} className="mt-6 min-h-12 rounded-xl bg-primary px-5 text-white">
        Tentar novamente
      </button>
    </div>
  )
}
