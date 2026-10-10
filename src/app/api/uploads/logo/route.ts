import { NextResponse, type NextRequest } from 'next/server'
import { chaveLogoFotografo, MIMES_LOGO, TAMANHO_MAXIMO_LOGO_R2, validarEnvioPublico } from '@/lib/r2/chaves'
import { urlDeEnvio } from '@/lib/r2/cliente'
import { estudioParaUploadDeLogo, lerJson } from '@/lib/r2/sessao'

/**
 * Upload do logo do estúdio para o bucket PÚBLICO do Cloudflare R2 —
 * substitui o bucket `fotografo_logos` (migration 0009). Mesmos 3 passos:
 *
 *   1. POST /api/uploads/logo            → { key, url, headers }
 *   2. PUT  {url} (navegador → R2, direto)
 *   3. POST /api/uploads/logo/confirmar  → HeadObject + grava a chave em `fotografos`
 *
 * Chave: logos/{fotografoId}/{idArquivo}-{nome} — sempre na pasta de quem está logado.
 */
export async function POST(request: NextRequest) {
  const acesso = await estudioParaUploadDeLogo()
  if (!acesso.ok) return acesso.resposta

  const validacao = validarEnvioPublico(await lerJson(request), { mimes: MIMES_LOGO, tamanhoMaximo: TAMANHO_MAXIMO_LOGO_R2 })
  if (!validacao.ok) return NextResponse.json({ erro: validacao.erro }, { status: 400 })
  const { idArquivo, nome, tipo, tamanho } = validacao.dados

  try {
    const key = chaveLogoFotografo({ fotografoId: acesso.userId, idArquivo, nome })
    const { url, expiraEm } = await urlDeEnvio(key, tipo, tamanho, 'publico')
    return NextResponse.json({ key, url, metodo: 'PUT', headers: { 'Content-Type': tipo }, expiraEm })
  } catch (e) {
    console.error('[uploads:logo] assinar', e)
    return NextResponse.json({ erro: 'Não foi possível preparar o envio. Tente de novo.' }, { status: 500 })
  }
}
