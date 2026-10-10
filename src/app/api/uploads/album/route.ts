import { NextResponse, type NextRequest } from 'next/server'
import { chaveDoEnvioAlbum, validarEnvioAlbum } from '@/lib/r2/chaves'
import { urlDeEnvio } from '@/lib/r2/cliente'
import { albumParaUpload, lerJson } from '@/lib/r2/sessao'

/**
 * URL assinada para a equipe enviar UM arquivo do editor de álbum direto para
 * o Cloudflare R2 (substitui o bucket `albuns_fotos`). `destino`:
 *   - `foto`      original de um álbum avulso;
 *   - `derivado`  versão leve (miniatura/prévia) de uma foto, em qualquer álbum;
 *   - `aprovacao` lâmina JPG de um link de aprovação (álbum avulso).
 *
 * Depois do PUT, a Server Action que registra (`registrarFotosAlbum`,
 * `salvarDerivados`, `criarAprovacao`) confere cada chave no R2 (HeadObject)
 * antes de gravar o caminho no álbum — como `criarVersaoComLaminas`.
 */
export async function POST(request: NextRequest) {
  const validacao = validarEnvioAlbum(await lerJson(request))
  if (!validacao.ok) return NextResponse.json({ erro: validacao.erro }, { status: 400 })
  const dados = validacao.dados

  const acesso = await albumParaUpload(dados.albumId)
  if (!acesso.ok) return acesso.resposta
  // Álbum de projeto: as fotos são as do projeto (/api/uploads/projeto-foto) e
  // a aprovação é a prova; aqui ele só guarda versões leves.
  if (acesso.deProjeto && dados.destino !== 'derivado') {
    return NextResponse.json({ erro: 'Este álbum é de um projeto: envie as fotos pelo projeto.' }, { status: 400 })
  }

  try {
    const key = chaveDoEnvioAlbum(dados)
    const { url, expiraEm } = await urlDeEnvio(key, dados.tipo, dados.tamanho)
    return NextResponse.json({ key, url, metodo: 'PUT', headers: { 'Content-Type': dados.tipo }, expiraEm })
  } catch (e) {
    console.error('[uploads:album] assinar', e)
    return NextResponse.json({ erro: 'Não foi possível preparar o envio. Tente de novo.' }, { status: 500 })
  }
}
