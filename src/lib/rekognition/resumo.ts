import 'server-only'

import { isDemoMode } from '@/lib/demo-mode'
import { rekognitionConfigurado } from '@/lib/rekognition/cliente'
import { createClient } from '@/lib/supabase/server'

export type ResumoReconhecimento = {
  configurado: boolean
  /** Fim da retenção (ISO), ou null com a busca desligada. */
  expiraEm: string | null
  fotos: number
  indexadas: number
  semRosto: number
  naoSuportadas: number
  erros: number
}

/**
 * Estado do reconhecimento facial de um projeto para o card da equipe
 * (migration 0042). Contagens pela sessão (RLS `pode_ver_projeto`), uma
 * consulta `head` por estado — não esbarra no limite de linhas do PostgREST.
 */
export async function resumoReconhecimento(projetoId: string): Promise<ResumoReconhecimento> {
  const vazio = { expiraEm: null, fotos: 0, indexadas: 0, semRosto: 0, naoSuportadas: 0, erros: 0 }
  if (isDemoMode() || !rekognitionConfigurado()) return { configurado: false, ...vazio }

  const supabase = await createClient()
  const { data: ativo } = await supabase
    .from('reconhecimento_projetos')
    .select('expira_em')
    .eq('projeto_id', projetoId)
    .gt('expira_em', new Date().toISOString())
    .maybeSingle()
  if (!ativo) return { configurado: true, ...vazio }

  const contar = async (status: 'indexada' | 'sem_rosto' | 'nao_suportada' | 'erro') => {
    const { count } = await supabase
      .from('reconhecimento_fotos')
      .select('foto_id', { count: 'exact', head: true })
      .eq('projeto_id', projetoId)
      .eq('status', status)
    return count ?? 0
  }
  const [{ count: fotos }, indexadas, semRosto, naoSuportadas, erros] = await Promise.all([
    supabase.from('fotos').select('id', { count: 'exact', head: true }).eq('projeto_id', projetoId).eq('bucket', 'r2'),
    contar('indexada'),
    contar('sem_rosto'),
    contar('nao_suportada'),
    contar('erro'),
  ])
  return { configurado: true, expiraEm: ativo.expira_em, fotos: fotos ?? 0, indexadas, semRosto, naoSuportadas, erros }
}
