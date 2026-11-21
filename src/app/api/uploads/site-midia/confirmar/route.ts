import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { metadadosDoObjeto, removerObjetos, urlPublica } from '@/lib/r2/cliente'
import { lerJson, membroParaUploadDeSite } from '@/lib/r2/sessao'
import { chaveEhMidiaDaOrganizacao, MIMES_MIDIA_SITE, TAMANHO_MAXIMO_MIDIA_SITE } from '@/lib/sites/chaves'
import { ehUuid } from '@/lib/r2/chaves'

const dimensao = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 20000 ? v : null)

/**
 * Passo 3 do upload da imagem do site: confere o objeto no bucket público e o
 * registra em `site_midias` pela RPC (que revalida papel e pasta da
 * organização). Objeto recusado é apagado do R2.
 */
export async function POST(request: NextRequest) {
  const corpo = (await lerJson(request)) as { key?: unknown; organizacaoId?: unknown; nome?: unknown; largura?: unknown; altura?: unknown } | null
  if (!ehUuid(corpo?.organizacaoId) || !chaveEhMidiaDaOrganizacao(corpo?.key, corpo.organizacaoId)) {
    return NextResponse.json({ erro: 'Arquivo inválido.' }, { status: 400 })
  }
  const organizacaoId = corpo.organizacaoId as string
  const key = corpo.key as string
  const nome = typeof corpo.nome === 'string' && corpo.nome.trim() ? corpo.nome.trim().slice(0, 120) : 'imagem'

  const acesso = await membroParaUploadDeSite(organizacaoId)
  if (!acesso.ok) return acesso.resposta

  try {
    const objeto = await metadadosDoObjeto(key, 'publico')
    if (!objeto) return NextResponse.json({ erro: 'A imagem não chegou ao armazenamento. Envie de novo.' }, { status: 404 })
    if (!MIMES_MIDIA_SITE.has(objeto.contentType) || objeto.tamanho <= 0 || objeto.tamanho > TAMANHO_MAXIMO_MIDIA_SITE) {
      await removerObjetos([key], 'publico')
      return NextResponse.json({ erro: 'Arquivo recusado: use JPG, PNG ou WebP de até 10 MB.' }, { status: 400 })
    }
    const { data, error } = await acesso.supabase.rpc('registrar_site_midia', {
      p_org: organizacaoId, p_chave: key, p_nome: nome,
      p_largura: dimensao(corpo.largura), p_altura: dimensao(corpo.altura), p_tamanho_kb: Math.ceil(objeto.tamanho / 1024),
    })
    if (error || typeof data !== 'string') {
      console.error('[uploads:site-midia] registrar', error?.code)
      await removerObjetos([key], 'publico').catch(() => undefined)
      return NextResponse.json({ erro: 'Não foi possível salvar a imagem. Tente de novo.' }, { status: 409 })
    }
    revalidatePath('/dashboard/site')
    return NextResponse.json({ ok: true, id: data, key, url: urlPublica(key) })
  } catch (e) {
    console.error('[uploads:site-midia] confirmar', e)
    return NextResponse.json({ erro: 'Não foi possível salvar a imagem. Tente de novo.' }, { status: 500 })
  }
}
