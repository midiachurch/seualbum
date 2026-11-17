'use client'

import { lerMetadadosFoto, type MetadadosFoto } from '@/lib/exif'
import { enviarEConfirmarR2, type EstadoEnvioR2 } from '@/lib/upload-r2'
import { ehUuid, MIMES_FOTO_PROJETO, TAMANHO_MAXIMO_FOTO_PROJETO_R2 } from '@/lib/r2/chaves'
import { normalizarNomeOriginal } from '@/lib/r2/nome-original'
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
function mimeDoArquivo(file: Pick<File, 'type' | 'name'>) {
  if (file.type) return file.type
  return MIME_POR_EXTENSAO[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? ''
}

/** Validação antecipada de UX; a rota e o HeadObject continuam autoritativos. */
export function validarArquivoFotoProjeto(file: Pick<File, 'type' | 'name' | 'size'>): string | null {
  if (!MIMES_FOTO_PROJETO.has(mimeDoArquivo(file))) return 'Formato não aceito. Use JPG, PNG, HEIC ou WebP.'
  if (!Number.isFinite(file.size) || file.size <= 0) return 'O arquivo está vazio ou tem tamanho inválido.'
  if (file.size > TAMANHO_MAXIMO_FOTO_PROJETO_R2) return 'Foto maior que 300 MB.'
  if (!normalizarNomeOriginal(file.name)) return 'Nome de arquivo inválido.'
  return null
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
  const erro = validarArquivoFotoProjeto(file)
  if (erro) throw new Error(erro)
  const nomeOriginal = normalizarNomeOriginal(file.name)!
  const corpo = { projetoId, idArquivo: novoUuid(), nome: nomeOriginal, tipo: mimeDoArquivo(file), tamanho: file.size }
  const estado: EstadoEnvioR2 = {}
  let metadados: Promise<MetadadosFoto> | undefined
  let emCurso: Promise<Awaited<ReturnType<typeof uploadProjetoFoto>>> | undefined

  async function enviar() {
    // Identidade e EXIF pertencem ao arquivo, não a cada tentativa.
    const meta = await (metadados ??= lerMetadadosFoto(file))
    const r = await enviarEConfirmarR2(
      '/api/uploads/projeto-foto', corpo, file,
      { grupo: grupo ?? null, nomeOriginal, capturadaEm: meta.capturadaEm, camera: meta.camera }, estado,
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
