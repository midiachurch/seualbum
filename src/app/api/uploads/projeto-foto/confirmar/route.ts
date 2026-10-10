import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { BUCKET_R2, lerChaveFotoProjeto, lerExifConfirmacao, MIMES_FOTO_PROJETO, TAMANHO_MAXIMO_FOTO_PROJETO_R2 } from '@/lib/r2/chaves'
import { metadadosDoObjeto, removerObjetos, urlDeLeitura } from '@/lib/r2/cliente'
import { lerJson, projetoParaUpload } from '@/lib/r2/sessao'

const EXPIRACAO_PREVIA_S = 60 * 60

/**
 * Passo 3 do upload (ver ../route.ts): depois do PUT no R2, confere o objeto
 * (HeadObject — tipo e tamanho vêm do R2, não do navegador) e cria a linha em
 * `fotos` com `bucket = 'r2'` e a chave em `storage_path`. Devolve um link
 * assinado de 1h para a tela mostrar a foto na hora.
 *
 * Idempotente: confirmar a mesma chave duas vezes devolve a mesma foto.
 *
 * Só confirma quem pediu o envio: a chave precisa estar reservada para o
 * usuário (`r2_uploads_pendentes`, migration 0040). O INSERT consome a
 * reserva no banco (trigger `fotos_validar_chave_r2`), então cada chave vira
 * foto uma vez só — uma foto apagada não volta por quem soubesse a chave.
 */
export async function POST(request: NextRequest) {
  const corpo = (await lerJson(request)) as { key?: unknown; grupo?: unknown; capturadaEm?: unknown; camera?: unknown } | null
  const lida = lerChaveFotoProjeto(corpo?.key)
  if (!lida) return NextResponse.json({ erro: 'Arquivo inválido.' }, { status: 400 })
  const key = corpo!.key as string
  const { projetoId } = lida

  const acesso = await projetoParaUpload(projetoId)
  if (!acesso.ok) return acesso.resposta
  const { supabase, userId } = acesso
  const grupo = typeof corpo?.grupo === 'string' && corpo.grupo.trim() ? corpo.grupo.trim().slice(0, 80) : null

  try {
    const { data: existente } = await supabase
      .from('fotos')
      .select('id')
      .eq('projeto_id', projetoId)
      .eq('storage_path', key)
      .maybeSingle()
    if (existente) {
      const url = await urlDeLeitura(key, { expiraEmS: EXPIRACAO_PREVIA_S })
      return NextResponse.json({ ok: true, key, id: existente.id, url, jaRegistrada: true })
    }

    // A RLS só mostra as reservas do próprio usuário.
    const { data: reserva, error: reservaError } = await supabase
      .from('r2_uploads_pendentes')
      .select('r2_key')
      .eq('r2_key', key)
      .gt('expira_em', new Date().toISOString())
      .maybeSingle()
    if (reservaError) throw reservaError
    if (!reserva) {
      return NextResponse.json({ erro: 'Este envio não foi feito por você ou expirou. Envie a foto de novo.' }, { status: 403 })
    }

    const objeto = await metadadosDoObjeto(key)
    if (!objeto) return NextResponse.json({ erro: 'A foto não chegou ao armazenamento. Envie de novo.' }, { status: 404 })

    // A URL assinada já trava tipo e tamanho; isto é a segunda barreira.
    if (!MIMES_FOTO_PROJETO.has(objeto.contentType) || objeto.tamanho <= 0 || objeto.tamanho > TAMANHO_MAXIMO_FOTO_PROJETO_R2) {
      await removerObjetos([key])
      return NextResponse.json({ erro: 'Arquivo recusado: formato ou tamanho fora do permitido.' }, { status: 400 })
    }

    const url = await urlDeLeitura(key, { expiraEmS: EXPIRACAO_PREVIA_S })

    const { data, error } = await supabase
      .from('fotos')
      .insert({
        projeto_id: projetoId,
        storage_path: key,
        bucket: BUCKET_R2,
        // `url` fica vazio: toda leitura assina de novo pela chave (queries.ts).
        url: null,
        grupo,
        enviado_por: userId,
        ...lerExifConfirmacao(corpo),
      })
      .select('id')
      .single()
    if (error) {
      console.error('[uploads:projeto-foto] confirmar insert', error)
      return NextResponse.json({ erro: 'Não foi possível registrar a foto. Tente de novo.' }, { status: 409 })
    }

    revalidatePath(`/admin/projetos/${projetoId}`)
    revalidatePath(`/cliente/projetos/${projetoId}`)
    return NextResponse.json({ ok: true, key, id: data.id, url })
  } catch (e) {
    console.error('[uploads:projeto-foto] confirmar', e)
    return NextResponse.json({ erro: 'Não foi possível registrar a foto. Tente de novo.' }, { status: 500 })
  }
}
