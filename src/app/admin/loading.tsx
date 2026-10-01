import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-10">
      <header>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-12" />
          </div>
        ))}
      </section>

      <section>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-4 h-24 w-full rounded-2xl" />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 space-y-4 border-l pl-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-full max-w-sm" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </section>
        <section>
          <Skeleton className="h-5 w-24" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
