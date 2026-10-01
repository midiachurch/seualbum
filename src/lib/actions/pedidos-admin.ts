'use server'

import { createClient } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/demo-mode'
import { getPlatformRole, pastaFotosPedido } from '@/lib/supabase/queries'
import { canAccess, EQUIPE_ROLES } from '@/types/platform'

/**
 * Download das fotos de um pedido pela equipe (/admin/pedidos/[id]).
 *
 * Três barreiras antes de assinar qualquer URL:
 *   1. papel de equipe com acesso ao módulo `projetos` (mesma regra da esteira);
 *   2. o pedido existe e é lido com a sessão do usuário (RLS de `orders`);
 *   3. cada path pedido fica DENTRO da pasta daquele pedido — o navegador não
 *      consegue pedir a assinatura de um arquivo de outro pedido.
 * A policy `pedidos_fotos_select_dono_ou_equipe` do Storage é a quarta.
 */

const EXPIRACAO_SEGUNDOS = 60 * 60 // 1h
const MAX_POR_CHAMADA = 200

export type LinksDownloadResult =
  | { ok: true; links: { path: string; url: string }[] }
  | { ok: false; erro: string }

export async function gerarLinksDownloadAction(orderId: string, paths: string[]): Promise<LinksDownloadResult> {
  if (isDemoMode()) return { ok: false, erro: 'Download indisponível em modo de demonstração.' }

  const role = await getPlatformRole()
  if (!role || !EQUIPE_ROLES.includes(role) || !canAccess(role, 'projetos')) {
    return { ok: false, erro: 'Sem permissão para baixar as fotos deste pedido.' }
  }

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { ok: false, erro: 'Pedido inválido.' }
  if (!Array.isArray(paths) || paths.length === 0) return { ok: false, erro: 'Nenhum arquivo selecionado.' }
  if (paths.length > MAX_POR_CHAMADA) return { ok: false, erro: `No máximo ${MAX_POR_CHAMADA} arquivos por vez.` }

  const supabase = await createClient()
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('client_id, chave_idempotencia')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError || !order) return { ok: false, erro: 'Pedido não encontrado.' }

  const pasta = pastaFotosPedido(order)
  if (!pasta) return { ok: false, erro: 'Este pedido não tem fotos no Storage.' }

  const fora = paths.some(
    (p) => typeof p !== 'string' || !p.startsWith(`${pasta}/`) || p.includes('..') || p.slice(pasta.length + 1).includes('/'),
  )
  if (fora) return { ok: false, erro: 'Arquivo fora da pasta deste pedido.' }

  // `download: true` responde com Content-Disposition: attachment — o clique
  // baixa o arquivo em vez de abrir a imagem numa aba.
  const { data, error } = await supabase.storage
    .from('pedidos_fotos')
    .createSignedUrls(paths, EXPIRACAO_SEGUNDOS, { download: true })

  if (error || !data) {
    console.error('[gerarLinksDownloadAction]', error)
    return { ok: false, erro: 'Não foi possível gerar os links de download. Tente de novo.' }
  }

  const links = data.flatMap((item) => (item.signedUrl && item.path ? [{ path: item.path, url: item.signedUrl }] : []))
  if (links.length === 0) return { ok: false, erro: 'Arquivos não encontrados no Storage.' }

  return { ok: true, links }
}
