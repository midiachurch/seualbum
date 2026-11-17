export default function Loading() {
  return (
    <div role="status" className="space-y-5">
      <p className="text-slate-600">Carregando sua galeria…</p>
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  )
}
