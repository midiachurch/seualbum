'use client'

import { createClient } from '@/lib/supabase/client'
import { lerMetadadosFoto, metadadosDoStorage, type MetadadosFoto } from '@/lib/exif'

/**
 * Upload direto do navegador para o Storage (bucket `projetos_fotos`, privado
 * — RLS via `pode_ver_projeto`) e devolve a URL assinada para exibir na hora.
 * Só é chamado fora do modo de demonstração (ver componentes que usam isto).
 */
export async function uploadProjetoFoto(
  projetoId: string,
  file: File,
): Promise<{ storagePath: string; url: string; meta: MetadadosFoto }> {
  const supabase = createClient()
  const path = `${projetoId}/${Date.now()}-${file.name}`
  // EXIF lido no navegador para o agrupamento em cenas do designer (0025).
  const meta = await lerMetadadosFoto(file)

  const { error: uploadError } = await supabase.storage.from('projetos_fotos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    metadata: metadadosDoStorage(meta),
  })
  if (uploadError) throw uploadError

  const { data: signed, error: signError } = await supabase.storage
    .from('projetos_fotos')
    .createSignedUrl(path, 60 * 60 * 24 * 7)
  if (signError) throw signError

  return { storagePath: path, url: signed.signedUrl, meta }
}
