'use client'

import { useRef } from 'react'

/**
 * Chave de idempotência por gesto: fica a mesma enquanto o envio não der certo
 * (um clique repetido ou retry de rede reaproveita a chave e o banco não
 * duplica) e é renovada só depois do sucesso.
 */
export function useChave() {
  const ref = useRef<string | null>(null)
  return {
    obter: () => (ref.current ??= `ui-${crypto.randomUUID()}`),
    renovar: () => { ref.current = null },
  }
}
