'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { requireUser } from '@/lib/supabase/queries'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Resultado = { ok: true } | { ok: false; erro: string }

/** Favorito compartilhado em rascunho; não entrega seleção nem aprova álbum. */
export async function definirFavoritoFoto(projetoId: string, fotoId: string, favorita: boolean): Promise<Resultado> {
  if (typeof projetoId !== 'string' || typeof fotoId !== 'string'
    || !UUID.test(projetoId) || !UUID.test(fotoId) || typeof favorita !== 'boolean') {
    return { ok: false, erro: 'Foto ou favorito inválido.' }
  }
  if (isDemoMode()) return { ok: false, erro: 'Demonstração: favoritos não são salvos no servidor.' }

  const { supabase } = await requireUser()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  try {
    const { data, error } = await supabase.rpc('definir_favorito_foto', {
      p_projeto_id: projetoId, p_foto_id: fotoId, p_favorita: favorita,
    })
    if (error || data !== true) {
      return { ok: false, erro: error?.code === '42501'
        ? 'Sem permissão para alterar esta foto.'
        : 'Não foi possível salvar o favorito. Tente novamente.' }
    }
  } catch {
    return { ok: false, erro: 'Não foi possível salvar o favorito. Tente novamente.' }
  }
  revalidatePath(`/cliente/projetos/${projetoId}`)
  revalidatePath(`/dashboard/projetos/${projetoId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
  return { ok: true }
}
