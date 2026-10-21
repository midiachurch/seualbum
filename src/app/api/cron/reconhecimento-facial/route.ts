import { NextResponse, type NextRequest } from 'next/server'
import { r2Configurado } from '@/lib/r2/cliente'
import {
  colecaoDoProjeto,
  listarColecoes,
  PREFIXO_COLECOES,
  rekognitionConfigurado,
  removerColecao,
  removerRostos,
} from '@/lib/rekognition/cliente'
import { processarFila } from '@/lib/rekognition/indexacao'
import { projetoDaColecao } from '@/lib/rekognition/regras'
import { bearerConfere } from '@/lib/segredo'
import { createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 300

const ORCAMENTO_INDEXACAO_MS = 200_000
const LOTE_REMOCAO = 4000

/**
 * Manutenção diária do reconhecimento facial (migration 0042), nesta ordem:
 *
 * 1. Retenção (LGPD): projetos com a busca ativada há mais de 60 dias são
 *    encerrados no banco e a coleção inteira sai do Rekognition.
 * 2. Fila de remoção: FaceIds de fotos apagadas / projetos desligados saem da
 *    coleção. Rekognition primeiro, fila depois — se a AWS falhar, a próxima
 *    execução tenta de novo.
 * 3. Coleções deste ambiente sem projeto ligado (exclusão do projeto, falha
 *    ao desligar) são apagadas.
 * 4. O que sobrou da fila de indexação (tela fechada no meio, erro
 *    passageiro) é indexado até o orçamento de tempo.
 *
 * Chamada pelo Cron da Vercel (vercel.json) com `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  if (!bearerConfere(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!rekognitionConfigurado()) return NextResponse.json({ ok: true, ignorado: 'Rekognition não configurado' })

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY ausente' }, { status: 503 })
  }

  const relatorio = { encerrados: 0, rostosRemovidos: 0, colecoesOrfas: 0, indexadas: 0, erros: 0 }

  try {
    // 1. Retenção --------------------------------------------------------------
    const { data: vencidos, error } = await admin.rpc('encerrar_reconhecimentos_vencidos', { p_limite: 200 })
    if (error) throw new Error(`vencidos: ${error.message}`)
    for (const projetoId of vencidos ?? []) await removerColecao(colecaoDoProjeto(projetoId))
    relatorio.encerrados = (vencidos ?? []).length

    // 2. Fila de remoção ---------------------------------------------------------
    const { data: fila, error: filaError } = await admin
      .from('reconhecimento_rostos_remover')
      .select('face_id, projeto_id')
      .order('criado_em')
      .limit(LOTE_REMOCAO)
    if (filaError) throw new Error(`fila de remoção: ${filaError.message}`)
    const porProjeto = new Map<string, string[]>()
    for (const r of fila ?? []) porProjeto.set(r.projeto_id, [...(porProjeto.get(r.projeto_id) ?? []), r.face_id])
    for (const [projetoId, faceIds] of porProjeto) {
      await removerRostos(projetoId, faceIds)
      const { error: delError } = await admin.from('reconhecimento_rostos_remover').delete().in('face_id', faceIds)
      if (delError) throw new Error(`fila de remoção: ${delError.message}`)
      relatorio.rostosRemovidos += faceIds.length
    }

    // 3. Coleções órfãs ------------------------------------------------------------
    // Lista as coleções ANTES de ler os projetos ligados: uma ativação no meio
    // aparece na leitura e a coleção fica.
    const colecoes = await listarColecoes()
    const { data: ligados, error: ligadosError } = await admin.from('reconhecimento_projetos').select('projeto_id')
    if (ligadosError) throw new Error(`ligados: ${ligadosError.message}`)
    const ativos = new Set((ligados ?? []).map((l) => l.projeto_id))
    for (const colecao of colecoes) {
      const projetoId = projetoDaColecao(PREFIXO_COLECOES, colecao)
      if (projetoId && !ativos.has(projetoId)) {
        await removerColecao(colecao)
        relatorio.colecoesOrfas += 1
      }
    }
  } catch (e) {
    console.error('[cron:reconhecimento-facial] limpeza', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'limpeza falhou', ...relatorio }, { status: 500 })
  }

  // 4. Indexação pendente ------------------------------------------------------------
  if (r2Configurado()) {
    try {
      const r = await processarFila(admin, { prazo: Date.now() + ORCAMENTO_INDEXACAO_MS })
      relatorio.indexadas = r.processadas
      relatorio.erros = r.erros
    } catch (e) {
      console.error('[cron:reconhecimento-facial] indexação', e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({ ok: true, ...relatorio })
}
