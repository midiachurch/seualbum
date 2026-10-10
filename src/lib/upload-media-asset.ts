'use client'

import { enviarEConfirmarR2 } from '@/lib/upload-r2'
import type { MediaTag } from '@/types/platform'
import { novoUuid } from '@/store/usePedidoWizardStore'

/**
 * Envia um arquivo da biblioteca de mídia para o bucket PÚBLICO do Cloudflare
 * R2 e já o registra em `media_assets` (`bucket = 'r2'`), em 3 passos (ver
 * /api/uploads/midia). A URL devolvida é o endereço público permanente
 * (R2_PUBLIC_URL) — sem assinatura, com cache do CDN.
 */
export async function uploadMediaAsset(
  file: File,
  dados: { tags: MediaTag[]; larguraPx: number; alturaPx: number },
): Promise<{ id: string; url: string; tamanhoKb: number }> {
  const r = await enviarEConfirmarR2(
    '/api/uploads/midia',
    { idArquivo: novoUuid(), nome: file.name, tipo: file.type, tamanho: file.size },
    file,
    { nome: file.name, ...dados },
  )
  return { id: String(r.id), url: String(r.url ?? ''), tamanhoKb: Number(r.tamanhoKb) || Math.round(file.size / 1024) }
}
