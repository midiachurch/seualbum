import { Skeleton } from '@/components/ui/skeleton'

export default function EquipeLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="overflow-hidden rounded-2xl border">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t px-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
