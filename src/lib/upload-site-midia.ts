'use client'

import { enviarEConfirmarR2 } from '@/lib/upload-r2'
import { novoUuid } from '@/store/usePedidoWizardStore'

/** Lê largura/altura da imagem no navegador (só para evitar salto de layout; o banco só guarda). */
async function dimensoes(file: File): Promise<{ largura: number | null; altura: number | null }> {
  try {
    const bmp = await createImageBitmap(file)
    const r = { largura: bmp.width, altura: bmp.height }
    bmp.close()
    return r
  } catch {
    return { largura: null, altura: null }
  }
}

/**
 * Envia uma imagem do site ao bucket PÚBLICO do R2 e a registra na biblioteca
 * do site (ver /api/uploads/site-midia). A chave fica na pasta da organização.
 */
export async function uploadMidiaSite(organizacaoId: string, file: File): Promise<{ id: string; url: string | null }> {
  const { largura, altura } = await dimensoes(file)
  const r = await enviarEConfirmarR2(
    '/api/uploads/site-midia',
    { organizacaoId, idArquivo: novoUuid(), nome: file.name, tipo: file.type, tamanho: file.size },
    file,
    { organizacaoId, nome: file.name, largura, altura },
  )
  return { id: String(r.id ?? ''), url: typeof r.url === 'string' ? r.url : null }
}
