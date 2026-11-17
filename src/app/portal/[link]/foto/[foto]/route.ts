import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'
import { sessaoPortal } from '@/lib/portal/servidor'
import { uuidValido } from '@/lib/portal/segredos'
import { r2Configurado, urlDeLeitura } from '@/lib/r2/cliente'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, { params }: { params: Promise<{ link: string; foto: string }> }) {
  const { link, foto } = await params
  const hash = await sessaoPortal(link)
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
  if (!hash || !uuidValido(foto)) return new NextResponse('Acesso indisponível.', { status: 403, headers })
  const { data, error } = await createPublicClient().rpc('portal_foto', { p_sessao_hash: hash, p_foto_id: foto })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return new NextResponse('Foto indisponível.', { status: 403, headers })
  const item = data as { bucket?: string; path?: string }
  // A capacidade do portal não autoriza usar service role para arquivos legados.
  if (item.bucket !== 'r2' || !item.path || !r2Configurado()) return new NextResponse('Arquivo ainda indisponível neste portal. Contate seu fotógrafo.', { status: 503, headers })
  try {
    return NextResponse.redirect(await urlDeLeitura(item.path, { expiraEmS: 60 }), { status: 307, headers })
  } catch { return new NextResponse('Foto temporariamente indisponível.', { status: 503, headers }) }
}
