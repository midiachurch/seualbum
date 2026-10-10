import 'server-only'

import { abrirConversa, listarConversas, listarMensagens } from '@/lib/actions/mensagens'
import { isDemoMode } from '@/lib/demo-mode'
import { requireUser } from '@/lib/supabase/queries'
import { ehUuid, type CanalConversa, type OpcaoLamina, type PaginaDeMensagens } from '@/lib/mensagens'
import type { Project } from '@/types/platform'

/**
 * Montagem dos fios para as páginas (Server Components). As Server Actions
 * de `@/lib/actions/mensagens` fazem as checagens; aqui só junta "abrir o
 * fio" + "primeira página de mensagens".
 */

export type FioCarregado = { conversaId: string; inicial: PaginaDeMensagens }

/** Abre (busca ou cria) o fio e traz a primeira página. null = sem acesso/erro. */
export async function abrirFio(canal: CanalConversa, opcoes: { projetoId?: string; fotografoId?: string } = {}): Promise<FioCarregado | null> {
  const aberto = await abrirConversa({ canal, projetoId: opcoes.projetoId ?? null, fotografoId: opcoes.fotografoId ?? null })
  if (!aberto.ok) return null
  return carregarFio(aberto.conversaId)
}

/** Fio que já existe (sem criar) — a equipe lendo a conversa do cliente com o estúdio. */
export async function buscarFio(canal: CanalConversa, projetoId: string): Promise<FioCarregado | null> {
  const lista = await listarConversas({ canal, projetoId, incluirVazias: true, limite: 1 })
  const conversa = lista.ok ? lista.conversas[0] : undefined
  return conversa ? carregarFio(conversa.id) : null
}

export async function carregarFio(conversaId: string): Promise<FioCarregado | null> {
  const pagina = await listarMensagens(conversaId)
  if (!pagina.ok) return null
  return { conversaId, inicial: { mensagens: pagina.mensagens, temMais: pagina.temMais, vistoAte: pagina.vistoAte } }
}

/**
 * Lâminas que podem ser citadas: as da versão mais recente que a pessoa vê.
 * Estúdio e cliente só citam versão liberada (a RLS das lâminas também barra).
 */
export function opcoesDeLaminas(project: Project, { somenteLiberadas }: { somenteLiberadas: boolean }): OpcaoLamina[] {
  const versoes = project.designVersions
    .filter((v) => (v.laminas?.length ?? 0) > 0 && (!somenteLiberadas || v.status === 'aprovada'))
    .sort((a, b) => b.numero - a.numero)
  const versao = versoes[0]
  if (!versao?.laminas) return []
  return versao.laminas
    .filter((l) => ehUuid(l.id))
    .map((l) => ({ id: l.id, rotulo: l.ehCapa ? `Capa (v${versao.numero})` : `Lâmina ${l.ordem} (v${versao.numero})` }))
}

/** Estúdios para o filtro/"nova conversa" da equipe (a RLS de `fotografos` decide quem vê). */
export async function listarEstudios(): Promise<{ id: string; estudio: string }[]> {
  if (isDemoMode()) return []
  const { supabase } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase.from('fotografos').select('id, estudio').order('estudio')
  if (error) console.error('[mensagens:estudios]', error.message)
  return (data ?? []) as { id: string; estudio: string }[]
}

/** Projetos do estúdio logado, para abrir conversa sobre um deles. */
export async function listarProjetosDoEstudio(): Promise<{ id: string; nome: string; numero: number }[]> {
  if (isDemoMode()) return []
  const { supabase, user } = await requireUser()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('projetos')
    .select('id, nome, numero')
    .eq('fotografo_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) console.error('[mensagens:projetos]', error.message)
  return (data ?? []) as { id: string; nome: string; numero: number }[]
}
