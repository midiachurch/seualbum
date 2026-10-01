import { Skeleton } from '@/components/ui/skeleton'

export default function ProducaoLoading() {
  return (
    <div className="space-y-10">
      <header>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-96" />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-10" />
          </div>
        ))}
      </section>

      <section>
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="flex gap-4 overflow-hidden pb-4">
          {Array.from({ length: 3 }).map((_, col) => (
            <div key={col} className="w-80 shrink-0 space-y-3">
              <Skeleton className="h-4 w-40" />
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
