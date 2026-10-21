import { NextResponse, type NextRequest } from 'next/server'
import { ehUuid } from '@/lib/r2/chaves'
import { lerJson, producaoParaUpload } from '@/lib/r2/sessao'
import { rekognitionConfigurado } from '@/lib/rekognition/cliente'
import { processarFila } from '@/lib/rekognition/indexacao'
import { createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 60

/** Folga para gravar o estado e responder antes do `maxDuration`. */
const ORCAMENTO_MS = 40_000

/**
 * Indexa os rostos das fotos de UM projeto já ligado, em lotes de ~40 s. O
 * card do reconhecimento (admin) chama em laço enquanto `restantes` for true,
 * mostrando o progresso; o Cron diário pega o que sobrar se a tela fechar.
 * Fotos novas são indexadas sozinhas na confirmação do upload.
 *
 * Quem pode: equipe que edita a produção (a regra de `producaoParaUpload`).
 */
export async function POST(request: NextRequest) {
  const corpo = (await lerJson(request)) as { projetoId?: unknown } | null
  if (!ehUuid(corpo?.projetoId)) return NextResponse.json({ erro: 'Projeto inválido.' }, { status: 400 })
  const projetoId = corpo.projetoId

  if (!rekognitionConfigurado()) return NextResponse.json({ erro: 'Reconhecimento facial não configurado.' }, { status: 503 })
  const acesso = await producaoParaUpload(projetoId)
  if (!acesso.ok) return acesso.resposta

  try {
    const resumo = await processarFila(createAdminClient(), { projetoId, prazo: Date.now() + ORCAMENTO_MS })
    return NextResponse.json({ ok: true, ...resumo })
  } catch (e) {
    console.error('[reconhecimento:indexar]', e instanceof Error ? e.message : e)
    return NextResponse.json({ erro: 'Não foi possível indexar agora. Tente de novo.' }, { status: 500 })
  }
}
