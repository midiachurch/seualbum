import { NextResponse, type NextRequest } from 'next/server'
import { ehUuid } from '@/lib/r2/chaves'
import { assinarLeituras } from '@/lib/r2/cliente'
import { projetoParaUpload } from '@/lib/r2/sessao'
import { buscarPorSelfie, nomeDoErro, rekognitionConfigurado } from '@/lib/rekognition/cliente'
import { classificarErroBusca, fotosDosRostos, MIMES_SELFIE, TAMANHO_MAXIMO_SELFIE } from '@/lib/rekognition/regras'
import { createAdminClient } from '@/lib/supabase/server'

const EXPIRACAO_LEITURA_S = 60 * 60

const MENSAGENS = {
  sem_rosto: 'Não conseguimos ler o seu rosto na selfie. Vá para um lugar mais iluminado e tente novamente.',
  formato: 'Não conseguimos abrir essa imagem. Tire outra selfie ou escolha uma foto JPG ou PNG.',
  indisponivel: 'A busca está indisponível agora. Tente de novo em instantes.',
} as const

/** JPEG (FF D8 FF) ou PNG (89 50 4E 47): o tipo do navegador não basta. */
function assinaturaDeImagem(b: Uint8Array) {
  return (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
}

/**
 * "Encontrar minhas fotos" (migration 0042). Recebe a selfie (multipart:
 * `selfie`, `projetoId`, `consentimento=1`) e devolve as fotos do projeto em
 * que a pessoa aparece, com links de leitura de 1h.
 *
 * A selfie NÃO é gravada: os bytes vão direto para o SearchFacesByImage e
 * somem com a requisição (o texto de consentimento na tela diz isso).
 *
 * Quem pode: quem enxerga o projeto (`pode_ver_projeto`) com a busca ligada
 * e não vencida. Nada encontrado = `fotos: []` (nunca 500).
 */
export async function POST(request: NextRequest) {
  if (!rekognitionConfigurado()) return NextResponse.json({ erro: MENSAGENS.indisponivel }, { status: 503 })

  const form = await request.formData().catch(() => null)
  const projetoId = form?.get('projetoId')
  const selfie = form?.get('selfie')
  if (!ehUuid(projetoId) || !(selfie instanceof Blob)) return NextResponse.json({ erro: 'Envio inválido.' }, { status: 400 })
  if (form?.get('consentimento') !== '1') {
    return NextResponse.json({ erro: 'Confirme que concorda com o uso da selfie para a busca.' }, { status: 400 })
  }
  if (!MIMES_SELFIE.has(selfie.type) || selfie.size <= 0 || selfie.size > TAMANHO_MAXIMO_SELFIE) {
    return NextResponse.json({ erro: MENSAGENS.formato, codigo: 'formato' }, { status: 400 })
  }

  const acesso = await projetoParaUpload(projetoId)
  if (!acesso.ok) return acesso.resposta
  const { supabase } = acesso

  const { data: ativo } = await supabase
    .from('reconhecimento_projetos')
    .select('projeto_id')
    .eq('projeto_id', projetoId)
    .gt('expira_em', new Date().toISOString())
    .maybeSingle()
  if (!ativo) return NextResponse.json({ erro: 'A busca por rosto não está ligada neste projeto.' }, { status: 404 })

  // Cada busca é cobrada pela AWS: no máximo 5 por minuto por pessoa. Sem
  // como conferir (banco fora), não busca.
  const { data: liberado, error: limiteError } = await supabase.rpc('registrar_busca_facial', {})
  if (limiteError) {
    console.error('[reconhecimento:buscar] limite', limiteError.message)
    return NextResponse.json({ erro: MENSAGENS.indisponivel, codigo: 'indisponivel' }, { status: 503 })
  }
  if (liberado !== true) {
    return NextResponse.json(
      { erro: 'Você fez muitas buscas seguidas. Espere um minuto e tente de novo.', codigo: 'limite' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  const bytes = new Uint8Array(await selfie.arrayBuffer())
  if (!assinaturaDeImagem(bytes)) return NextResponse.json({ erro: MENSAGENS.formato, codigo: 'formato' }, { status: 400 })

  let encontrados: Awaited<ReturnType<typeof buscarPorSelfie>>
  try {
    encontrados = await buscarPorSelfie(projetoId, bytes)
  } catch (e) {
    const codigo = classificarErroBusca(nomeDoErro(e))
    if (codigo === 'sem_colecao') return NextResponse.json({ fotos: [] })
    if (codigo === 'indisponivel') console.error('[reconhecimento:buscar]', e instanceof Error ? e.message : e)
    return NextResponse.json({ erro: MENSAGENS[codigo], codigo }, { status: codigo === 'indisponivel' ? 502 : 422 })
  }
  if (encontrados.length === 0) return NextResponse.json({ fotos: [] })

  try {
    // FaceId → foto só pela service_role; as fotos em si, pela sessão (RLS).
    const admin = createAdminClient()
    const { data: rostos, error } = await admin
      .from('reconhecimento_rostos')
      .select('face_id, foto_id')
      .eq('projeto_id', projetoId)
      .in('face_id', encontrados.map((r) => r.faceId))
    if (error) throw error
    const ordem = fotosDosRostos(encontrados, new Map((rostos ?? []).map((r) => [r.face_id, r.foto_id])))
    if (ordem.length === 0) return NextResponse.json({ fotos: [] })

    const { data: fotos, error: fotosError } = await supabase
      .from('fotos')
      .select('id, storage_path')
      .eq('projeto_id', projetoId)
      .eq('bucket', 'r2')
      .in('id', ordem)
    if (fotosError) throw fotosError
    const caminho = new Map((fotos ?? []).map((f) => [f.id, f.storage_path]))
    const urls = await assinarLeituras([...caminho.values()], EXPIRACAO_LEITURA_S)

    return NextResponse.json({
      fotos: ordem
        .map((id) => ({ id, url: urls.get(caminho.get(id) ?? '') ?? '' }))
        .filter((f) => f.url),
    })
  } catch (e) {
    console.error('[reconhecimento:buscar] fotos', e instanceof Error ? e.message : e)
    return NextResponse.json({ erro: MENSAGENS.indisponivel, codigo: 'indisponivel' }, { status: 500 })
  }
}
