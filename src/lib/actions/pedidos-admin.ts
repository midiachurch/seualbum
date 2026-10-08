'use server'

import { createClient } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/demo-mode'
import { r2Configurado, urlDeLeitura } from '@/lib/r2/cliente'
import { getPlatformRole } from '@/lib/supabase/queries'
import { canAccess, EQUIPE_ROLES } from '@/types/platform'

/**
 * Download e visualização em alta das fotos de um pedido pela equipe
 * (/admin/pedidos/[id]). As fotos estão no Cloudflare R2; o índice é
 * `pedidos_fotos_r2` (migrations 0030/0031).
 *
 * Três barreiras antes de assinar qualquer URL:
 *   1. papel de equipe com acesso ao módulo `projetos` (mesma regra da esteira);
 *   2. o pedido existe e é lido com a sessão do usuário (RLS de `orders`);
 *   3. cada chave pedida está no índice DAQUELE pedido (lido com a RLS de
 *      `pedidos_fotos_r2`) — o navegador não consegue pedir a assinatura de
 *      um arquivo de outro pedido nem de uma chave inventada.
 */

const EXPIRACAO_SEGUNDOS = 60 * 60 // 1h
const MAX_POR_CHAMADA = 200

export type LinksDownloadResult =
  | { ok: true; links: { path: string; url: string }[] }
  | { ok: false; erro: string }

/**
 * `modo: 'download'` responde com Content-Disposition: attachment (o clique
 * baixa com o nome original); `'visualizar'` abre a imagem em alta numa aba.
 */
export async function gerarLinksDownloadAction(
  orderId: string,
  paths: string[],
  modo: 'download' | 'visualizar' = 'download',
): Promise<LinksDownloadResult> {
  if (isDemoMode()) return { ok: false, erro: 'Download indisponível em modo de demonstração.' }

  const role = await getPlatformRole()
  if (!role || !EQUIPE_ROLES.includes(role) || !canAccess(role, 'projetos')) {
    return { ok: false, erro: 'Sem permissão para baixar as fotos deste pedido.' }
  }

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { ok: false, erro: 'Pedido inválido.' }
  if (!Array.isArray(paths) || paths.length === 0) return { ok: false, erro: 'Nenhum arquivo selecionado.' }
  if (paths.length > MAX_POR_CHAMADA) return { ok: false, erro: `No máximo ${MAX_POR_CHAMADA} arquivos por vez.` }
  if (paths.some((p) => typeof p !== 'string')) return { ok: false, erro: 'Arquivo fora da pasta deste pedido.' }
  if (!r2Configurado()) return { ok: false, erro: 'Armazenamento de fotos não configurado. Fale com o suporte técnico.' }

  const supabase = await createClient()
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('client_id, chave_idempotencia')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError || !order) return { ok: false, erro: 'Pedido não encontrado.' }
  if (!order.chave_idempotencia) return { ok: false, erro: 'Este pedido não tem fotos enviadas pela plataforma.' }

  const { data: fotos, error } = await supabase
    .from('pedidos_fotos_r2')
    .select('r2_key, nome_original')
    .eq('client_id', order.client_id)
    .eq('chave_idempotencia', order.chave_idempotencia)
    .in('r2_key', paths)
  if (error) {
    console.error('[gerarLinksDownloadAction] índice', error.message)
    return { ok: false, erro: 'Não foi possível conferir os arquivos. Tente de novo.' }
  }
  if ((fotos ?? []).length !== new Set(paths).size) return { ok: false, erro: 'Arquivo fora da pasta deste pedido.' }

  try {
    const links = await Promise.all(
      fotos!.map(async (f) => ({
        path: f.r2_key,
        url: await urlDeLeitura(f.r2_key, {
          expiraEmS: EXPIRACAO_SEGUNDOS,
          nomeDownload: modo === 'download' ? f.nome_original : undefined,
        }),
      })),
    )
    // Mesma ordem em que o navegador pediu (o "Baixar tudo" segue a lista).
    const ordem = new Map(paths.map((p, i) => [p, i]))
    return { ok: true, links: links.sort((a, b) => ordem.get(a.path)! - ordem.get(b.path)!) }
  } catch (e) {
    console.error('[gerarLinksDownloadAction] r2', e)
    return { ok: false, erro: 'Não foi possível gerar os links de download. Tente de novo.' }
  }
}
