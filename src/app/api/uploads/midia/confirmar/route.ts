import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { BUCKET_R2, chaveEhMidiaVitrine, MIMES_MIDIA, TAMANHO_MAXIMO_MIDIA_R2 } from '@/lib/r2/chaves'
import { metadadosDoObjeto, removerObjetos, urlPublica } from '@/lib/r2/cliente'
import { lerJson, midiaParaUpload } from '@/lib/r2/sessao'
import { MEDIA_TAGS, type MediaTag } from '@/types/platform'

const dimensao = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 100_000 ? v : null)

/**
 * Passo 3 do upload da biblioteca de mídia (ver ../route.ts): confere o
 * objeto no bucket público (HeadObject) e cria a linha em `media_assets` com
 * `bucket = 'r2'` e a chave em `storage_path` (migration 0034). `url` guarda
 * o endereço público do momento, só por compatibilidade: a leitura monta o
 * endereço pela chave (`urlDaMidia`).
 */
export async function POST(request: NextRequest) {
  const acesso = await midiaParaUpload()
  if (!acesso.ok) return acesso.resposta
  const { supabase, userId } = acesso

  const corpo = (await lerJson(request)) as {
    key?: unknown
    nome?: unknown
    tags?: unknown
    larguraPx?: unknown
    alturaPx?: unknown
  } | null
  if (!chaveEhMidiaVitrine(corpo?.key)) return NextResponse.json({ erro: 'Arquivo inválido.' }, { status: 400 })
  const key = corpo.key as string
  const nome = typeof corpo.nome === 'string' && corpo.nome.trim() ? corpo.nome.trim().slice(0, 255) : key.split('/').pop()!
  const tags = (Array.isArray(corpo.tags) ? corpo.tags : []).filter((t): t is MediaTag => (MEDIA_TAGS as readonly unknown[]).includes(t))

  try {
    const objeto = await metadadosDoObjeto(key, 'publico')
    if (!objeto) return NextResponse.json({ erro: 'O arquivo não chegou ao armazenamento. Envie de novo.' }, { status: 404 })
    if (!MIMES_MIDIA.has(objeto.contentType) || objeto.tamanho <= 0 || objeto.tamanho > TAMANHO_MAXIMO_MIDIA_R2) {
      await removerObjetos([key], 'publico')
      return NextResponse.json({ erro: 'Arquivo recusado: formato ou tamanho fora do permitido.' }, { status: 400 })
    }

    const url = urlPublica(key)
    const { data, error } = await supabase
      .from('media_assets')
      .insert({
        storage_path: key,
        bucket: BUCKET_R2,
        url,
        nome,
        tags: tags.length > 0 ? tags : ['Geral'],
        largura_px: dimensao(corpo.larguraPx),
        altura_px: dimensao(corpo.alturaPx),
        tamanho_kb: Math.max(1, Math.round(objeto.tamanho / 1024)),
        criado_por: userId,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.error('[uploads:midia] confirmar insert', error)
      return NextResponse.json({ erro: 'Não foi possível registrar o arquivo. Tente de novo.' }, { status: 409 })
    }

    revalidatePath('/admin/midia')
    return NextResponse.json({ ok: true, key, id: data.id, url, tamanhoKb: Math.max(1, Math.round(objeto.tamanho / 1024)) })
  } catch (e) {
    console.error('[uploads:midia] confirmar', e)
    return NextResponse.json({ erro: 'Não foi possível registrar o arquivo. Tente de novo.' }, { status: 500 })
  }
}
