import { NextResponse, type NextRequest } from 'next/server'
import { listarObjetos, r2Configurado, r2PublicoConfigurado, removerObjetos, type Alvo } from '@/lib/r2/cliente'
import { varrerOrfaos } from '@/lib/r2/varredura'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Limpeza diária do R2, em duas etapas:
 *
 * 1. Rascunhos parados: apaga do R2 (e do índice `pedidos_fotos_r2`) as fotos
 *    de rascunhos cuja última foto tem mais de 72h e que nunca viraram
 *    pedido. Substitui a edge function `limpar-fotos-orfas` e o job do
 *    pg_cron (migration 0031). Ordem: R2 primeiro, índice depois. Se o R2
 *    falhar, as linhas continuam e a próxima execução tenta de novo; o
 *    contrário deixaria arquivos sem dono.
 * 2. Órfãos (migration 0040): tira as reservas de envio vencidas e apaga os
 *    objetos dos prefixos do app gravados há mais de 7 dias que nenhuma linha
 *    do banco cita — foto apagada, projeto excluído, envio nunca confirmado.
 *    Na dúvida, fica (ver `src/lib/r2/varredura.ts`).
 *
 * Chamada pelo Cron da Vercel (vercel.json), que manda
 * `Authorization: Bearer $CRON_SECRET`. `?dry_run=1` só conta.
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
  let encontradas = 0

  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const { data, error } = await admin.rpc('rascunhos_r2_expirados', { p_horas: HORAS_MINIMAS, p_limite: LOTE })
    if (error) {
      console.error('[cron:limpar-fotos-r2] seleção', error.message)
      return NextResponse.json({ error: 'seleção falhou', apagadas }, { status: 500 })
    }
    const keys = (data ?? []).map((r) => r.r2_key)
    if (dryRun) {
      encontradas = keys.length
      break
    }
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

  // 2. Órfãos ----------------------------------------------------------------
  const agora = new Date()
  if (!dryRun) {
    const { error } = await admin.from('r2_uploads_pendentes').delete().lt('expira_em', agora.toISOString())
    if (error) console.error('[cron:limpar-fotos-r2] reservas vencidas', error.message)
  }
  // Apagar órfãos só com R2_VARREDURA_ORFAOS=apagar. Sem ela a varredura só
  // conta, para conferir o resultado em produção antes de ligar.
  const apagarOrfaos = !dryRun && process.env.R2_VARREDURA_ORFAOS === 'apagar'
  let orfaos: Awaited<ReturnType<typeof varrerOrfaos>>
  try {
    const alvos: Alvo[] = r2PublicoConfigurado() ? ['privado', 'publico'] : ['privado']
    orfaos = await varrerOrfaos(
      {
        listar: (prefixo, alvo, continuacao) => listarObjetos(prefixo, alvo, continuacao),
        semReferencia: async (keys) => {
          const { data, error } = await admin.rpc('r2_chaves_sem_referencia', { p_keys: keys })
          if (error) throw new Error(`r2_chaves_sem_referencia: ${error.message}`)
          return (data ?? []) as string[]
        },
        remover: (keys, alvo) => removerObjetos(keys, alvo),
      },
      { alvos, agora, dryRun: !apagarOrfaos },
    )
  } catch (e) {
    console.error('[cron:limpar-fotos-r2] órfãos', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'varredura de órfãos falhou', apagadas }, { status: 502 })
  }

  if (dryRun) return NextResponse.json({ ok: true, dryRun, encontradas, orfaos })
  console.log('[cron:limpar-fotos-r2] apagadas', apagadas, 'órfãos', orfaos)
  return NextResponse.json({ ok: true, apagadas, orfaos })
}
