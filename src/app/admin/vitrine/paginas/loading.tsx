import { Skeleton } from '@/components/ui/skeleton'

export default function PaginasLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="overflow-hidden rounded-2xl border">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="ml-auto h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
