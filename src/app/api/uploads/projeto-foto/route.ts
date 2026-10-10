import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { BUCKET_R2, chaveFotoProjeto, ehUuid, pastaFotosProjeto, validarEnvioFotoProjeto } from '@/lib/r2/chaves'
import { metadadosDoObjeto, removerObjetos, urlDeEnvio } from '@/lib/r2/cliente'
import { lerJson, projetoParaUpload } from '@/lib/r2/sessao'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Upload das fotos de um projeto (área do cliente, wizard de novo projeto e
 * editor de álbum de projeto) para o Cloudflare R2, em 3 passos — o mesmo
 * fluxo das fotos do pedido:
 *
 *   1. POST /api/uploads/projeto-foto            → { key, url, headers }
 *   2. PUT  {url} (navegador → R2, direto)
 *   3. POST /api/uploads/projeto-foto/confirmar  → HeadObject + linha em `fotos`
 *
 * DELETE /api/uploads/projeto-foto { id } apaga a foto: a linha (RLS) e o objeto no R2.
 *
 * Chave: projetos/{projetoId}/fotos/{idArquivo}-{nome}. Em `fotos`, só a
 * chave (`storage_path`) com `bucket = 'r2'`.
 *
 * Nunca assina PUT para uma chave que já existe: o `idArquivo` vem do
 * navegador, e quem enxerga o projeto (inclusive o cliente final) lê as chaves
 * das fotos dos outros — sem esta trava, poderia sobrescrever o arquivo delas.
 *
 * E a chave fica reservada para quem pediu o envio (`reservar_upload_r2`,
 * migration 0040): só essa pessoa consegue confirmá-la, uma vez. Sem isso,
 * outra pessoa do projeto confirmava o arquivo antes e ficava como dona dele.
 */
export async function POST(request: NextRequest) {
  const validacao = validarEnvioFotoProjeto(await lerJson(request))
  if (!validacao.ok) return NextResponse.json({ erro: validacao.erro }, { status: 400 })
  const { projetoId, idArquivo, nome, tipo, tamanho } = validacao.dados

  const acesso = await projetoParaUpload(projetoId)
  if (!acesso.ok) return acesso.resposta

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ erro: 'Armazenamento de fotos não configurado.' }, { status: 503 })
  }

  try {
    const key = chaveFotoProjeto({ projetoId, idArquivo, nome })
    if (await metadadosDoObjeto(key)) {
      return NextResponse.json({ erro: 'Este arquivo já foi enviado. Envie de novo.' }, { status: 409 })
    }
    const { data: reservada, error } = await admin.rpc('reservar_upload_r2', { p_key: key, p_user_id: acesso.userId })
    if (error) throw error
    if (reservada !== true) {
      return NextResponse.json({ erro: 'Este arquivo já foi enviado. Envie de novo.' }, { status: 409 })
    }
    const { url, expiraEm } = await urlDeEnvio(key, tipo, tamanho)
    return NextResponse.json({ key, url, metodo: 'PUT', headers: { 'Content-Type': tipo }, expiraEm })
  } catch (e) {
    console.error('[uploads:projeto-foto] assinar', e)
    return NextResponse.json({ erro: 'Não foi possível preparar o envio. Tente de novo.' }, { status: 500 })
  }
}

/**
 * Apaga uma foto do projeto. A linha sai pela sessão do usuário (a RLS
 * `fotos_delete` decide quem pode); o objeto sai do R2 logo depois, se for da
 * pasta deste projeto e nenhuma outra linha de `fotos` o usar. Foto de pedido
 * convertida (`pedidos/…`) e arquivo antigo do Supabase ficam onde estão — a
 * varredura do Cron só apaga o que nada mais cita.
 */
export async function DELETE(request: NextRequest) {
  const corpo = (await lerJson(request)) as { id?: unknown; projetoId?: unknown } | null
  if (!ehUuid(corpo?.id) || !ehUuid(corpo?.projetoId)) return NextResponse.json({ erro: 'Foto inválida.' }, { status: 400 })
  const id = corpo.id
  const projetoId = corpo.projetoId

  const acesso = await projetoParaUpload(projetoId)
  if (!acesso.ok) return acesso.resposta
  const { supabase } = acesso

  try {
    const { data: apagadas, error } = await supabase
      .from('fotos')
      .delete()
      .eq('id', id)
      .eq('projeto_id', projetoId)
      .select('storage_path, bucket')
    if (error) throw error
    const foto = (apagadas ?? [])[0]
    if (!foto) return NextResponse.json({ erro: 'Foto não encontrada ou sem permissão para apagar.' }, { status: 404 })

    const key = foto.storage_path
    if (foto.bucket === BUCKET_R2 && key.startsWith(`${pastaFotosProjeto(projetoId)}/`) && !key.includes('..')) {
      const { data: emUso, error: usoError } = await supabase.rpc('chave_r2_em_uso_por_projeto', { p_key: key })
      if (usoError) console.error('[uploads:projeto-foto] remover: em uso?', usoError)
      else if (emUso !== true) {
        await removerObjetos([key]).catch((e) => console.error('[uploads:projeto-foto] remover do R2', e instanceof Error ? e.message : e))
      }
    }

    revalidatePath(`/admin/projetos/${projetoId}`)
    revalidatePath(`/cliente/projetos/${projetoId}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[uploads:projeto-foto] remover', e)
    return NextResponse.json({ erro: 'Não foi possível apagar a foto. Tente de novo.' }, { status: 500 })
  }
}
