'use client'

import { createClient } from '@/lib/supabase/client'

/** Upload do logo do estúdio (bucket público `fotografo_logos`) — path por dono, RLS garante isolamento. */
export async function uploadFotografoLogo(fotografoId: string, file: File) {
  const supabase = createClient()
  const path = `${fotografoId}/logo-${Date.now()}-${file.name}`

  const { error: uploadError } = await supabase.storage.from('fotografo_logos').upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('fotografo_logos').getPublicUrl(path)
  return data.publicUrl
}
