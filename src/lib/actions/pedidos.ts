'use server'

import { revalidatePath } from 'next/cache'
import { getPlatformRole, requireUser } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'

/**
 * Envio do wizard de novo pedido (/dashboard/novo-pedido) para `orders`.
 *
 * O payload vem do navegador (store do Zustand), então tudo é revalidado aqui —
 * as regras batem com os CHECKs da tabela para o erro sair em português antes
 * de chegar no banco. `client_id` sai da sessão, nunca do payload, e o status
 * inicial é `pendente` (o único que a RLS `orders_insert_own` aceita).
 *
 * Idempotência: `chaveIdempotencia` nasce com o rascunho no navegador e vai
 * para `orders.chave_idempotencia` (UNIQUE). Se o mesmo rascunho chegar duas
 * vezes — rede caiu depois do INSERT, toque duplo — a segunda bate no UNIQUE
 * e devolvemos o pedido que já existe, como sucesso.
 *
 * Fotos: sobem direto do navegador para `pedidos_fotos/{userId}/{chave}/`
 * (passo 3). Aqui só contamos o que está de fato no Storage — o número que vai
 * para `fotos_enviadas` nunca vem do payload. O pedido precisa de fotos
 * enviadas OU do link externo (CHECK `orders_origem_fotos_check`).
 *
 * Roteamento financeiro: plano avulso → `pendente` (paga no Stripe Checkout);
 * plano de assinatura → `na_fila_design` direto, sem cobrança avulsa — desde
 * que seja o plano contratado pelo estúdio (`minha_assinatura()`, migration
 * 0013). A RLS de INSERT aplica a mesma regra; aqui é para a mensagem de erro.
 *
 * Devolve `{ ok }` em vez de lançar: em produção o Next troca a mensagem de
 * erros lançados por uma genérica, e o fotógrafo precisa ver o motivo.
 */

export interface NovoPedidoPayload {
  chaveIdempotencia: string
  planoId: string
  nomeProjeto: string
  /** yyyy-mm-dd ou vazio. */
  dataEvento: string
  nomeCliente: string
  telefoneCliente: string
  emailCliente: string
  linkFotos: string
  estilo: string
  observacoes: string
}

export type CriarPedidoResult =
  /** `semPagamento`: pedido de assinante, já nasceu na fila de design. */
  | { ok: true; numero: number | null; semPagamento: boolean }
  | { ok: false; erro: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UNIQUE_VIOLATION = '23505'
const CONSTRAINT_IDEMPOTENCIA = 'orders_chave_idempotencia_key'

function texto(valor: unknown, max: number) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : ''
}

function validar(input: NovoPedidoPayload): { erro: string } | { dados: NovoPedidoPayload } {
  const dados = {
    chaveIdempotencia: texto(input.chaveIdempotencia, 36),
    planoId: texto(input.planoId, 64),
    nomeProjeto: texto(input.nomeProjeto, 160),
    dataEvento: texto(input.dataEvento, 10),
    nomeCliente: texto(input.nomeCliente, 120),
    telefoneCliente: texto(input.telefoneCliente, 30),
    emailCliente: texto(input.emailCliente, 160),
    linkFotos: texto(input.linkFotos, 2000),
    estilo: texto(input.estilo, 60),
    observacoes: texto(input.observacoes, 5000),
  }

  // Sem chave válida o rascunho é de uma versão antiga da página — recarregar gera uma.
  if (!UUID_RE.test(dados.chaveIdempotencia)) {
    return { erro: 'Rascunho desatualizado. Recarregue a página e tente de novo.' }
  }
  if (!dados.planoId) return { erro: 'Escolha um plano.' }
  if (dados.nomeProjeto.length < 2) return { erro: 'Informe o nome do casal ou do evento.' }
  if (dados.dataEvento && (!DATA_RE.test(dados.dataEvento) || Number.isNaN(Date.parse(dados.dataEvento)))) {
    return { erro: 'Data do evento inválida.' }
  }
  if (dados.emailCliente && !EMAIL_RE.test(dados.emailCliente)) {
    return { erro: 'E-mail do cliente inválido.' }
  }
  if (dados.linkFotos) {
    try {
      if (new URL(dados.linkFotos).protocol !== 'https:') throw new Error()
    } catch {
      return { erro: 'O link das fotos precisa começar com https://' }
    }
  }
  if (!dados.estilo) return { erro: 'Escolha o estilo do álbum.' }

  return { dados }
}

export async function criarPedidoAction(input: NovoPedidoPayload): Promise<CriarPedidoResult> {
  const validacao = validar(input)
  if ('erro' in validacao) return { ok: false, erro: validacao.erro }
  const { dados } = validacao

  const { supabase, user } = await requireUser()

  // Mesma regra da página /dashboard/novo-pedido: só o estúdio cria pedido.
  if ((await getPlatformRole()) !== 'fotografo') {
    return { ok: false, erro: 'Apenas contas de estúdio (fotógrafo) podem criar pedidos.' }
  }

  // Modo demonstração: não há banco, mas o fluxo de conclusão precisa ser navegável.
  if (isDemoMode() || !supabase) {
    return { ok: true, numero: null, semPagamento: false }
  }

  if (!UUID_RE.test(dados.planoId)) return { ok: false, erro: 'Plano inválido. Escolha novamente.' }

  const { data: plano, error: planoError } = await supabase
    .from('planos')
    .select('id, tipo_cobranca')
    .eq('id', dados.planoId)
    .eq('ativo', true)
    .maybeSingle()
  if (planoError) {
    console.error('[criarPedidoAction] plano', planoError)
    return { ok: false, erro: 'Não foi possível validar o plano. Tente de novo.' }
  }
  if (!plano) return { ok: false, erro: 'Esse plano não está mais disponível. Escolha outro.' }

  const assinatura = plano.tipo_cobranca === 'assinatura'
  if (assinatura) {
    const { data: minhaAssinatura, error: assinaturaError } = await supabase.rpc('minha_assinatura')
    if (assinaturaError) {
      console.error('[criarPedidoAction] minha_assinatura', assinaturaError)
      return { ok: false, erro: 'Não foi possível conferir sua assinatura. Tente de novo.' }
    }
    if (minhaAssinatura !== plano.id) {
      return {
        ok: false,
        erro: 'Esse plano de assinatura não está ativo para o seu estúdio. Escolha um plano avulso ou fale com a equipe.',
      }
    }
  }

  const fotosEnviadas = await contarFotosNoStorage(supabase, user.id, dados.chaveIdempotencia)
  if (fotosEnviadas === null) {
    return { ok: false, erro: 'Não foi possível conferir as fotos enviadas. Tente de novo.' }
  }
  if (fotosEnviadas === 0 && !dados.linkFotos) {
    // Também é o caso do rascunho parado há mais de 72h: a limpeza automática
    // (migrations 0015/0016) apaga as fotos, mas o navegador ainda as lista.
    return {
      ok: false,
      erro: 'Não encontramos as fotos deste pedido. Rascunhos parados por mais de 72h têm as fotos apagadas — volte ao passo 3, remova as fotos da lista e envie de novo (ou informe o link da pasta).',
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      client_id: user.id,
      plan_id: dados.planoId,
      nome_projeto: dados.nomeProjeto,
      data_evento: dados.dataEvento || null,
      cliente_final_nome: dados.nomeCliente || null,
      cliente_final_telefone: dados.telefoneCliente || null,
      cliente_final_email: dados.emailCliente || null,
      link_fotos_brutas: dados.linkFotos || null,
      fotos_enviadas: fotosEnviadas,
      estilo_design: dados.estilo,
      briefing: dados.observacoes || null,
      chave_idempotencia: dados.chaveIdempotencia,
      status: assinatura ? 'na_fila_design' : 'pendente',
    })
    .select('numero')
    .single()

  // supabase-js não lança em erro do Postgres — devolve `error.code`. Violação
  // do UNIQUE da chave = este rascunho já virou pedido numa requisição anterior.
  if (error?.code === UNIQUE_VIOLATION && error.message.includes(CONSTRAINT_IDEMPOTENCIA)) {
    return pedidoJaCriado(supabase, dados.chaveIdempotencia)
  }

  if (error || !data) {
    console.error('[criarPedidoAction] insert', error)
    return { ok: false, erro: 'Não foi possível enviar o pedido. Seu rascunho continua salvo — tente de novo.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/meus-albuns')
  revalidatePath('/admin/pedidos')

  return { ok: true, numero: Number(data.numero), semPagamento: assinatura }
}

type SupabaseServer = NonNullable<Awaited<ReturnType<typeof requireUser>>['supabase']>

/** Conta os arquivos na pasta do rascunho. `null` = não deu para listar. */
async function contarFotosNoStorage(supabase: SupabaseServer, userId: string, chave: string) {
  const PAGINA = 1000
  let total = 0
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await supabase.storage
      .from('pedidos_fotos')
      .list(`${userId}/${chave}`, { limit: PAGINA, offset })
    if (error) {
      console.error('[criarPedidoAction] storage.list', error)
      return null
    }
    // Pastas vêm com `id: null`; só arquivos contam.
    total += data.filter((item) => item.id !== null).length
    if (data.length < PAGINA) return total
  }
}

/** Busca o pedido que a requisição anterior criou. A RLS só mostra os do próprio fotógrafo. */
async function pedidoJaCriado(supabase: SupabaseServer, chave: string): Promise<CriarPedidoResult> {
  const { data } = await supabase
    .from('orders')
    .select('numero, status')
    .eq('chave_idempotencia', chave)
    .maybeSingle()

  if (!data) {
    return { ok: false, erro: 'Este pedido já está em processamento. Confira em Meus álbuns.' }
  }
  return { ok: true, numero: Number(data.numero), semPagamento: data.status !== 'pendente' }
}
