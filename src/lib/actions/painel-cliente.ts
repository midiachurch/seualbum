'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { requireClientPortal } from '@/lib/supabase/queries'
import type { EstadoRevisaoLamina } from '@/types/platform'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ResultadoRevisao = { ok: true; estado: EstadoRevisaoLamina } | { ok: false; erro: string }

/**
 * Checklist do cliente na prova (migration 0039).
 *
 * - `'vista'`: a prova grava sozinha quando o cliente abre a lâmina. Nunca
 *   rebaixa uma lâmina já aprovada (upsert que ignora a linha existente).
 * - `'aprovada'`: "Esta lâmina está ok".
 * - `'desfazer'`: tira o "ok" (volta para vista).
 *
 * Projeto e versão gravados vêm da lâmina (trigger); a RLS só aceita o
 * cliente dono do projeto, com a prova aguardando decisão e na versão
 * liberada mais recente.
 */
export async function marcarLaminaRevisada(
  projetoId: string,
  laminaId: string,
  acao: 'vista' | 'aprovada' | 'desfazer',
): Promise<ResultadoRevisao> {
  const estado: EstadoRevisaoLamina = acao === 'aprovada' ? 'aprovada' : 'vista'
  if (!UUID.test(projetoId) || !UUID.test(laminaId)) return { ok: false, erro: 'Lâmina inválida.' }
  if (isDemoMode()) return { ok: true, estado }

  const { supabase } = await requireClientPortal()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  // `versao` é obrigatória na tabela, mas o trigger troca pela da lâmina.
  const linha = { projeto_id: projetoId, lamina_id: laminaId, versao: 1, estado }
  const { error } =
    acao === 'vista'
      ? await supabase.from('prova_laminas_revisao').upsert(linha, { onConflict: 'lamina_id,usuario_id', ignoreDuplicates: true })
      : await supabase.from('prova_laminas_revisao').upsert(linha, { onConflict: 'lamina_id,usuario_id' })
  if (error) {
    console.error('[marcarLaminaRevisada]', error.message)
    return {
      ok: false,
      erro:
        error.code === '42501'
          ? 'Esta prova não está mais aberta para revisão.'
          : 'Não foi possível salvar. Tente de novo.',
    }
  }

  if (acao !== 'vista') revalidatePath(`/cliente/projetos/${projetoId}`)
  return { ok: true, estado }
}
