import 'server-only'

import { isDemoMode } from '@/lib/demo-mode'
import { requireUser } from '@/lib/supabase/queries'
import { semMigracaoDiagramacao, type DiagramacaoItemRow, type ResumoDiagramacao } from '@/lib/diagramacao/regras'
import type { AlbumTemplateRow } from '@/types/database'

/**
 * Leituras do centro de controle da diagramação (migration 0038). Separadas de
 * `queries.ts` de propósito: tudo aqui depende da view `diagramacao_itens` e
 * da RPC `diagramacao_resumo`. Sem a migration, devolvem `semMigracao: true`
 * em vez de derrubar o dashboard.
 */

export type Carregado<T> = { dados: T; semMigracao: boolean }

/** KPIs, carga por diagramador e os mais urgentes — uma RPC, agregada no banco. */
export async function getResumoDiagramacao(urgentes = 6): Promise<Carregado<ResumoDiagramacao | null>> {
  if (isDemoMode()) return { dados: null, semMigracao: false }
  const { supabase } = await requireUser()
  if (!supabase) return { dados: null, semMigracao: false }
  const { data, error } = await supabase.rpc('diagramacao_resumo', { p_urgentes: urgentes })
  if (error) {
    if (semMigracaoDiagramacao(error.message)) return { dados: null, semMigracao: true }
    console.error('[getResumoDiagramacao]', error.message)
    return { dados: null, semMigracao: false }
  }
  return { dados: (data as ResumoDiagramacao | null) ?? null, semMigracao: false }
}

/** Todos os itens em diagramação (projetos + avulsos), para a tabela do centro de controle. */
export async function getItensDiagramacao(): Promise<Carregado<DiagramacaoItemRow[]>> {
  if (isDemoMode()) return { dados: [], semMigracao: false }
  const { supabase } = await requireUser()
  if (!supabase) return { dados: [], semMigracao: false }
  const { data, error } = await supabase
    .from('diagramacao_itens')
    .select('*')
    .order('prazo', { ascending: true, nullsFirst: false })
    .limit(2000)
  if (error) {
    if (semMigracaoDiagramacao(error.message)) return { dados: [], semMigracao: true }
    console.error('[getItensDiagramacao]', error.message)
    return { dados: [], semMigracao: false }
  }
  return { dados: (data ?? []) as DiagramacaoItemRow[], semMigracao: false }
}

/** Templates de lâmina para a gestão — inclusive os desativados (o editor só vê os ativos). */
export async function getTemplatesParaGestao(): Promise<AlbumTemplateRow[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('album_templates')
    .select('*')
    .order('nome', { ascending: true })
    .limit(1000)
  if (error) {
    if (!/album_templates|schema cache/i.test(error.message)) console.error('[getTemplatesParaGestao]', error.message)
    return []
  }
  return (data ?? []) as AlbumTemplateRow[]
}
