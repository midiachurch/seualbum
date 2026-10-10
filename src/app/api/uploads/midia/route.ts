import { NextResponse, type NextRequest } from 'next/server'
import { chaveMidiaVitrine, MIMES_MIDIA, TAMANHO_MAXIMO_MIDIA_R2, validarEnvioPublico } from '@/lib/r2/chaves'
import { urlDeEnvio } from '@/lib/r2/cliente'
import { lerJson, midiaParaUpload } from '@/lib/r2/sessao'

/**
 * Upload da biblioteca de mídia (banners, portfólio) para o bucket PÚBLICO do
 * Cloudflare R2 — substitui o bucket `midia_vitrine`. Mesmos 3 passos:
 *
 *   1. POST /api/uploads/midia            → { key, url, headers }
 *   2. PUT  {url} (navegador → R2, direto)
 *   3. POST /api/uploads/midia/confirmar  → HeadObject + linha em `media_assets`
 *
 * Chave: vitrine/{idArquivo}-{nome}; leitura pelo endereço público
 * (R2_PUBLIC_URL), sem assinatura.
 */
export async function POST(request: NextRequest) {
  const acesso = await midiaParaUpload()
  if (!acesso.ok) return acesso.resposta

  const validacao = validarEnvioPublico(await lerJson(request), { mimes: MIMES_MIDIA, tamanhoMaximo: TAMANHO_MAXIMO_MIDIA_R2 })
  if (!validacao.ok) return NextResponse.json({ erro: validacao.erro }, { status: 400 })
  const { idArquivo, nome, tipo, tamanho } = validacao.dados

  try {
    const key = chaveMidiaVitrine({ idArquivo, nome })
    const { url, expiraEm } = await urlDeEnvio(key, tipo, tamanho, 'publico')
    return NextResponse.json({ key, url, metodo: 'PUT', headers: { 'Content-Type': tipo }, expiraEm })
  } catch (e) {
    console.error('[uploads:midia] assinar', e)
    return NextResponse.json({ erro: 'Não foi possível preparar o envio. Tente de novo.' }, { status: 500 })
  }
}
