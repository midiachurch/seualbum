import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'
import { sessaoPortal } from '@/lib/portal/servidor'
import { uuidValido } from '@/lib/portal/segredos'
import { r2Configurado, urlDeLeitura } from '@/lib/r2/cliente'

export const dynamic = 'force-dynamic'
const CABECALHOS = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

/**
 * Download do original pelo portal. Só funciona com o download LIBERADO pelo
 * estúdio (vigente e dentro do limite do acesso); o banco decide e registra.
 * O original nunca é público: a URL assinada é curta e força o download.
 * Arquivo legado fora do R2 não é servido por bypass.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ link: string; foto: string }> }) {
  const { link, foto } = await params
  const hash = await sessaoPortal(link)
  if (!hash || !uuidValido(foto)) return new NextResponse('Acesso indisponível.', { status: 403, headers: CABECALHOS })
  const { data, error } = await createPublicClient().rpc('portal_download_foto', { p_sessao_hash: hash, p_foto_id: foto })
  if (error) {
    const limite = /limite/i.test(error.message)
    return new NextResponse(limite ? 'Você atingiu o limite de downloads desta galeria. Fale com o estúdio.' : 'Download não disponível para esta galeria.', { status: limite ? 429 : 403, headers: CABECALHOS })
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return new NextResponse('Foto indisponível.', { status: 403, headers: CABECALHOS })
  const item = data as { bucket?: string; path?: string; nome?: string | null }
  if (item.bucket !== 'r2' || !item.path || !r2Configurado()) return new NextResponse('Arquivo ainda indisponível neste portal. Contate o estúdio.', { status: 503, headers: CABECALHOS })
  try {
    return NextResponse.redirect(await urlDeLeitura(item.path, { nomeDownload: item.nome ?? 'foto.jpg', expiraEmS: 300 }), { status: 307, headers: CABECALHOS })
  } catch { return new NextResponse('Download temporariamente indisponível.', { status: 503, headers: CABECALHOS }) }
}
