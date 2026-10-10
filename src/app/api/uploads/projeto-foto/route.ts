import { NextResponse, type NextRequest } from 'next/server'
import { chaveFotoProjeto, validarEnvioFotoProjeto } from '@/lib/r2/chaves'
import { urlDeEnvio } from '@/lib/r2/cliente'
import { lerJson, projetoParaUpload } from '@/lib/r2/sessao'

/**
 * Upload das fotos de um projeto (área do cliente, wizard de novo projeto e
 * editor de álbum de projeto) para o Cloudflare R2, em 3 passos — o mesmo
 * fluxo das fotos do pedido:
 *
 *   1. POST /api/uploads/projeto-foto            → { key, url, headers }
 *   2. PUT  {url} (navegador → R2, direto)
 *   3. POST /api/uploads/projeto-foto/confirmar  → HeadObject + linha em `fotos`
 *
 * Chave: projetos/{projetoId}/fotos/{idArquivo}-{nome}. Em `fotos`, só a
 * chave (`storage_path`) com `bucket = 'r2'`.
 */
export async function POST(request: NextRequest) {
  const validacao = validarEnvioFotoProjeto(await lerJson(request))
  if (!validacao.ok) return NextResponse.json({ erro: validacao.erro }, { status: 400 })
  const { projetoId, idArquivo, nome, tipo, tamanho } = validacao.dados

  const acesso = await projetoParaUpload(projetoId)
  if (!acesso.ok) return acesso.resposta

  try {
    const key = chaveFotoProjeto({ projetoId, idArquivo, nome })
    const { url, expiraEm } = await urlDeEnvio(key, tipo, tamanho)
    return NextResponse.json({ key, url, metodo: 'PUT', headers: { 'Content-Type': tipo }, expiraEm })
  } catch (e) {
    console.error('[uploads:projeto-foto] assinar', e)
    return NextResponse.json({ erro: 'Não foi possível preparar o envio. Tente de novo.' }, { status: 500 })
  }
}
