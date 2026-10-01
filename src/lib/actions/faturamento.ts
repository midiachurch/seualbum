'use server'

import { revalidatePath } from 'next/cache'
import { requireModuleAction, requireUser } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'

/**
 * Fechamento e cobrança de lâminas extras (Fase 5, migration 0023).
 *
 * Nada aqui CRIA fatura: quem bate o martelo é o banco, no gatilho da
 * aprovação (`aplicar_aprovacao`), contando as lâminas da versão aprovada
 * contra a franquia congelada no pedido. As ações só pagam ou dispensam uma
 * fatura que o banco já emitiu — e o próprio banco confere quem pode.
 *
 * Antes (0008) a prova do cliente criava a fatura pelo navegador e o cliente
 * "pagava e aprovava" por uma função aberta: dava para gerar fatura de R$ 0.
 */

type Resultado = { ok: true } | { ok: false; erro: string }

/** Mensagens do banco que podem ir para a tela (as demais viram genéricas). */
function mensagemDoBanco(error: { code?: string; message: string }, padrao: string) {
  return ['P0001', '42501', '42704', '22023'].includes(error.code ?? '') ? error.message : padrao
}

/**
 * Fotógrafo paga as lâminas extras. Enquanto o Stripe estiver congelado, o
 * pagamento é SIMULADO (`pagar_fatura_simulada` — o banco recusa se o modo
 * simulado for desligado em private.app_config). Pago → "Aprovado para
 * impressão" e o álbum entra na fila da gráfica.
 */
export async function pagarLaminasExtras(faturaId: string, forma: 'cartao' | 'pix'): Promise<Resultado> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  if (forma !== 'cartao' && forma !== 'pix') return { ok: false, erro: 'Forma de pagamento inválida.' }

  const { supabase, profile } = await requireUser()
  if (!supabase || profile?.role !== 'fotografo') return { ok: false, erro: 'Só o estúdio dono do projeto paga esta fatura.' }

  const { error } = await supabase.rpc('pagar_fatura_simulada', { p_fatura_id: faturaId, p_forma: forma })
  if (error) {
    console.error('[pagarLaminasExtras]', error.message)
    return { ok: false, erro: mensagemDoBanco(error, 'Não foi possível confirmar o pagamento. Tente de novo.') }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/meus-albuns')
  return { ok: true }
}

/**
 * Cortesia: a gestão (admin/gestor) dispensa a cobrança, com motivo
 * registrado, e o projeto vai direto para "Aprovado para impressão".
 */
export async function dispensarCobranca(faturaId: string, projetoId: string, motivo: string): Promise<Resultado> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const { supabase } = await requireModuleAction('projetos', 'aprovar')
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { error } = await supabase.rpc('dispensar_fatura', { p_fatura_id: faturaId, p_motivo: motivo.slice(0, 500) })
  if (error) {
    console.error('[dispensarCobranca]', error.message)
    return { ok: false, erro: mensagemDoBanco(error, 'Não foi possível dispensar a cobrança. Tente de novo.') }
  }

  revalidatePath(`/admin/projetos/${projetoId}`)
  revalidatePath('/admin/producao/grafica')
  return { ok: true }
}
