'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'

/**
 * O fotógrafo configura o próprio catálogo de adicionais (0026): se oferece
 * cada item ao casal e por quanto vende. É exatamente o que o modal de oferta
 * da prova puxa (`ofertas_da_prova`). A RLS só deixa gravar a linha dele.
 */

export type ConfigAdicional = { adicionalId: string; precoVenda: number | null; oferecer: boolean }

const PRECO_MAXIMO = 99_999

export async function salvarCatalogoEstudio(itens: ConfigAdicional[]): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const { supabase, user, profile } = await requireUser()
  if (!supabase || profile?.role !== 'fotografo') return { ok: false, erro: 'Só o estúdio configura o catálogo.' }
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 50) return { ok: false, erro: 'Nada para salvar.' }

  const linhas = []
  for (const i of itens) {
    if (typeof i?.adicionalId !== 'string' || !/^[0-9a-f-]{36}$/.test(i.adicionalId)) return { ok: false, erro: 'Item inválido.' }
    const preco = i.precoVenda === null ? null : Math.round(Number(i.precoVenda) * 100) / 100
    if (preco !== null && (!Number.isFinite(preco) || preco < 0 || preco > PRECO_MAXIMO)) {
      return { ok: false, erro: 'Preço de venda inválido.' }
    }
    linhas.push({
      fotografo_id: user.id,
      adicional_id: i.adicionalId,
      preco_revenda: preco,
      oferecer_ao_cliente: Boolean(i.oferecer),
      updated_at: new Date().toISOString(),
    })
  }

  const { error } = await supabase.from('adicionais_estudio').upsert(linhas, { onConflict: 'fotografo_id,adicional_id' })
  if (error) {
    console.error('[salvarCatalogoEstudio]', error.message)
    return { ok: false, erro: 'Não foi possível salvar. Tente de novo.' }
  }
  revalidatePath('/dashboard/catalogo')
  return { ok: true }
}
