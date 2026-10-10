import { NextResponse, type NextRequest } from 'next/server'
import { chaveLamina, pastaLoteLaminas, validarEnvioLamina } from '@/lib/r2/chaves'
import { metadadosDoObjeto, urlDeEnvio } from '@/lib/r2/cliente'
import { lerJson, producaoParaUpload } from '@/lib/r2/sessao'

/**
 * URL assinada para a equipe enviar UMA lâmina (JPG) de uma versão da prova
 * direto para o Cloudflare R2. Usada pelo upload manual de lâminas e pelo
 * "Publicar versão" do editor. Depois do PUT, `criarVersaoComLaminas` confere
 * cada chave no R2 (HeadObject) antes de registrar a versão.
 *
 * Nunca assina PUT por cima de uma lâmina publicada: o `lote` e o `idArquivo`
 * vêm do navegador, e as chaves das versões publicadas (inclusive as herdadas
 * pelas versões parciais) são conhecidas. Por isso:
 *   - lote que já tem lâmina registrada em `versoes_laminas` → 409 (cada
 *     publicação usa um lote novo; as telas já sorteiam um por envio);
 *   - chave que já existe no R2 → 409 (como em /api/uploads/projeto-foto).
 */
export async function POST(request: NextRequest) {
  const validacao = validarEnvioLamina(await lerJson(request))
  if (!validacao.ok) return NextResponse.json({ erro: validacao.erro }, { status: 400 })
  const { projetoId, lote, idArquivo, nome, tipo, tamanho } = validacao.dados

  const acesso = await producaoParaUpload(projetoId)
  if (!acesso.ok) return acesso.resposta

  try {
    const { data: publicada, error } = await acesso.supabase
      .from('versoes_laminas')
      .select('id')
      .like('storage_path', `${pastaLoteLaminas(projetoId, lote)}/%`)
      .limit(1)
    if (error) throw error
    if ((publicada ?? []).length > 0) {
      return NextResponse.json({ erro: 'Este envio já foi publicado. Recarregue a página e envie de novo.' }, { status: 409 })
    }

    const key = chaveLamina({ projetoId, lote, idArquivo, nome })
    if (await metadadosDoObjeto(key)) {
      return NextResponse.json({ erro: 'Esta lâmina já foi enviada. Envie de novo.' }, { status: 409 })
    }
    const { url, expiraEm } = await urlDeEnvio(key, tipo, tamanho)
    return NextResponse.json({ key, url, metodo: 'PUT', headers: { 'Content-Type': tipo }, expiraEm })
  } catch (e) {
    console.error('[uploads:lamina] assinar', e)
    return NextResponse.json({ erro: 'Não foi possível preparar o envio da lâmina. Tente de novo.' }, { status: 500 })
  }
}
