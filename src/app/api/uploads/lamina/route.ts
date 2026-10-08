import { NextResponse, type NextRequest } from 'next/server'
import { chaveLamina, validarEnvioLamina } from '@/lib/r2/chaves'
import { urlDeEnvio } from '@/lib/r2/cliente'
import { lerJson, producaoParaUpload } from '@/lib/r2/sessao'

/**
 * URL assinada para a equipe enviar UMA lâmina (JPG) de uma versão da prova
 * direto para o Cloudflare R2. Usada pelo upload manual de lâminas e pelo
 * "Publicar versão" do editor. Depois do PUT, `criarVersaoComLaminas` confere
 * cada chave no R2 (HeadObject) antes de registrar a versão.
 */
export async function POST(request: NextRequest) {
  const validacao = validarEnvioLamina(await lerJson(request))
  if (!validacao.ok) return NextResponse.json({ erro: validacao.erro }, { status: 400 })
  const { projetoId, lote, idArquivo, nome, tipo, tamanho } = validacao.dados

  const acesso = await producaoParaUpload(projetoId)
  if (!acesso.ok) return acesso.resposta

  try {
    const key = chaveLamina({ projetoId, lote, idArquivo, nome })
    const { url, expiraEm } = await urlDeEnvio(key, tipo, tamanho)
    return NextResponse.json({ key, url, metodo: 'PUT', headers: { 'Content-Type': tipo }, expiraEm })
  } catch (e) {
    console.error('[uploads:lamina] assinar', e)
    return NextResponse.json({ erro: 'Não foi possível preparar o envio da lâmina. Tente de novo.' }, { status: 500 })
  }
}
