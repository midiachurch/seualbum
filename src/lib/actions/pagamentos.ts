'use server'

import { headers } from 'next/headers'
import { isDemoMode } from '@/lib/demo-mode'
import { getStripe, stripeConfigurado } from '@/lib/stripe'
import { requireUser } from '@/lib/supabase/queries'

/**
 * Cria (ou reaproveita) a Checkout Session do Stripe para o fotógrafo pagar um
 * pedido `pendente`. O valor sai do plano no banco — nunca do navegador — e o
 * `pedido_id` vai no `metadata`, que é o que o webhook usa para achar o pedido.
 *
 * Métodos de pagamento: não passamos `payment_method_types`, então o Checkout
 * mostra o que estiver ativo no painel do Stripe (cartão; Pix quando habilitado
 * numa conta brasileira).
 */

export type IniciarPagamentoResult = { ok: true; url: string } | { ok: false; erro: string }

/** Origem de quem chamou — funciona em localhost, pelo IP da rede no celular e em produção. */
async function origemDaRequisicao() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.|192\.168\.|10\.)/.test(host) ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function iniciarPagamentoAction(pedidoId: string): Promise<IniciarPagamentoResult> {
  if (isDemoMode()) return { ok: false, erro: 'Pagamento indisponível em modo de demonstração.' }
  if (!stripeConfigurado()) {
    return { ok: false, erro: 'Pagamento ainda não configurado. Fale com a equipe.' }
  }
  if (typeof pedidoId !== 'string' || !/^[0-9a-f-]{36}$/i.test(pedidoId)) {
    return { ok: false, erro: 'Pedido inválido.' }
  }

  const { supabase, user, profile } = await requireUser()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  // `client_id = user.id` além da RLS: a equipe também enxerga todos os
  // pedidos, e não deve conseguir abrir checkout no nome de um fotógrafo.
  const { data: pedido, error } = await supabase
    .from('orders')
    .select('id, numero, nome_projeto, status, stripe_checkout_session_id, planos(nome_plano, preco, tipo_cobranca)')
    .eq('id', pedidoId)
    .eq('client_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[iniciarPagamentoAction] pedido', error)
    return { ok: false, erro: 'Não foi possível carregar o pedido. Tente de novo.' }
  }
  if (!pedido) return { ok: false, erro: 'Pedido não encontrado.' }

  const plano = pedido.planos as unknown as { nome_plano: string; preco: number; tipo_cobranca: string } | null
  // Antes da checagem de status: pedido de assinatura nunca gera cobrança
  // avulsa, esteja em que status estiver.
  if (plano?.tipo_cobranca === 'assinatura') {
    return { ok: false, erro: 'Este pedido não exige pagamento avulso.' }
  }
  if (pedido.status !== 'pendente') return { ok: false, erro: 'Este pedido já foi pago.' }
  if (!plano) return { ok: false, erro: 'Este pedido não tem plano. Fale com a equipe.' }

  const stripe = getStripe()

  // Clique duplo ou volta do Checkout sem pagar: reaproveita a sessão aberta
  // em vez de criar outra (duas sessões abertas = risco de pagar duas vezes).
  if (pedido.stripe_checkout_session_id) {
    try {
      const anterior = await stripe.checkout.sessions.retrieve(pedido.stripe_checkout_session_id)
      if (anterior.status === 'open' && anterior.url && anterior.metadata?.pedido_id === pedido.id) {
        return { ok: true, url: anterior.url }
      }
      // Pix gerado e ainda não compensado: não abre um segundo checkout.
      if (anterior.status === 'complete' && anterior.metadata?.pedido_id === pedido.id) {
        return { ok: false, erro: 'Pagamento em processamento. Assim que for confirmado, o pedido entra na fila.' }
      }
    } catch (e) {
      console.warn('[iniciarPagamentoAction] sessão anterior indisponível', e)
    }
  }

  const origem = await origemDaRequisicao()

  let session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'pt-BR',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: Math.round(Number(plano.preco) * 100),
            product_data: {
              name: `Plano ${plano.nome_plano}`,
              description: `Pedido #${pedido.numero} · ${pedido.nome_projeto}`,
            },
          },
        },
      ],
      metadata: { pedido_id: pedido.id },
      payment_intent_data: { metadata: { pedido_id: pedido.id } },
      client_reference_id: pedido.id,
      customer_email: profile?.email ?? user.email,
      success_url: `${origem}/dashboard/meus-albuns?sucesso=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origem}/dashboard/meus-albuns?pagamento=cancelado`,
    })
  } catch (e) {
    console.error('[iniciarPagamentoAction] stripe', e)
    return { ok: false, erro: 'Não foi possível abrir o pagamento. Tente de novo em instantes.' }
  }

  if (!session.url) return { ok: false, erro: 'Não foi possível abrir o pagamento. Tente de novo.' }

  const { error: saveError } = await supabase
    .from('orders')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', pedido.id)
  if (saveError) console.warn('[iniciarPagamentoAction] salvar sessão', saveError)

  return { ok: true, url: session.url }
}
