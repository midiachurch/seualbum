import { cn } from '@/lib/utils'

/**
 * Bloco cinza pulsante — primitivo de todos os `loading.tsx` do app. O Next
 * mostra automaticamente o `loading.tsx` de uma rota enquanto o Server
 * Component correspondente aguarda dados (Suspense implícito do App Router),
 * então cada skeleton só precisa espelhar o layout real da tela para não
 * haver salto visual quando os dados chegam.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-secondary', className)} />
}
