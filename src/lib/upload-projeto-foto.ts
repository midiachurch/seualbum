'use client'

import { lerMetadadosFoto, type MetadadosFoto } from '@/lib/exif'
import { enviarEConfirmarR2, type EstadoEnvioR2 } from '@/lib/upload-r2'
import { ehUuid } from '@/lib/r2/chaves'
import { novoUuid } from '@/store/usePedidoWizardStore'

const MIME_POR_EXTENSAO: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
}

/** Alguns navegadores entregam HEIC com `type` vazio; a extensão resolve. */
function mimeDoArquivo(file: File) {
  if (file.type) return file.type
  return MIME_POR_EXTENSAO[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? ''
}

/**
 * Envia uma foto de projeto para o Cloudflare R2 e já a registra em `fotos`
 * (`bucket = 'r2'`), em 3 passos (ver /api/uploads/projeto-foto). Devolve a
 * chave e um link assinado de 1h para exibir na hora — a página assina de
 * novo a cada visita. Só é chamado fora do modo de demonstração.
 *
 * Quem pode: quem enxerga o projeto (`pode_ver_projeto`), como no antigo
 * bucket `projetos_fotos` — o arquivo antigo continua sendo lido de lá.
 */
export async function uploadProjetoFoto(
  projetoId: string,
  file: File,
  grupo?: string,
): Promise<{ id: string; storagePath: string; url: string; meta: MetadadosFoto }> {
  return criarUploadProjetoFoto(projetoId, file, grupo).executar()
}

/** Uma operação por arquivo. Reutilize `executar` ao tentar novamente. */
export function criarUploadProjetoFoto(projetoId: string, file: File, grupo?: string) {
  const corpo = { projetoId, idArquivo: novoUuid(), nome: file.name, tipo: mimeDoArquivo(file), tamanho: file.size }
  const estado: EstadoEnvioR2 = {}
  let metadados: Promise<MetadadosFoto> | undefined
  let emCurso: Promise<Awaited<ReturnType<typeof uploadProjetoFoto>>> | undefined

  async function enviar() {
    // Identidade e EXIF pertencem ao arquivo, não a cada tentativa.
    const meta = await (metadados ??= lerMetadadosFoto(file))
    const r = await enviarEConfirmarR2(
      '/api/uploads/projeto-foto', corpo, file,
      { grupo: grupo ?? null, capturadaEm: meta.capturadaEm, camera: meta.camera }, estado,
    )
    if (!ehUuid(r.id) || typeof r.url !== 'string' || !r.url) {
      throw new Error('O servidor não confirmou os dados da foto. Tente novamente.')
    }
    return { id: r.id, storagePath: r.key, url: r.url, meta }
  }

  return {
    executar() {
      // Clique duplo não inicia dois PUTs/INSERTs concorrentes.
      return (emCurso ??= enviar().finally(() => { emCurso = undefined }))
    },
  }
}
