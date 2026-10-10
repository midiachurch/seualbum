/**
 * Smart Layout local (custo zero): lê data/hora de captura e câmera de cada
 * foto no NAVEGADOR, no momento do upload. Nada vai para API externa.
 *
 * Invisível para quem envia: nunca bloqueia nem atrasa o upload — se o EXIF
 * não vier em 4 s (ou o Worker não subir), a foto segue sem metadados. O
 * agrupamento em cenas só aparece para o designer (lib/cenas.ts).
 */
import type { MetadadosFoto } from './extrair'

export type { MetadadosFoto } from './extrair'

const TEMPO_MAXIMO_MS = 4000
const VAZIO: MetadadosFoto = { capturadaEm: null, camera: null }

let worker: Worker | null = null
let workerIndisponivel = false
let seq = 0
const pendentes = new Map<number, (meta: MetadadosFoto) => void>()

function obterWorker(): Worker | null {
  if (workerIndisponivel || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./exif.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; meta: MetadadosFoto }>) => {
      pendentes.get(e.data.id)?.(e.data.meta)
      pendentes.delete(e.data.id)
    }
    worker.onerror = () => {
      // Worker quebrou: quem esperava segue sem metadados; os próximos usam o fallback.
      workerIndisponivel = true
      worker?.terminate()
      worker = null
      for (const [id, resolver] of pendentes) {
        pendentes.delete(id)
        resolver(VAZIO)
      }
    }
    return worker
  } catch {
    workerIndisponivel = true
    return null
  }
}

async function naThreadPrincipal(arquivo: File): Promise<MetadadosFoto> {
  const { extrairMetadados } = await import('./extrair')
  return extrairMetadados(arquivo)
}

export async function lerMetadadosFoto(arquivo: File): Promise<MetadadosFoto> {
  const w = obterWorker()
  const leitura = w
    ? new Promise<MetadadosFoto>((resolver) => {
        const id = ++seq
        pendentes.set(id, resolver)
        w.postMessage({ id, arquivo })
      })
    : naThreadPrincipal(arquivo)
  const limite = new Promise<MetadadosFoto>((resolver) => setTimeout(() => resolver(VAZIO), TEMPO_MAXIMO_MS))
  return Promise.race([leitura, limite]).catch(() => VAZIO)
}
