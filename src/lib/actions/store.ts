'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { segredoValido, uuidValido } from '@/lib/portal/segredos'
import { portalConfigurado, sessaoPortal } from '@/lib/portal/servidor'
import { adaptadorSimulado, pagamentoSimuladoPermitido } from '@/lib/store/pagamento'
import { hashTokenEntrega, tokenEntrega } from '@/lib/store/token'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/queries'
import type { StoreProdutoTipo } from '@/types/database'

const TIPOS: readonly StoreProdutoTipo[] = ['colecao_digital', 'foto_avulsa', 'impressao', 'servico']
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/

export type ProdutoStoreEntrada = { id: string; nome: string; tipo: string; precoCentavos: number; comissaoBps: number; ativo: boolean; descricao?: string | null }

/** Dono e admin gerem o catálogo; quem pode é decidido no banco pela sessão. */
export async function salvarProdutoStore(organizacaoId: string, p: ProdutoStoreEntrada) {
  const falha = { ok: false as const, erro: 'Não foi possível salvar o produto. Confira os dados.' }
  if (!uuidValido(organizacaoId) || !uuidValido(p?.id) || typeof p.nome !== 'string' || p.nome.trim().length < 2 || p.nome.length > 120) return falha
  if (!(TIPOS as readonly string[]).includes(p.tipo)) return falha
  if (!Number.isSafeInteger(p.precoCentavos) || p.precoCentavos < 0 || p.precoCentavos > 100_000_000) return falha
  if (!Number.isSafeInteger(p.comissaoBps) || p.comissaoBps < 0 || p.comissaoBps > 5000 || typeof p.ativo !== 'boolean') return falha
  if (p.descricao != null && (typeof p.descricao !== 'string' || p.descricao.length > 600)) return falha
  if (isDemoMode()) return { ok: false as const, erro: 'Demonstração: o produto não será gravado no servidor.' }
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('store_salvar_produto', {
      p_id: p.id, p_org: organizacaoId, p_nome: p.nome.trim(), p_tipo: p.tipo as StoreProdutoTipo,
      p_preco: p.precoCentavos, p_comissao_bps: p.comissaoBps, p_ativo: p.ativo, p_descricao: p.descricao ?? null,
    })
    if (error || data !== p.id) return falha
    revalidatePath('/dashboard/store')
    return { ok: true as const }
  } catch { return falha }
}

export async function vincularProdutoStore(projetoId: string, produtoId: string, vincular: boolean) {
  const falha = { ok: false as const, erro: 'Não foi possível atualizar a galeria.' }
  if (!uuidValido(projetoId) || !uuidValido(produtoId) || typeof vincular !== 'boolean') return falha
  if (isDemoMode()) return { ok: false as const, erro: 'Demonstração: nada será gravado no servidor.' }
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('store_vincular_produto', { p_projeto: projetoId, p_produto: produtoId, p_vincular: vincular })
    if (error || data !== true) return falha
    revalidatePath('/dashboard/store')
    return { ok: true as const }
  } catch { return falha }
}

export type CompraStoreEntrada = {
  chave: string
  nome: string
  email: string
  itens: { produtoId: string; quantidade?: number; fotoIds?: string[] }[]
  desfecho?: 'pago' | 'recusado'
}

/**
 * Compra pelo portal (comprador convidado, sem conta). O total NUNCA vem daqui:
 * o banco calcula pelo catálogo. O pagamento é simulado e só roda onde a flag
 * permite; em produção a Store falha fechada. O servidor aplica o evento de
 * pagamento (mesmo caminho que um webhook real usará), nunca o navegador.
 */
export async function finalizarCompraStore(link: string, e: CompraStoreEntrada) {
  const falha = { ok: false as const, erro: 'Não foi possível concluir a compra. Revise o carrinho e tente de novo.' }
  if (!segredoValido(link) || !uuidValido(e?.chave) || typeof e.nome !== 'string' || e.nome.trim().length < 2 || e.nome.length > 120) return falha
  if (typeof e.email !== 'string' || e.email.length > 254 || !EMAIL.test(e.email.trim())) return falha
  if (!Array.isArray(e.itens) || e.itens.length < 1 || e.itens.length > 50) return falha
  const itens = []
  for (const i of e.itens) {
    if (!uuidValido(i?.produtoId)) return falha
    const fotoIds = i.fotoIds ?? []
    if (!Array.isArray(fotoIds) || fotoIds.length > 1000 || !fotoIds.every(uuidValido)) return falha
    if (i.quantidade != null && (!Number.isInteger(i.quantidade) || i.quantidade < 1 || i.quantidade > 99)) return falha
    itens.push({ produto_id: i.produtoId, ...(i.quantidade != null ? { quantidade: i.quantidade } : {}), foto_ids: fotoIds })
  }
  const desfecho = e.desfecho ?? 'pago'
  if (desfecho !== 'pago' && desfecho !== 'recusado') return falha
  if (isDemoMode() || !portalConfigurado()) return { ok: false as const, erro: 'Loja indisponível neste ambiente.' }
  if (!pagamentoSimuladoPermitido()) return { ok: false as const, erro: 'O pagamento ainda não está disponível. Fale com o estúdio.' }
  const hash = await sessaoPortal(link)
  if (!hash) return { ok: false as const, erro: 'Acesso indisponível, expirado ou revogado. Confira o código ou peça um novo link.' }

  const token = tokenEntrega(e.chave)
  try {
    const { data, error } = await createPublicClient().rpc('store_criar_pedido', {
      p_sessao_hash: hash, p_chave: e.chave, p_nome: e.nome.trim(), p_email: e.email.trim(), p_itens: itens, p_token_hash: hashTokenEntrega(token),
    })
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return falha
    const pedido = data as { id?: unknown; status?: unknown; total_centavos?: unknown }
    if (!uuidValido(pedido.id) || typeof pedido.total_centavos !== 'number') return falha
    let status = String(pedido.status)
    if (status === 'pendente') {
      const r = await adaptadorSimulado().iniciar({ id: pedido.id, totalCentavos: pedido.total_centavos }, desfecho)
      const aplicado = await createAdminClient().rpc('store_aplicar_evento', {
        p_provedor: r.provedor, p_evento_id: r.eventoId, p_pedido: pedido.id, p_tipo: r.tipo, p_valor: r.valorCentavos,
      })
      if (aplicado.error) return falha
      status = String((aplicado.data as { status?: unknown } | null)?.status ?? status)
    }
    return { ok: true as const, status, entrega: `/loja/entrega/${token}` }
  } catch { return falha }
}
