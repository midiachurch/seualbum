import { NextResponse } from 'next/server'
import { segredoValido, uuidValido } from '@/lib/portal/segredos'
import { r2Configurado, urlDeLeitura } from '@/lib/r2/cliente'
import { hashTokenEntrega } from '@/lib/store/token'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const CABECALHOS = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

/**
 * Download de UMA foto comprada. O banco só libera se o pedido estiver PAGO e
 * a foto fizer parte dele (store_entrega_foto); só então o servidor assina uma
 * URL curta do R2. Estorno ou pedido não pago derrubam o acesso na hora.
 * Arquivo legado (fora do R2) nunca é servido por bypass: a falha é registrada
 * para o estúdio agir.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; foto: string }> }) {
  const { token, foto } = await params
  if (!segredoValido(token) || !uuidValido(foto)) return new NextResponse('Entrega indisponível.', { status: 404, headers: CABECALHOS })
  const { data, error } = await createPublicClient().rpc('store_entrega_foto', { p_token_hash: hashTokenEntrega(token), p_foto_id: foto })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return new NextResponse('Entrega indisponível.', { status: 404, headers: CABECALHOS })
  const item = data as { pedido_id?: string; bucket?: string; path?: string; nome?: string | null }
  const registrar = async (motivo: string) => {
    try {
      if (uuidValido(item.pedido_id)) await createAdminClient().rpc('store_registrar_falha_entrega', { p_pedido: item.pedido_id, p_foto: foto, p_motivo: motivo })
    } catch { /* o aviso ao estúdio é best-effort: não pode derrubar a resposta */ }
  }
  if (item.bucket !== 'r2' || !item.path || !r2Configurado()) {
    await registrar(item.bucket !== 'r2' ? 'Arquivo fora do R2 (legado).' : 'Armazenamento não configurado.')
    return new NextResponse('Este arquivo ainda não está disponível. O estúdio foi avisado.', { status: 503, headers: CABECALHOS })
  }
  try {
    return NextResponse.redirect(await urlDeLeitura(item.path, { nomeDownload: item.nome ?? 'foto.jpg', expiraEmS: 300 }), { status: 307, headers: CABECALHOS })
  } catch {
    await registrar('Falha ao assinar a URL do R2.')
    return new NextResponse('Download temporariamente indisponível.', { status: 503, headers: CABECALHOS })
  }
}
