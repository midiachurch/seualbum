'use client'

import { enviarArquivoR2 } from '@/lib/upload-r2'

/**
 * Envia um arquivo do editor de álbum para o Cloudflare R2 (passos 1 e 2 de
 * /api/uploads/album) e devolve a chave. O registro — e a conferência no R2 —
 * fica com a Server Action de cada caso: `registrarFotosAlbum` (fotos do
 * avulso), `salvarDerivados` (versões leves) e `criarAprovacao` (lâminas do
 * link de aprovação).
 */
export type EnvioAlbum =
  | { destino: 'foto'; idArquivo: string; nome: string }
  | { destino: 'derivado'; fotoId: string; variante: 'mini' | 'preview' }
  | { destino: 'aprovacao'; aprovacaoId: string; ordem: number }

export function enviarArquivoAlbum(albumId: string, envio: EnvioAlbum, arquivo: Blob): Promise<string> {
  return enviarArquivoR2('/api/uploads/album', { albumId, ...envio, tipo: arquivo.type || 'image/jpeg', tamanho: arquivo.size }, arquivo)
}
