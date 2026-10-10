import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { BUCKET_R2, chaveEhLogoDoFotografo, MIMES_LOGO, TAMANHO_MAXIMO_LOGO_R2 } from '@/lib/r2/chaves'
import { metadadosDoObjeto, removerObjetos, urlPublica } from '@/lib/r2/cliente'
import { estudioParaUploadDeLogo, lerJson } from '@/lib/r2/sessao'

/**
 * Passo 3 do upload do logo (ver ../route.ts): confere o objeto no bucket
 * público (HeadObject) e grava em `fotografos` a chave (`logo_path`) com
 * `logo_bucket = 'r2'` (migration 0034). `logo_url` recebe o endereço público
 * — é o que a tela pública do orçamento lê (RPC `get_orcamento_publico`).
 * O logo anterior no R2, se houver, é apagado depois de gravar o novo.
 */
export async function POST(request: NextRequest) {
  const acesso = await estudioParaUploadDeLogo()
  if (!acesso.ok) return acesso.resposta
  const { supabase, userId } = acesso

  const corpo = (await lerJson(request)) as { key?: unknown } | null
  if (!chaveEhLogoDoFotografo(corpo?.key, userId)) return NextResponse.json({ erro: 'Arquivo inválido.' }, { status: 400 })
  const key = corpo.key as string

  try {
    const objeto = await metadadosDoObjeto(key, 'publico')
    if (!objeto) return NextResponse.json({ erro: 'O logo não chegou ao armazenamento. Envie de novo.' }, { status: 404 })
    if (!MIMES_LOGO.has(objeto.contentType) || objeto.tamanho <= 0 || objeto.tamanho > TAMANHO_MAXIMO_LOGO_R2) {
      await removerObjetos([key], 'publico')
      return NextResponse.json({ erro: 'Arquivo recusado: use JPG, PNG ou WebP de até 5 MB.' }, { status: 400 })
    }

    const { data: anterior } = await supabase.from('fotografos').select('logo_path, logo_bucket').eq('id', userId).maybeSingle()
    const url = urlPublica(key)
    const { data: gravado, error } = await supabase
      .from('fotografos')
      .update({ logo_path: key, logo_bucket: BUCKET_R2, logo_url: url })
      .eq('id', userId)
      .select('id')
      .maybeSingle()
    if (error || !gravado) {
      console.error('[uploads:logo] confirmar update', error)
      return NextResponse.json({ erro: 'Não foi possível salvar o logo. Tente de novo.' }, { status: 409 })
    }

    // O logo antigo no Supabase (`fotografo_logos`) fica onde está; o do R2 sai.
    if (anterior?.logo_bucket === BUCKET_R2 && anterior.logo_path && anterior.logo_path !== key) {
      await removerObjetos([anterior.logo_path], 'publico').catch((e) => console.error('[uploads:logo] remover anterior', e))
    }

    revalidatePath('/dashboard/orcamentos')
    return NextResponse.json({ ok: true, key, url })
  } catch (e) {
    console.error('[uploads:logo] confirmar', e)
    return NextResponse.json({ erro: 'Não foi possível salvar o logo. Tente de novo.' }, { status: 500 })
  }
}
