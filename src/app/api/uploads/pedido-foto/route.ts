import { NextResponse, type NextRequest } from 'next/server'
import { chaveFotoPedido, lerChaveFotoPedido, validarPedidoDeEnvio } from '@/lib/r2/chaves'
import { removerObjetos, urlDeEnvio } from '@/lib/r2/cliente'
import { fotografoParaUpload, lerJson, rascunhoJaEnviado } from '@/lib/r2/sessao'

/**
 * Upload das fotos do wizard de novo pedido para o Cloudflare R2, em 3 passos:
 *
 *   1. POST   /api/uploads/pedido-foto            → { key, url, headers }
 *   2. PUT    {url} (navegador → R2, direto)      com os `headers` devolvidos
 *   3. POST   /api/uploads/pedido-foto/confirmar  → registra a chave no banco
 *
 * DELETE /api/uploads/pedido-foto { key } tira uma foto do rascunho.
 *
 * O banco (tabela `pedidos_fotos_r2`, migration 0030) guarda só a chave do
 * objeto — o arquivo nunca passa pelo Supabase nem pela função da Vercel.
 */

/** Passo 1: valida e devolve a URL assinada para o PUT. */
export async function POST(request: NextRequest) {
  const acesso = await fotografoParaUpload()
  if (!acesso.ok) return acesso.resposta
  const { supabase, userId } = acesso

  const validacao = validarPedidoDeEnvio(await lerJson(request))
  if (!validacao.ok) return NextResponse.json({ erro: validacao.erro }, { status: 400 })
  const { chave, idArquivo, nome, tipo, tamanho } = validacao.dados

  try {
    if (await rascunhoJaEnviado(supabase, chave)) {
      return NextResponse.json({ erro: 'Este pedido já foi enviado; as fotos não podem mais mudar.' }, { status: 409 })
    }

    const key = chaveFotoPedido({ userId, chave, idArquivo, nome })
    const { url, expiraEm } = await urlDeEnvio(key, tipo, tamanho)
    // Content-Length o navegador põe sozinho (e não deixa sobrescrever).
    return NextResponse.json({ key, url, metodo: 'PUT', headers: { 'Content-Type': tipo }, expiraEm })
  } catch (e) {
    console.error('[uploads:pedido-foto] assinar', e)
    return NextResponse.json({ erro: 'Não foi possível preparar o envio. Tente de novo.' }, { status: 500 })
  }
}

/** Remove uma foto do rascunho: a linha (RLS barra depois do envio) e o objeto no R2. */
export async function DELETE(request: NextRequest) {
  const acesso = await fotografoParaUpload()
  if (!acesso.ok) return acesso.resposta
  const { supabase, userId } = acesso

  const corpo = (await lerJson(request)) as { key?: unknown } | null
  const lida = lerChaveFotoPedido(corpo?.key, userId)
  if (!lida) return NextResponse.json({ erro: 'Arquivo inválido.' }, { status: 400 })
  const key = corpo!.key as string

  try {
    if (await rascunhoJaEnviado(supabase, lida.chave)) {
      return NextResponse.json({ erro: 'Este pedido já foi enviado; as fotos não podem mais mudar.' }, { status: 409 })
    }
    const { error } = await supabase.from('pedidos_fotos_r2').delete().eq('r2_key', key)
    if (error) throw error
    await removerObjetos([key])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[uploads:pedido-foto] remover', e)
    return NextResponse.json({ erro: 'Não foi possível remover a foto. Tente de novo.' }, { status: 500 })
  }
}
