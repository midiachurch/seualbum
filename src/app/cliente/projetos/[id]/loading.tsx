import { Skeleton } from '@/components/ui/skeleton'

export default function ClienteProjetoLoading() {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-5 w-32 rounded-full" />
      </header>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="flex gap-2 border-b pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  )
}
