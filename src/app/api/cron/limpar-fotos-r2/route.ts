import { NextResponse, type NextRequest } from 'next/server'
import { r2Configurado, removerObjetos } from '@/lib/r2/cliente'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Limpeza das fotos de rascunhos parados: apaga do R2 (e do índice
 * `pedidos_fotos_r2`) as fotos de rascunhos cuja última foto tem mais de 72h
 * e que nunca viraram pedido. Substitui a edge function `limpar-fotos-orfas`
 * e o job do pg_cron (migration 0031).
 *
 * Chamada pelo Cron da Vercel (vercel.json), que manda
 * `Authorization: Bearer $CRON_SECRET`. `?dry_run=1` só conta.
 *
 * Ordem: R2 primeiro, índice depois. Se o R2 falhar, as linhas continuam e a
 * próxima execução tenta de novo; o contrário deixaria arquivos sem dono.
 */

const HORAS_MINIMAS = 72
const LOTE = 1000
const MAX_LOTES = 10

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!r2Configurado()) return NextResponse.json({ error: 'R2 não configurado' }, { status: 503 })

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY ausente' }, { status: 503 })
  }

  const dryRun = request.nextUrl.searchParams.get('dry_run') === '1'
  let apagadas = 0

  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const { data, error } = await admin.rpc('rascunhos_r2_expirados', { p_horas: HORAS_MINIMAS, p_limite: LOTE })
    if (error) {
      console.error('[cron:limpar-fotos-r2] seleção', error.message)
      return NextResponse.json({ error: 'seleção falhou', apagadas }, { status: 500 })
    }
    const keys = (data ?? []).map((r) => r.r2_key)
    if (dryRun) return NextResponse.json({ ok: true, dryRun, encontradas: keys.length })
    if (keys.length === 0) break

    try {
      await removerObjetos(keys)
    } catch (e) {
      console.error('[cron:limpar-fotos-r2] R2', e instanceof Error ? e.message : e)
      return NextResponse.json({ error: 'R2 recusou a remoção', apagadas }, { status: 502 })
    }
    const { error: delError } = await admin.from('pedidos_fotos_r2').delete().in('r2_key', keys)
    if (delError) {
      console.error('[cron:limpar-fotos-r2] índice', delError.message)
      return NextResponse.json({ error: 'índice não atualizado', apagadas }, { status: 500 })
    }
    apagadas += keys.length
    if (keys.length < LOTE) break
  }

  console.log('[cron:limpar-fotos-r2] apagadas', apagadas)
  return NextResponse.json({ ok: true, apagadas })
}
