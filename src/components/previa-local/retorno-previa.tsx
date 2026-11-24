'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function RetornoPrevia() {
  const caminho = usePathname()
  // O novo workspace já oferece acesso ao índice no topo e no menu lateral.
  if (['/previa', '/dashboard', '/admin', '/cliente', '/operacao-local', '/editor-preview'].some(base => caminho === base || caminho.startsWith(base + '/'))) return null
  return <Link href="/previa" className="fixed bottom-4 right-4 z-[100] rounded-full border bg-background px-5 py-3 text-sm font-semibold shadow-lg">← Índice da prévia</Link>
}
