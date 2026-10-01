'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Upload direto do navegador para o bucket público `midia_vitrine` (RLS:
 * escrita só admin/gestor). Como o bucket é público, a URL final não precisa
 * de assinatura — é o mesmo endereço servido pelo CDN do Storage.
 */
export async function uploadMediaAsset(file: File) {
  const supabase = createClient()
  const path = `${Date.now()}-${file.name}`

  const { error: uploadError } = await supabase.storage.from('midia_vitrine').upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('midia_vitrine').getPublicUrl(path)
  return { storagePath: path, url: data.publicUrl }
}

export async function removeMediaAsset(storagePath: string) {
  const supabase = createClient()
  await supabase.storage.from('midia_vitrine').remove([storagePath])
}
