import { Skeleton } from '@/components/ui/skeleton'

export default function ClienteDashboardLoading() {
  return (
    <div className="space-y-8">
      <section>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-7 w-64" />
      </section>

      <section className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </section>

      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </section>
    </div>
  )
}
