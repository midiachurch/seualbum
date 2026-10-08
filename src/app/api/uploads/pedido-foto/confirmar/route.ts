import { NextResponse, type NextRequest } from 'next/server'
import { lerChaveFotoPedido, lerExifConfirmacao, MIMES_FOTO_PEDIDO, TAMANHO_MAXIMO_FOTO_R2 } from '@/lib/r2/chaves'
import { metadadosDoObjeto, removerObjetos } from '@/lib/r2/cliente'
import { fotografoParaUpload, lerJson } from '@/lib/r2/sessao'

const UNIQUE_VIOLATION = '23505'

/**
 * Passo 3 do upload (ver ../route.ts): depois do PUT no R2, registra a chave
 * em `pedidos_fotos_r2`. Tamanho e tipo vêm do HeadObject no R2, não do
 * navegador. O EXIF de captura (`capturadaEm`, `camera`) vem do navegador —
 * é só dica para o Smart Layout. Idempotente: confirmar a mesma chave duas
 * vezes é sucesso.
 */
export async function POST(request: NextRequest) {
  const acesso = await fotografoParaUpload()
  if (!acesso.ok) return acesso.resposta
  const { supabase, userId } = acesso

  const corpo = (await lerJson(request)) as { key?: unknown; nome?: unknown; capturadaEm?: unknown; camera?: unknown } | null
  const lida = lerChaveFotoPedido(corpo?.key, userId)
  if (!lida) return NextResponse.json({ erro: 'Arquivo inválido.' }, { status: 400 })
  const key = corpo!.key as string
  const nome = typeof corpo?.nome === 'string' && corpo.nome.trim() ? corpo.nome.slice(0, 255) : key.split('/').pop()!

  try {
    const objeto = await metadadosDoObjeto(key)
    if (!objeto) return NextResponse.json({ erro: 'A foto não chegou ao armazenamento. Envie de novo.' }, { status: 404 })

    // A URL assinada já trava tipo e tamanho; isto é a segunda barreira.
    if (!MIMES_FOTO_PEDIDO.has(objeto.contentType) || objeto.tamanho <= 0 || objeto.tamanho > TAMANHO_MAXIMO_FOTO_R2) {
      await removerObjetos([key])
      return NextResponse.json({ erro: 'Arquivo recusado: formato ou tamanho fora do permitido.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pedidos_fotos_r2')
      .insert({
        client_id: userId,
        chave_idempotencia: lida.chave,
        r2_key: key,
        nome_original: nome,
        tamanho: objeto.tamanho,
        content_type: objeto.contentType,
        ...lerExifConfirmacao(corpo),
      })
      .select('id')
      .single()

    if (error?.code === UNIQUE_VIOLATION) return NextResponse.json({ ok: true, key, jaRegistrada: true })
    if (error) {
      // RLS: o rascunho virou pedido entre o PUT e a confirmação.
      console.error('[uploads:pedido-foto] confirmar insert', error)
      return NextResponse.json({ erro: 'Não foi possível registrar a foto. Tente de novo.' }, { status: 409 })
    }

    return NextResponse.json({ ok: true, key, id: data.id })
  } catch (e) {
    console.error('[uploads:pedido-foto] confirmar', e)
    return NextResponse.json({ erro: 'Não foi possível registrar a foto. Tente de novo.' }, { status: 500 })
  }
}
