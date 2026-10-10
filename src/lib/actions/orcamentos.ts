'use server'

import { revalidatePath } from 'next/cache'
import { getPlatformRole, requireUser } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'
import type { ItemOrcamento } from '@/types/platform'

/**
 * CRM de orçamentos do fotógrafo (seção "Upgrade B2B"). Todo mundo aqui já é
 * dono do próprio orçamento por definição — `exigirEstudio()` confere o papel
 * e a RLS de `orcamentos` (fotografo_id = auth.uid()) faz o resto do trabalho
 * de isolamento; não existe `requireModuleAction` pra isso porque é uma
 * ferramenta pessoal do fotógrafo, não um módulo do admin.
 */

function assertRealMode() {
  if (isDemoMode()) throw new Error('Ação indisponível em modo de demonstração.')
}

/** O CRM de orçamentos é do estúdio: equipe e cliente final não usam. */
async function exigirEstudio() {
  const ctx = await requireUser()
  if ((await getPlatformRole()) !== 'fotografo') throw new Error('Apenas contas de estúdio usam orçamentos.')
  return ctx
}

function calcularTotal(itens: ItemOrcamento[]) {
  return itens.reduce((soma, item) => soma + item.quantidade * item.valorUnitario, 0)
}

export async function createOrcamento(input: { clienteFinalNome: string; clienteFinalContato: string; itens: ItemOrcamento[] }) {
  assertRealMode()
  const { supabase, user } = await exigirEstudio()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { data, error } = await supabase
    .from('orcamentos')
    .insert({
      fotografo_id: user.id,
      cliente_final_nome: input.clienteFinalNome,
      cliente_final_contato: input.clienteFinalContato || null,
      itens_json: input.itens,
      valor_total: calcularTotal(input.itens),
    })
    .select('id, hash_publico')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível criar o orçamento.')

  revalidatePath('/dashboard/orcamentos')
  return { id: data.id as string, hashPublico: data.hash_publico as string }
}

export async function updateOrcamento(
  id: string,
  input: { clienteFinalNome: string; clienteFinalContato: string; itens: ItemOrcamento[] },
) {
  assertRealMode()
  const { supabase } = await exigirEstudio()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase
    .from('orcamentos')
    .update({
      cliente_final_nome: input.clienteFinalNome,
      cliente_final_contato: input.clienteFinalContato || null,
      itens_json: input.itens,
      valor_total: calcularTotal(input.itens),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/orcamentos')
}

export async function markOrcamentoEnviado(id: string) {
  assertRealMode()
  const { supabase } = await exigirEstudio()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('orcamentos').update({ status: 'enviado' }).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/orcamentos')
}

export async function deleteOrcamento(id: string) {
  assertRealMode()
  const { supabase } = await exigirEstudio()
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { error } = await supabase.from('orcamentos').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/orcamentos')
}
