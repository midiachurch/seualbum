'use client'

import { enviarEConfirmarR2 } from '@/lib/upload-r2'
import { novoUuid } from '@/store/usePedidoWizardStore'

/**
 * Envia o logo do estúdio para o bucket PÚBLICO do Cloudflare R2 e já o grava
 * no perfil (`fotografos.logo_path`/`logo_bucket`/`logo_url`), em 3 passos
 * (ver /api/uploads/logo). A chave fica na pasta do fotógrafo logado — o
 * servidor decide, não o navegador. Devolve o endereço público.
 */
export async function uploadFotografoLogo(file: File): Promise<string> {
  const r = await enviarEConfirmarR2('/api/uploads/logo', { idArquivo: novoUuid(), nome: file.name, tipo: file.type, tamanho: file.size }, file)
  return String(r.url ?? '')
}
