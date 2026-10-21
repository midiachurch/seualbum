'use client'

import { registrarEventoAnalitico } from '@/lib/actions/reconhecimento'
import type { EventoAnalitico } from '@/lib/rekognition/regras'

type Gtag = (comando: 'event', nome: string, parametros: Record<string, unknown>) => void

/**
 * Evento de produto: grava em `eventos_analiticos` (migration 0042) e, se a
 * página tiver o Google Analytics carregado, repassa ao `gtag`. Dispara e
 * esquece — nunca lança nem segura a tela.
 */
export function track(
  evento: EventoAnalitico,
  projetoId: string | null,
  propriedades: Record<string, string | number | boolean> = {},
) {
  registrarEventoAnalitico(evento, projetoId, propriedades).catch(() => {})
  const gtag = (window as unknown as { gtag?: Gtag }).gtag
  if (typeof gtag === 'function') gtag('event', evento, { ...propriedades, projeto_id: projetoId })
}
