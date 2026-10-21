'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { colecaoDoProjeto, rekognitionConfigurado, removerColecao } from '@/lib/rekognition/cliente'
import { ehEventoAnalitico, type EventoAnalitico } from '@/lib/rekognition/regras'
import { requireUser } from '@/lib/supabase/queries'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Resultado = { ok: true } | { ok: false; erro: string }

/**
 * Liga/desliga o "Encontrar minhas fotos" do projeto (migration 0042) — a
 * função do banco decide quem pode (equipe ou estúdio dono). Ligar só abre a
 * fila: a tela chama /api/reconhecimento/indexar em seguida. Desligar apaga o
 * índice do banco e a coleção no Rekognition na hora (se a AWS falhar, o Cron
 * apaga a coleção órfã).
 */
export async function definirReconhecimentoFacial(projetoId: string, ativo: boolean): Promise<Resultado> {
  if (!UUID.test(projetoId)) return { ok: false, erro: 'Projeto inválido.' }
  if (isDemoMode() || !rekognitionConfigurado()) return { ok: false, erro: 'Reconhecimento facial não configurado.' }

  const { supabase } = await requireUser()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { error } = await supabase.rpc('definir_reconhecimento_facial', { p_projeto_id: projetoId, p_ativo: ativo })
  if (error) {
    console.error('[definirReconhecimentoFacial]', error.message)
    return { ok: false, erro: error.code === '42501' ? 'Sem permissão para mudar este projeto.' : 'Não foi possível salvar. Tente de novo.' }
  }
  if (!ativo) {
    await removerColecao(colecaoDoProjeto(projetoId)).catch((e) =>
      console.error('[definirReconhecimentoFacial] coleção', e instanceof Error ? e.message : e),
    )
  }

  revalidatePath(`/admin/projetos/${projetoId}`)
  revalidatePath(`/cliente/projetos/${projetoId}`)
  return { ok: true }
}

/**
 * "Destacar no meu álbum": as fotos em que o cliente se encontrou viram
 * favoritas, e a equipe as prioriza na diagramação. Devolve quantas mudaram.
 */
export async function destacarFotosNoAlbum(
  projetoId: string,
  fotoIds: string[],
): Promise<{ ok: true; marcadas: number } | { ok: false; erro: string }> {
  const ids = [...new Set(fotoIds)].filter((id) => UUID.test(id))
  if (!UUID.test(projetoId) || ids.length === 0 || ids.length > 1000) return { ok: false, erro: 'Seleção inválida.' }
  if (isDemoMode()) return { ok: true, marcadas: ids.length }

  const { supabase } = await requireUser()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { data, error } = await supabase.rpc('favoritar_fotos', { p_projeto_id: projetoId, p_foto_ids: ids })
  if (error) {
    console.error('[destacarFotosNoAlbum]', error.message)
    return { ok: false, erro: 'Não foi possível destacar as fotos. Tente de novo.' }
  }

  revalidatePath(`/cliente/projetos/${projetoId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
  return { ok: true, marcadas: data ?? 0 }
}

/**
 * Telemetria de produto (`eventos_analiticos`, 0042). Nunca falha para quem
 * chama: evento perdido não pode quebrar a tela.
 */
export async function registrarEventoAnalitico(
  evento: EventoAnalitico,
  projetoId: string | null,
  propriedades: Record<string, string | number | boolean> = {},
): Promise<void> {
  if (!ehEventoAnalitico(evento) || isDemoMode()) return
  try {
    const { supabase } = await requireUser()
    if (!supabase) return
    const { error } = await supabase.from('eventos_analiticos').insert({
      evento,
      projeto_id: projetoId && UUID.test(projetoId) ? projetoId : null,
      propriedades,
    })
    if (error) console.error('[registrarEventoAnalitico]', evento, error.message)
  } catch (e) {
    console.error('[registrarEventoAnalitico]', evento, e instanceof Error ? e.message : e)
  }
}
