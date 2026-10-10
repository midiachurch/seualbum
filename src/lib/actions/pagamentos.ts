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

type SessaoAnterior = { tipo: 'reusar'; url: string } | { tipo: 'processando' } | { tipo: 'nova' } | { tipo: 'erro' }

/**
 * O que fazer com a Checkout Session já guardada no pedido/fatura antes de
 * abrir outra. Regra: nunca deixar duas sessões pagáveis ao mesmo tempo.
 *   - aberta, do mesmo item (e do mesmo valor, quando informado) → reusar;
 *   - aberta com outro valor → expira no Stripe antes de abrir a nova (senão
 *     a antiga continua pagável e cai em `valor_divergente`/pagamento duplo);
 *   - concluída e paga, ou Pix aguardando compensação → processando;
 *   - concluída mas com o pagamento falho/expirado (Pix vencido: o
 *     PaymentIntent volta a `requires_payment_method`) → nova; antes, ficava
 *     "em processamento" para sempre e o estúdio não conseguia mais pagar;
 *   - falha ao consultar/expirar no Stripe → erro (fail closed: não abre uma
 *     segunda sessão sem saber se a primeira ainda está aberta).
 */
async function avaliarSessaoAnterior(
  stripe: ReturnType<typeof getStripe>,
  sessionId: string,
  chave: 'pedido_id' | 'fatura_id',
  id: string,
  valorCentavos?: number,
): Promise<SessaoAnterior> {
  let anterior
  try {
    anterior = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] })
  } catch (e) {
    // Sessão que não existe nesta conta/modo (troca de chave test → live): segue.
    if ((e as { code?: string } | null)?.code === 'resource_missing') return { tipo: 'nova' }
    console.error('[pagamento] consultar sessão anterior', sessionId, e)
    return { tipo: 'erro' }
  }
  if (anterior.metadata?.[chave] !== id) return { tipo: 'nova' }

  if (anterior.status === 'open') {
    if (anterior.url && (valorCentavos === undefined || anterior.amount_total === valorCentavos)) {
      return { tipo: 'reusar', url: anterior.url }
    }
    try {
      await stripe.checkout.sessions.expire(anterior.id)
      return { tipo: 'nova' }
    } catch (e) {
      // Pode ter sido concluída agora mesmo — não arrisca uma segunda cobrança.
      console.error('[pagamento] expirar sessão anterior', sessionId, e)
      return { tipo: 'erro' }
    }
  }

  if (anterior.status === 'complete') {
    const intent = anterior.payment_intent
    const falhou =
      anterior.payment_status !== 'paid' &&
      intent !== null &&
      typeof intent === 'object' &&
      (intent.status === 'requires_payment_method' || intent.status === 'canceled')
    return falhou ? { tipo: 'nova' } : { tipo: 'processando' }
  }

  return { tipo: 'nova' }
}

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
    const anterior = await avaliarSessaoAnterior(stripe, pedido.stripe_checkout_session_id, 'pedido_id', pedido.id)
    if (anterior.tipo === 'reusar') return { ok: true, url: anterior.url }
    // Pix gerado e ainda não compensado: não abre um segundo checkout.
    if (anterior.tipo === 'processando') {
      return { ok: false, erro: 'Pagamento em processamento. Assim que for confirmado, o pedido entra na fila.' }
    }
    if (anterior.tipo === 'erro') return { ok: false, erro: 'Não foi possível abrir o pagamento. Tente de novo em instantes.' }
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

/* ------------------------------------------------------------------------ */
/* Fatura de fechamento (lâminas extras / adicionais) — migration 0035      */
/* ------------------------------------------------------------------------ */

/** Mensagens do banco que podem ir para a tela (as demais viram genéricas). */
function mensagemDoBanco(error: { code?: string; message: string }, padrao: string) {
  return ['P0001', '42501', '42704', '22023'].includes(error.code ?? '') ? error.message : padrao
}

/**
 * Checkout real da fatura de fechamento: o estúdio paga as lâminas extras e/ou
 * os adicionais, e o projeto vai para "Aprovado para impressão" quando o
 * webhook (ou a volta do Checkout) confirmar — `confirmar_pagamento_fatura`.
 *
 * O banco decide se pode pagar e quanto (`preparar_checkout_fatura`): só o
 * estúdio dono, fatura pendente, nenhum adicional aguardando o estúdio. O
 * `fatura_id` vai no `metadata` — é por ele que o webhook separa fatura de
 * pedido.
 */
export async function iniciarPagamentoFaturaAction(faturaId: string): Promise<IniciarPagamentoResult> {
  if (isDemoMode()) return { ok: false, erro: 'Pagamento indisponível em modo de demonstração.' }
  if (!stripeConfigurado()) {
    return { ok: false, erro: 'Pagamento ainda não configurado. Fale com a equipe.' }
  }
  if (typeof faturaId !== 'string' || !/^[0-9a-f-]{36}$/i.test(faturaId)) {
    return { ok: false, erro: 'Fatura inválida.' }
  }

  const { supabase, user, profile } = await requireUser()
  if (!supabase || profile?.role !== 'fotografo') {
    return { ok: false, erro: 'Só o estúdio dono do projeto paga esta fatura.' }
  }

  const { data, error } = await supabase.rpc('preparar_checkout_fatura', { p_fatura_id: faturaId })
  if (error) {
    console.error('[iniciarPagamentoFaturaAction] preparar', error.message)
    return { ok: false, erro: mensagemDoBanco(error, 'Não foi possível carregar a fatura. Tente de novo.') }
  }
  const fatura = Array.isArray(data) ? data[0] : null
  if (!fatura) return { ok: false, erro: 'Fatura não encontrada ou já processada.' }

  const valorCentavos = Math.round(Number(fatura.valor_total) * 100)
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) return { ok: false, erro: 'Fatura sem valor a cobrar.' }

  const stripe = getStripe()

  // Clique duplo ou volta do Checkout sem pagar: reaproveita a sessão aberta
  // se ainda for do mesmo valor (duas sessões abertas = risco de pagar duas vezes).
  if (fatura.stripe_checkout_session_id) {
    const anterior = await avaliarSessaoAnterior(
      stripe,
      fatura.stripe_checkout_session_id,
      'fatura_id',
      fatura.fatura_id,
      valorCentavos,
    )
    if (anterior.tipo === 'reusar') return { ok: true, url: anterior.url }
    // Pix gerado e ainda não compensado: não abre um segundo checkout.
    if (anterior.tipo === 'processando') {
      return { ok: false, erro: 'Pagamento em processamento. Assim que for confirmado, o álbum segue para impressão.' }
    }
    if (anterior.tipo === 'erro') return { ok: false, erro: 'Não foi possível abrir o pagamento. Tente de novo em instantes.' }
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
            unit_amount: valorCentavos,
            product_data: {
              name: 'Fechamento do álbum',
              description: `Projeto #${fatura.projeto_numero} · ${fatura.projeto_nome} · lâminas extras e adicionais`,
            },
          },
        },
      ],
      metadata: { fatura_id: fatura.fatura_id, projeto_id: fatura.projeto_id },
      payment_intent_data: { metadata: { fatura_id: fatura.fatura_id, projeto_id: fatura.projeto_id } },
      client_reference_id: fatura.fatura_id,
      customer_email: profile?.email ?? user.email,
      success_url: `${origem}/dashboard/meus-albuns?fechamento=sucesso&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origem}/dashboard/meus-albuns?fechamento=cancelado`,
    })
  } catch (e) {
    console.error('[iniciarPagamentoFaturaAction] stripe', e)
    return { ok: false, erro: 'Não foi possível abrir o pagamento. Tente de novo em instantes.' }
  }

  if (!session.url) return { ok: false, erro: 'Não foi possível abrir o pagamento. Tente de novo.' }

  const { error: saveError } = await supabase.rpc('registrar_checkout_fatura', {
    p_fatura_id: fatura.fatura_id,
    p_session_id: session.id,
  })
  if (saveError) console.warn('[iniciarPagamentoFaturaAction] salvar sessão', saveError.message)

  return { ok: true, url: session.url }
}
