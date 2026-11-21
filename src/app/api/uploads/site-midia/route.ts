import { NextResponse, type NextRequest } from 'next/server'
import { urlDeEnvio } from '@/lib/r2/cliente'
import { lerJson, membroParaUploadDeSite } from '@/lib/r2/sessao'
import { chaveMidiaSite, validarPedidoMidiaSite } from '@/lib/sites/chaves'

/**
 * Upload de imagem do site para o bucket PÚBLICO do R2, em 3 passos:
 *   1. POST /api/uploads/site-midia            → { key, url, headers }
 *   2. PUT  {url} (navegador → R2, direto)
 *   3. POST /api/uploads/site-midia/confirmar  → HeadObject + registra em site_midias
 * Chave: sites/{organizacaoId}/{idArquivo}-{nome}. Quem envia precisa ser dono,
 * admin ou editor da organização (conferido no banco por papel_na_organizacao).
 */
export async function POST(request: NextRequest) {
  const validacao = validarPedidoMidiaSite(await lerJson(request))
  if (!validacao.ok) return NextResponse.json({ erro: validacao.erro }, { status: 400 })
  const { organizacaoId, idArquivo, nome, tipo, tamanho } = validacao.dados

  const acesso = await membroParaUploadDeSite(organizacaoId)
  if (!acesso.ok) return acesso.resposta

  try {
    const key = chaveMidiaSite({ organizacaoId, idArquivo, nome })
    const { url, expiraEm } = await urlDeEnvio(key, tipo, tamanho, 'publico')
    return NextResponse.json({ key, url, metodo: 'PUT', headers: { 'Content-Type': tipo }, expiraEm })
  } catch (e) {
    console.error('[uploads:site-midia] assinar', e)
    return NextResponse.json({ erro: 'Não foi possível preparar o envio. Tente de novo.' }, { status: 500 })
  }
}
