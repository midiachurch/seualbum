'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { getPlatformRole, requireUser } from '@/lib/supabase/queries'
import { colunasDoApontamento, type Apontamento } from '@/lib/apontamento'
import { normalizarAdicionais } from '@/lib/adicionais'
import type { ItemEscolhido } from '@/types/platform'

/**
 * Prova digital pelo fotógrafo, dono do projeto (/dashboard/albuns/[id]/prova).
 * Espelha `clientApprove` / `clientRequestChanges` / `addProofComment` de
 * `projetos.ts`, que exigem o portal do cliente final. No B2B o fotógrafo
 * revisa e aprova — ou repassa ao casal; os dois podem atuar.
 *
 * A RLS de `aprovacoes` e `prova_comentarios` (migration 0017) já aceita o
 * `projetos.fotografo_id`; a checagem aqui é para errar cedo e com mensagem.
 * Aprovar dispara `aplicar_aprovacao()`, que move o projeto para `aprovado`
 * (ou `alteracoes_solicitadas`) e registra no histórico.
 */

async function exigirFotografoDoProjeto(projetoId: string, { paraDecidir = false } = {}) {
  if (isDemoMode()) throw new Error('Ação indisponível em modo de demonstração.')
  if ((await getPlatformRole()) !== 'fotografo') throw new Error('Apenas o estúdio dono do projeto pode revisar a prova.')

  const { supabase, user } = await requireUser()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { data } = await supabase
    .from('projetos')
    .select('id, status')
    .eq('id', projetoId)
    .eq('fotografo_id', user.id)
    .maybeSingle()
  if (!data) throw new Error('Projeto não encontrado.')
  // Aprovar/pedir ajustes só com a prova liberada (não numa versão antiga
  // enquanto a equipe prepara a próxima).
  if (paraDecidir && data.status !== 'aguardando_aprovacao_cliente') {
    throw new Error('A prova não está aguardando aprovação no momento.')
  }

  return { supabase, user }
}

function revalidar(projetoId: string) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/meus-albuns')
  revalidatePath(`/dashboard/albuns/${projetoId}/prova`)
}

/**
 * O estúdio aprova — com os adicionais que ele mesmo escolheu (entram já
 * confirmados, pelo preço de custo). `aprovar_prova` (0026) decide entre
 * "Aprovado para impressão" e o fechamento pendente.
 */
export async function fotografoAprovar(projetoId: string, versao: number, adicionais: ItemEscolhido[] = []) {
  const { supabase } = await exigirFotografoDoProjeto(projetoId, { paraDecidir: true })
  const { error } = await supabase.rpc('aprovar_prova', {
    p_projeto_id: projetoId,
    p_versao: versao,
    p_adicionais: normalizarAdicionais(adicionais),
  })
  if (error) throw new Error(error.message)
  revalidar(projetoId)
}

/** O estúdio aceita ou recusa um adicional pedido pelo casal. */
export async function decidirAdicional(
  itemId: string,
  aceitar: boolean,
): Promise<{ ok: true; liberado: boolean } | { ok: false; erro: string }> {
  const { supabase, profile } = await requireUser()
  if (!supabase || profile?.role !== 'fotografo') return { ok: false, erro: 'Só o estúdio decide os adicionais.' }
  const { data, error } = await supabase.rpc('decidir_adicional', { p_item_id: itemId, p_aceitar: aceitar })
  if (error) {
    console.error('[decidirAdicional]', error.message)
    return { ok: false, erro: ['P0001', '42501', '42704'].includes(error.code ?? '') ? error.message : 'Não foi possível registrar a decisão.' }
  }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/meus-albuns')
  return { ok: true, liberado: data === 'liberado' }
}

export async function fotografoPedirAjustes(projetoId: string, versao: number, comentario: string) {
  const { supabase, user } = await exigirFotografoDoProjeto(projetoId, { paraDecidir: true })
  const { error } = await supabase
    .from('aprovacoes')
    .insert({ projeto_id: projetoId, versao, usuario_id: user.id, status: 'alteracao_solicitada', comentario })
  if (error) throw new Error(error.message)
  revalidar(projetoId)
}

export async function fotografoComentar(
  projetoId: string,
  pageIndex: number,
  versao: number,
  texto: string,
  apontamento?: Apontamento | null,
) {
  const { supabase, user } = await exigirFotografoDoProjeto(projetoId)
  const { error } = await supabase.from('prova_comentarios').insert({
    projeto_id: projetoId,
    page_index: pageIndex,
    versao,
    texto: texto.slice(0, 2000),
    autor_id: user.id,
    ...colunasDoApontamento(apontamento),
  })
  if (error) throw new Error(error.message)
}
