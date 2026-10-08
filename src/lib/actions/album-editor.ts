'use server'

import { revalidatePath } from 'next/cache'
import { getAlbumParaEditor, getAprovacoesDoAlbum, getFotosDoEditor, getTemplatesDaEquipe, getVersoesDoAlbum, lerTodasAsLinhas, requireEdicaoDeProducao, type AprovacaoDoAlbum, type FotoDoEditor, type VersaoDoAlbum } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'
import { documentoVazio, geometria, normalizarDocumento, type DocumentoAlbum } from '@/lib/album/documento'
import { documentoDoModelo, modeloPorId } from '@/lib/album/modelos'
import { laminaEmCm, normalizarFormato, normalizarOrientacao } from '@/lib/resolucao'
import { prepararLayoutDoProjeto } from '@/lib/album/preparar-projeto'
import { BUCKET_R2 } from '@/lib/r2/chaves'
import { assinarLeituras, lerObjeto } from '@/lib/r2/cliente'
import type { AlbumConfig, AlbumOrientationValue } from '@/types/platform'
import type { AlbumLayoutRow, AlbumTemplateRow, BibliotecaAlbum, DerivadoFoto } from '@/types/database'

/**
 * Server Actions do editor de álbum (migration 0027). Escrever exige poder
 * editar a produção (equipe de operação ou designer); a RLS confirma
 * (`is_equipe`). O documento é sempre normalizado aqui antes de gravar.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_FOTOS_AVULSO = 1500
/** Ponto de restauração automático no máximo a cada 15 min de edição. */
const INTERVALO_AUTO_MS = 15 * 60 * 1000
const MAX_VERSOES_AUTO = 40

function indisponivel(): { ok: false; erro: string } | null {
  return isDemoMode() ? { ok: false, erro: 'Indisponível em modo de demonstração.' } : null
}

const texto = (v: unknown, max: number) => {
  const t = String(v ?? '').trim()
  return t ? t.slice(0, max) : null
}

/**
 * "30 x 40", "20,5X30", "30×30" → "30x40" / "20.5x30" / "30x30": o mesmo que
 * `laminaEmCm` aceita, no formato que o CHECK da 0027 exige. '' se inválido.
 */

/** A migration 0027 ainda não foi aplicada (tabela do editor inexistente). */
function semTabelasDoEditor(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /album_layouts|schema cache/i.test(error.message ?? '')
}
const ERRO_SEM_TABELAS = 'O banco ainda não tem as tabelas do editor: aplique a migration 0027 (supabase/migrations/0027_album_layouts.sql) no SQL Editor do Supabase.'

type FotoDoProjetoBruta = { id: string; storage_path: string; bucket: string | null }

/** Todas as fotos do projeto (paginado: um projeto pode passar de 1000 fotos). */
async function fotosDoProjeto(supabase: NonNullable<Awaited<ReturnType<typeof requireEdicaoDeProducao>>['supabase']>, projetoId: string) {
  const { data } = await lerTodasAsLinhas<FotoDoProjetoBruta>((de, ate) =>
    supabase.from('fotos').select('id, storage_path, bucket').eq('projeto_id', projetoId).order('id').range(de, ate),
  )
  return data
}

/**
 * O álbum avulso guarda as fotos em `albuns_fotos` (Supabase). Foto de projeto
 * que está no R2 é baixada e reenviada — uma por vez, para não estourar a
 * memória da função com fotos de 50 MB.
 */
async function copiarDoR2(
  supabase: NonNullable<Awaited<ReturnType<typeof requireEdicaoDeProducao>>['supabase']>,
  key: string,
  destino: string,
): Promise<{ error: unknown }> {
  try {
    const { bytes, contentType } = await lerObjeto(key)
    const { error } = await supabase.storage.from('albuns_fotos').upload(destino, bytes, { contentType, upsert: true })
    return { error }
  } catch (e) {
    console.error('[duplicarAlbum] copiar do R2', key, e instanceof Error ? e.message : e)
    return { error: e }
  }
}

function revalidarAlbum(id: string, projetoId?: string | null) {
  revalidatePath('/admin/albuns')
  revalidatePath(`/admin/albuns/${id}`)
  if (projetoId) revalidatePath(`/admin/projetos/${projetoId}/editor`)
}

/* -------------------------------- criação -------------------------------- */

export async function criarAlbumAvulso(input: {
  nome: string
  clienteNome?: string
  tipo?: string
  formato: string
  orientacao: AlbumOrientationValue
  laminasIniciais?: number
  modeloId?: string | null
  fotosEstimadas?: number | null
}): Promise<Resultado<{ id: string }>> {
  const demo = indisponivel()
  if (demo) return demo
  const { supabase, user } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const nome = String(input?.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  if (nome.length < 2) return { ok: false, erro: 'Dê um nome ao álbum (pelo menos 2 letras).' }
  const formato = normalizarFormato(input?.formato)
  // Orientação com outro nome ("retrato", "Paisagem"…) ou vazia não bloqueia: vira a canônica.
  const orientacao = normalizarOrientacao(input?.orientacao, formato)
  const g = geometria({ formato, orientacao, sangriaMm: 3, margemSeguraMm: 5 })
  if (!g) return { ok: false, erro: 'Formato inválido: use largura x altura em cm, de 5 a 100 (ex.: 30x30).' }
  const laminas = Math.min(200, Math.max(1, Math.floor(Number(input?.laminasIniciais) || 1)))
  const modelo = modeloPorId(input?.modeloId)
  const fotosEstimadas = Number.isInteger(input?.fotosEstimadas) && Number(input.fotosEstimadas) >= 0 ? Math.min(10000, Number(input.fotosEstimadas)) : null

  const documento: DocumentoAlbum = modelo ? documentoDoModelo(modelo, laminas, g, nome) : documentoVazio(laminas)
  const { data, error } = await supabase
    .from('album_layouts')
    .insert({
      nome,
      cliente_nome: texto(input.clienteNome, 120),
      tipo: texto(input.tipo, 40),
      modelo: modelo?.id ?? null,
      fotos_estimadas: fotosEstimadas,
      formato,
      orientacao,
      documento,
      criado_por: user.id,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) {
    console.error('[criarAlbumAvulso]', error?.message)
    if (semTabelasDoEditor(error)) return { ok: false, erro: ERRO_SEM_TABELAS }
    return { ok: false, erro: 'Não foi possível criar o álbum.' }
  }
  revalidatePath('/admin/albuns')
  return { ok: true, id: data.id }
}

/** Abre a diagramação de um projeto: cria o documento na primeira vez (formato do projeto). */
/**
 * Projeto sem formato definido: devolve `precisaFormato` e a tela pergunta
 * ali mesmo (formato + orientação). A escolha vale para o álbum e é gravada
 * também no projeto quando quem abre pode editá-lo (senão, só no álbum).
 */
export async function criarLayoutDoProjeto(
  projetoId: string,
  escolha?: { formato: string; orientacao: AlbumOrientationValue },
): Promise<Resultado<{ id: string }> | { ok: false; erro: string; precisaFormato: true; sugestao: string }> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(projetoId)) return { ok: false, erro: 'Projeto inválido.' }
  const { supabase, user } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { data: existente, error: erroLeitura } = await supabase.from('album_layouts').select('id').eq('projeto_id', projetoId).maybeSingle<{ id: string }>()
  if (semTabelasDoEditor(erroLeitura)) return { ok: false, erro: ERRO_SEM_TABELAS }
  if (existente) return { ok: true, id: existente.id }

  const { data: projeto } = await supabase
    .from('projetos')
    .select('nome, numero, album_config, laminas_inclusas, produto_id')
    .eq('id', projetoId)
    .maybeSingle<{ nome: string; numero: number; album_config: unknown; laminas_inclusas: number | null; produto_id: string | null }>()
  if (!projeto) return { ok: false, erro: 'Projeto não encontrado.' }
  // Projetos que vieram de pedido não têm formato: o produto vinculado costuma ter.
  const produtoFormato = projeto.produto_id
    ? ((await supabase.from('produtos').select('formato').eq('id', projeto.produto_id).maybeSingle<{ formato: string }>()).data?.formato ?? null)
    : null

  const preparo = prepararLayoutDoProjeto(
    { nome: projeto.nome, numero: projeto.numero, albumConfig: projeto.album_config, produtoFormato, laminasInclusas: projeto.laminas_inclusas },
    escolha,
  )
  if (!preparo.ok) return preparo
  const d = preparo.dados

  // Formato que não estava no projeto (produto ou escolha) passa a valer para a prova e a gráfica.
  // Sem permissão de editar o projeto, fica só no álbum.
  if (d.origemFormato !== 'projeto') {
    const cfg = projeto.album_config && typeof projeto.album_config === 'object' && !Array.isArray(projeto.album_config) ? projeto.album_config : {}
    await supabase
      .from('projetos')
      .update({ album_config: { ...(cfg as Record<string, unknown>), formato: d.formato, orientacao: d.orientacao } })
      .eq('id', projetoId)
  }

  const { data, error } = await supabase
    .from('album_layouts')
    .insert({
      projeto_id: projetoId,
      nome: d.nome,
      tipo: d.tipo,
      formato: d.formato,
      orientacao: d.orientacao,
      documento: documentoVazio(d.laminas),
      criado_por: user.id,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) {
    // Duas abas abrindo juntas: a outra criou primeiro.
    const { data: corrida } = await supabase.from('album_layouts').select('id').eq('projeto_id', projetoId).maybeSingle<{ id: string }>()
    if (corrida) return { ok: true, id: corrida.id }
    console.error('[criarLayoutDoProjeto]', error?.message)
    if (semTabelasDoEditor(error)) return { ok: false, erro: ERRO_SEM_TABELAS }
    return { ok: false, erro: 'Não foi possível abrir o editor deste projeto.' }
  }
  return { ok: true, id: data.id }
}

/* ------------------------------- salvamento ------------------------------- */

/** Salvamento automático. `conflito`: alguém salvou depois; `travado`: álbum aprovado/finalizado. */
export async function salvarDocumentoAlbum(
  id: string,
  documento: unknown,
  revisao: number,
): Promise<{ ok: true; revisao: number } | { ok: false; erro: string; conflito?: boolean; travado?: boolean }> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id) || !Number.isInteger(revisao)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase, user } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const limpo = normalizarDocumento(documento)
  const { data, error } = await supabase.rpc('salvar_album_layout', { p_id: id, p_documento: limpo, p_revisao: revisao })
  if (error) {
    console.error('[salvarDocumentoAlbum]', error.message)
    return { ok: false, erro: 'Não foi possível salvar. Tentando de novo…' }
  }
  if (data === -1) return { ok: false, travado: true, erro: 'Este álbum já foi aprovado e está travado para edição.' }
  if (data === null || data === undefined) {
    return { ok: false, conflito: true, erro: 'Este álbum foi alterado em outra aba ou por outra pessoa. Recarregue para continuar.' }
  }

  // Ponto de restauração automático (no máximo um a cada 15 min).
  const { data: ultima } = await supabase
    .from('album_layout_versoes')
    .select('created_at')
    .eq('layout_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>()
  if (!ultima || Date.now() - new Date(ultima.created_at).getTime() > INTERVALO_AUTO_MS) {
    await supabase.from('album_layout_versoes').insert({ layout_id: id, documento: limpo, tipo: 'auto', criado_por: user.id })
    const { data: autos } = await supabase
      .from('album_layout_versoes')
      .select('id')
      .eq('layout_id', id)
      .eq('tipo', 'auto')
      .order('created_at', { ascending: false })
      .range(MAX_VERSOES_AUTO, MAX_VERSOES_AUTO + 50)
    if (autos && autos.length > 0) await supabase.from('album_layout_versoes').delete().in('id', autos.map((a) => a.id))
  }
  return { ok: true, revisao: Number(data) }
}

export async function atualizarMiniatura(id: string, dataUrl: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id) || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg;base64,') || dataUrl.length > 280_000) {
    return { ok: false, erro: 'Miniatura inválida.' }
  }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { error } = await supabase.from('album_layouts').update({ miniatura: dataUrl }).eq('id', id)
  if (error) return { ok: false, erro: 'Não foi possível atualizar a capa.' }
  return { ok: true }
}

/** Configurações do álbum (nome, cliente, tipo, sangria, área segura). */
export async function atualizarDadosAlbum(
  id: string,
  dados: { nome?: string; clienteNome?: string | null; tipo?: string | null; sangriaMm?: number; margemSeguraMm?: number },
): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const patch: Partial<Pick<AlbumLayoutRow, 'nome' | 'cliente_nome' | 'tipo' | 'sangria_mm' | 'margem_segura_mm'>> = {}
  if (dados.nome !== undefined) {
    const nome = String(dados.nome).trim()
    if (nome.length < 2 || nome.length > 120) return { ok: false, erro: 'O nome precisa ter entre 2 e 120 caracteres.' }
    patch.nome = nome
  }
  if (dados.clienteNome !== undefined) patch.cliente_nome = texto(dados.clienteNome, 120)
  if (dados.tipo !== undefined) patch.tipo = texto(dados.tipo, 40)
  if (dados.sangriaMm !== undefined) {
    const v = Number(dados.sangriaMm)
    if (!(v >= 0 && v <= 20)) return { ok: false, erro: 'Sangria entre 0 e 20 mm.' }
    patch.sangria_mm = v
  }
  if (dados.margemSeguraMm !== undefined) {
    const v = Number(dados.margemSeguraMm)
    if (!(v >= 0 && v <= 50)) return { ok: false, erro: 'Área segura entre 0 e 50 mm.' }
    patch.margem_segura_mm = v
  }
  const { data, error } = await supabase.from('album_layouts').update(patch).eq('id', id).select('projeto_id').maybeSingle<{ projeto_id: string | null }>()
  if (error) return { ok: false, erro: 'Não foi possível salvar as configurações.' }
  revalidarAlbum(id, data?.projeto_id)
  return { ok: true }
}

/* --------------------------------- fotos --------------------------------- */

/** Depois do upload direto ao Storage: registra as fotos no álbum avulso. */
export async function registrarFotosAlbum(
  id: string,
  fotos: { id: string; path: string; nome: string; largura: number | null; altura: number | null }[],
): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id) || !Array.isArray(fotos) || fotos.length === 0 || fotos.length > 500) return { ok: false, erro: 'Envio inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const dimensao = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 100_000 ? v : null)
  const novas: AlbumLayoutRow['fotos'] = []
  for (const f of fotos) {
    const nomeArq = typeof f?.path === 'string' ? f.path.slice(id.length + 1) : ''
    if (!f.path?.startsWith(`${id}/`) || !nomeArq || nomeArq.includes('/') || nomeArq.includes('..')) return { ok: false, erro: 'Arquivo fora da pasta do álbum.' }
    if (!UUID_RE.test(f.id)) return { ok: false, erro: 'Foto inválida.' }
    novas.push({ id: f.id, path: f.path, nome: String(f.nome ?? '').slice(0, 120) || nomeArq, largura: dimensao(f.largura), altura: dimensao(f.altura) })
  }

  const { data: atual } = await supabase
    .from('album_layouts')
    .select('fotos, projeto_id')
    .eq('id', id)
    .maybeSingle<Pick<AlbumLayoutRow, 'fotos' | 'projeto_id'>>()
  if (!atual || atual.projeto_id) return { ok: false, erro: 'Álbum não encontrado.' }
  const existentes = new Set(atual.fotos.map((f) => f.id))
  const lista = [...atual.fotos, ...novas.filter((f) => !existentes.has(f.id))]
  if (lista.length > MAX_FOTOS_AVULSO) return { ok: false, erro: `No máximo ${MAX_FOTOS_AVULSO} fotos por álbum.` }

  const { error } = await supabase.from('album_layouts').update({ fotos: lista }).eq('id', id)
  if (error) {
    console.error('[registrarFotosAlbum]', error.message)
    return { ok: false, erro: 'As fotos subiram, mas não foi possível registrá-las. Tente de novo.' }
  }
  return { ok: true }
}

/** Fotos atualizadas (depois de um upload no editor de um projeto). */
export async function listarFotosDoEditor(id: string): Promise<Resultado<{ fotos: FotoDoEditor[] }>> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  await requireEdicaoDeProducao()
  return { ok: true, fotos: await getFotosDoEditor(id) }
}

export async function removerFotoAlbum(id: string, fotoId: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id) || !UUID_RE.test(fotoId)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { data: atual } = await supabase
    .from('album_layouts')
    .select('fotos, projeto_id')
    .eq('id', id)
    .maybeSingle<Pick<AlbumLayoutRow, 'fotos' | 'projeto_id'>>()
  if (!atual || atual.projeto_id) return { ok: false, erro: 'Álbum não encontrado.' }
  const foto = atual.fotos.find((f) => f.id === fotoId)
  if (!foto) return { ok: true }

  const { error } = await supabase.from('album_layouts').update({ fotos: atual.fotos.filter((f) => f.id !== fotoId) }).eq('id', id)
  if (error) return { ok: false, erro: 'Não foi possível remover a foto.' }
  await supabase.storage.from('albuns_fotos').remove([foto.path])
  return { ok: true }
}

/** Links novos das fotos (exportar depois de horas com o editor aberto). */
export async function renovarLinksDasFotos(id: string): Promise<Resultado<{ urls: Record<string, string> }>> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { data: album } = await supabase
    .from('album_layouts')
    .select('projeto_id, fotos')
    .eq('id', id)
    .maybeSingle<Pick<AlbumLayoutRow, 'projeto_id' | 'fotos'>>()
  if (!album) return { ok: false, erro: 'Álbum não encontrado.' }

  const pares: { id: string; bucket: string; path: string }[] = album.projeto_id
    ? (await fotosDoProjeto(supabase, album.projeto_id)).map((f) => ({ id: f.id, bucket: f.bucket ?? 'projetos_fotos', path: f.storage_path }))
    : album.fotos.map((f) => ({ id: f.id, bucket: 'albuns_fotos', path: f.path }))

  const urls: Record<string, string> = {}
  const porBucket = new Map<string, typeof pares>()
  for (const p of pares) porBucket.set(p.bucket, [...(porBucket.get(p.bucket) ?? []), p])
  for (const [bucket, lista] of porBucket) {
    if (bucket === BUCKET_R2) {
      const assinadas = await assinarLeituras(lista.map((p) => p.path), 2 * 60 * 60)
      for (const p of lista) {
        const url = assinadas.get(p.path)
        if (url) urls[p.id] = url
      }
      continue
    }
    for (let i = 0; i < lista.length; i += 500) {
      const fatia = lista.slice(i, i + 500)
      const idDoPath = new Map(fatia.map((p) => [p.path, p.id]))
      const { data } = await supabase.storage.from(bucket).createSignedUrls(fatia.map((p) => p.path), 2 * 60 * 60)
      for (const d of data ?? []) {
        const fotoId = d.path ? idDoPath.get(d.path) : undefined
        if (fotoId && d.signedUrl) urls[fotoId] = d.signedUrl
      }
    }
  }
  return { ok: true, urls }
}

/* ------------------------------- histórico ------------------------------- */

export async function listarVersoesAlbum(id: string): Promise<Resultado<{ versoes: VersaoDoAlbum[] }>> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  await requireEdicaoDeProducao()
  return { ok: true, versoes: await getVersoesDoAlbum(id) }
}

/** Ponto de restauração com nome, a partir do que está salvo agora. */
export async function salvarVersaoManual(id: string, rotulo: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  const nome = String(rotulo ?? '').trim().slice(0, 80)
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase, user } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { data: atual } = await supabase.from('album_layouts').select('documento').eq('id', id).maybeSingle<{ documento: unknown }>()
  if (!atual) return { ok: false, erro: 'Álbum não encontrado.' }
  const { error } = await supabase
    .from('album_layout_versoes')
    .insert({ layout_id: id, documento: atual.documento, tipo: 'manual', rotulo: nome || null, criado_por: user.id })
  if (error) return { ok: false, erro: 'Não foi possível salvar a versão.' }
  return { ok: true }
}

/** Documento de uma versão antiga — o editor aplica no lugar do atual (dá para desfazer). */
export async function obterVersaoAlbum(versaoId: string): Promise<Resultado<{ documento: DocumentoAlbum }>> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(versaoId)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { data } = await supabase.from('album_layout_versoes').select('documento').eq('id', versaoId).maybeSingle<{ documento: unknown }>()
  if (!data) return { ok: false, erro: 'Versão não encontrada.' }
  return { ok: true, documento: normalizarDocumento(data.documento) }
}

/**
 * Duplica um álbum como avulso novo ("Cópia de …"), com o documento atual e
 * as fotos copiadas para a pasta do novo álbum (excluir um não afeta o outro).
 */
export async function duplicarAlbum(id: string): Promise<Resultado<{ id: string }>> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase, user } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { data: origem } = await supabase.from('album_layouts').select('*').eq('id', id).maybeSingle<AlbumLayoutRow>()
  if (!origem) return { ok: false, erro: 'Álbum não encontrado.' }

  // "Casamento Ana & João" → "… — Versão 02"; "… — Versão 02" → "… — Versão 03".
  const m = /^(.*) — Versão (\d+)$/.exec(origem.nome)
  const base = m ? m[1] : origem.nome
  const proxima = String((m ? Number(m[2]) : 1) + 1).padStart(2, '0')
  const { data: novo, error } = await supabase
    .from('album_layouts')
    .insert({
      nome: `${base} — Versão ${proxima}`.slice(0, 120),
      biblioteca: origem.biblioteca ?? {},
      cliente_nome: origem.cliente_nome,
      tipo: origem.tipo,
      modelo: origem.modelo,
      fotos_estimadas: origem.fotos_estimadas,
      formato: origem.formato,
      orientacao: origem.orientacao,
      sangria_mm: origem.sangria_mm,
      margem_segura_mm: origem.margem_segura_mm,
      documento: origem.documento,
      miniatura: origem.miniatura,
      criado_por: user.id,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !novo) return { ok: false, erro: 'Não foi possível duplicar o álbum.' }

  // Fotos: cada uma copiada para `{novo}/…`, mantendo o mesmo id (o documento continua válido).
  const fontes: { id: string; bucket: string; path: string; nome: string; largura: number | null; altura: number | null }[] = origem.projeto_id
    ? (await fotosDoProjeto(supabase, origem.projeto_id)).map((f) => ({
        id: f.id,
        bucket: f.bucket ?? 'projetos_fotos',
        path: f.storage_path,
        nome: f.storage_path.split('/').pop() ?? 'foto',
        largura: null,
        altura: null,
      }))
    : origem.fotos.map((f) => ({ id: f.id, bucket: 'albuns_fotos', path: f.path, nome: f.nome, largura: f.largura, altura: f.altura }))

  const copiadas: AlbumLayoutRow['fotos'] = []
  let falhas = 0
  for (const f of fontes) {
    const destino = `${novo.id}/${f.id}-${f.path.split('/').pop()}`
    const { error: e } = f.bucket === BUCKET_R2 ? await copiarDoR2(supabase, f.path, destino) : await supabase.storage.from(f.bucket).copy(f.path, destino, { destinationBucket: 'albuns_fotos' })
    if (e) falhas++
    else copiadas.push({ id: f.id, path: destino, nome: f.nome, largura: f.largura, altura: f.altura })
  }
  // Versões leves também (cada álbum tem as suas: excluir um não quebra o outro).
  const derivados: Record<string, DerivadoFoto> = {}
  for (const [fotoId, d] of Object.entries(origem.derivados ?? {})) {
    const mini = `${novo.id}/derivados/${fotoId}-mini.jpg`
    const preview = `${novo.id}/derivados/${fotoId}-preview.jpg`
    const [a, b] = await Promise.all([
      supabase.storage.from('albuns_fotos').copy(d.mini, mini),
      supabase.storage.from('albuns_fotos').copy(d.preview, preview),
    ])
    if (!a.error && !b.error) derivados[fotoId] = { ...d, mini, preview }
  }
  await supabase.from('album_layouts').update({ fotos: copiadas, derivados }).eq('id', novo.id)
  revalidatePath('/admin/albuns')
  if (falhas > 0) return { ok: false, erro: `Álbum duplicado, mas ${falhas} foto(s) não foram copiadas.` }
  return { ok: true, id: novo.id }
}

/* --------------------------- status e aprovação --------------------------- */

export async function listarAprovacoesAlbum(id: string): Promise<Resultado<{ aprovacoes: AprovacaoDoAlbum[] }>> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  await requireEdicaoDeProducao()
  return { ok: true, aprovacoes: await getAprovacoesDoAlbum(id) }
}

/**
 * Envia a versão atual para aprovação do cliente (álbum avulso). As lâminas
 * já subiram para `{id}/aprovacoes/{aprovacaoId}/` pelo navegador; aqui
 * conferimos o Storage, criamos o link e cancelamos o link anterior.
 */
export async function criarAprovacao(
  id: string,
  aprovacaoId: string,
  laminas: { path: string; largura: number; altura: number; rotulo: string }[],
): Promise<Resultado<{ token: string; numero: number }>> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id) || !UUID_RE.test(aprovacaoId) || !Array.isArray(laminas) || laminas.length === 0 || laminas.length > 200) {
    return { ok: false, erro: 'Envio inválido.' }
  }
  const { supabase, user } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { data: album } = await supabase
    .from('album_layouts')
    .select('projeto_id, documento, status')
    .eq('id', id)
    .maybeSingle<Pick<AlbumLayoutRow, 'projeto_id' | 'documento' | 'status'>>()
  if (!album || album.projeto_id) return { ok: false, erro: 'O link de aprovação é para álbuns avulsos — projetos usam a prova.' }
  // Aprovado/finalizado/em produção estão travados (0027): reabrir antes de mandar outra rodada.
  if (album.status === 'aprovado' || album.status === 'finalizado' || album.status === 'em_producao') {
    return { ok: false, erro: 'Este álbum já foi aprovado. Reabra-o (ou crie uma nova versão) antes de enviar outra rodada.' }
  }

  const pasta = `${id}/aprovacoes/${aprovacaoId}`
  const { data: noStorage } = await supabase.storage.from('albuns_fotos').list(pasta, { limit: 250 })
  const existentes = new Set((noStorage ?? []).map((o) => `${pasta}/${o.name}`))
  const limpas = laminas.map((l) => ({
    path: String(l.path),
    largura: Math.max(1, Math.floor(Number(l.largura) || 1)),
    altura: Math.max(1, Math.floor(Number(l.altura) || 1)),
    rotulo: String(l.rotulo ?? '').slice(0, 60),
  }))
  if (limpas.some((l) => !l.path.startsWith(`${pasta}/`) || !existentes.has(l.path))) return { ok: false, erro: 'Alguma lâmina não chegou ao Storage. Envie de novo.' }

  const { data: ultima } = await supabase
    .from('album_aprovacoes')
    .select('numero')
    .eq('layout_id', id)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle<{ numero: number }>()
  const numero = (ultima?.numero ?? 0) + 1

  const { data: criada, error } = await supabase
    .from('album_aprovacoes')
    .insert({ id: aprovacaoId, layout_id: id, numero, laminas: limpas, criado_por: user.id })
    .select('token')
    .single<{ token: string }>()
  if (error || !criada) {
    console.error('[criarAprovacao]', error?.message)
    return { ok: false, erro: 'Não foi possível criar o link de aprovação.' }
  }
  // Só depois do link novo existir: se a criação falhar, o link anterior continua valendo.
  await supabase.from('album_aprovacoes').update({ status: 'cancelado' }).eq('layout_id', id).eq('status', 'aguardando').neq('id', aprovacaoId)
  await supabase.from('album_layouts').update({ status: 'enviado_aprovacao' }).eq('id', id)
  await supabase
    .from('album_layout_versoes')
    .insert({ layout_id: id, documento: album.documento, tipo: 'aprovacao', rotulo: `Enviada para aprovação (v${numero})`, criado_por: user.id })
  revalidarAlbum(id)
  return { ok: true, token: criada.token, numero }
}

export async function cancelarAprovacao(id: string, aprovacaoId: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id) || !UUID_RE.test(aprovacaoId)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { error } = await supabase.from('album_aprovacoes').update({ status: 'cancelado' }).eq('id', aprovacaoId).eq('layout_id', id).eq('status', 'aguardando')
  if (error) return { ok: false, erro: 'Não foi possível cancelar o link.' }
  await supabase.from('album_layouts').update({ status: 'em_edicao' }).eq('id', id).eq('status', 'enviado_aprovacao')
  revalidarAlbum(id)
  return { ok: true }
}

export async function resolverComentarioAlbum(comentarioId: string, resolvido: boolean): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(comentarioId)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { error } = await supabase.from('album_aprovacao_comentarios').update({ resolvido: Boolean(resolvido) }).eq('id', comentarioId)
  if (error) return { ok: false, erro: 'Não foi possível atualizar o comentário.' }
  return { ok: true }
}

/** Resposta da equipe num comentário do cliente (aparece no link). */
export async function responderComentarioAlbum(aprovacaoId: string, laminaIndice: number, textoResposta: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  const t = String(textoResposta ?? '').trim()
  if (!UUID_RE.test(aprovacaoId) || !Number.isInteger(laminaIndice) || laminaIndice < 0 || t.length < 1 || t.length > 1000) {
    return { ok: false, erro: 'Resposta inválida.' }
  }
  const { supabase, profile } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { error } = await supabase.from('album_aprovacao_comentarios').insert({
    aprovacao_id: aprovacaoId,
    lamina_indice: laminaIndice,
    texto: t,
    autor_nome: (profile?.nome_completo ?? 'Equipe').slice(0, 80),
    origem: 'equipe',
  })
  if (error) return { ok: false, erro: 'Não foi possível responder.' }
  return { ok: true }
}

/** Aprovado → Finalizado (trava a edição de vez). */
export async function finalizarAlbum(id: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase, user } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { data, error } = await supabase
    .from('album_layouts')
    .update({ status: 'finalizado' })
    .eq('id', id)
    .is('projeto_id', null)
    .eq('status', 'aprovado')
    .select('documento')
    .maybeSingle<{ documento: unknown }>()
  if (error || !data) return { ok: false, erro: 'Só um álbum aprovado pode ser finalizado.' }
  await supabase.from('album_layout_versoes').insert({ layout_id: id, documento: data.documento, tipo: 'publicacao', rotulo: 'Versão final', criado_por: user.id })
  revalidarAlbum(id)
  return { ok: true }
}

/**
 * Destrava um álbum APROVADO (ainda não finalizado) para mais uma rodada.
 * A versão final não se altera: dela sai uma nova versão (`duplicarAlbum`).
 */
export async function reabrirAlbum(id: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { data, error } = await supabase
    .from('album_layouts')
    .update({ status: 'em_revisao' })
    .eq('id', id)
    .is('projeto_id', null)
    .eq('status', 'aprovado')
    .select('id')
    .maybeSingle()
  if (error || !data) return { ok: false, erro: 'Só um álbum aprovado (e não finalizado) pode ser reaberto. Da versão final, crie uma nova versão.' }
  revalidarAlbum(id)
  return { ok: true }
}

/** Só álbuns avulsos; o de projeto acompanha o projeto. Apaga também as fotos e as lâminas de aprovação. */
export async function excluirAlbumAvulso(id: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const { data: atual } = await supabase
    .from('album_layouts')
    .select('fotos, projeto_id, derivados')
    .eq('id', id)
    .maybeSingle<Pick<AlbumLayoutRow, 'fotos' | 'projeto_id' | 'derivados'>>()
  if (!atual || atual.projeto_id) return { ok: false, erro: 'Álbum não encontrado.' }

  const { data: aprovacoes } = await supabase.from('album_aprovacoes').select('id, laminas').eq('layout_id', id)
  const { error } = await supabase.from('album_layouts').delete().eq('id', id)
  if (error) return { ok: false, erro: 'Não foi possível excluir o álbum.' }
  const paths = [
    ...atual.fotos.map((f) => f.path),
    ...Object.values(atual.derivados ?? {}).flatMap((d) => [d.mini, d.preview]),
    ...((aprovacoes ?? []) as { laminas: { path: string }[] }[]).flatMap((a) => a.laminas.map((l) => l.path)),
  ]
  for (let i = 0; i < paths.length; i += 500) await supabase.storage.from('albuns_fotos').remove(paths.slice(i, i + 500))
  revalidatePath('/admin/albuns')
  return { ok: true }
}

/** Recarrega o álbum (depois de reabrir, por exemplo). */
export async function recarregarAlbum(id: string) {
  if (!UUID_RE.test(id)) return null
  return getAlbumParaEditor(id)
}

/* ---------------------- versões leves e biblioteca ---------------------- */

/** Registra as versões leves geradas no navegador (miniatura/prévia + medidas). */
export async function salvarDerivados(id: string, novos: Record<string, DerivadoFoto>): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  const entradas = Object.entries(novos ?? {})
  if (!UUID_RE.test(id) || entradas.length === 0 || entradas.length > 300) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const pasta = `${id}/derivados/`
  const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null)
  const limpos: Record<string, DerivadoFoto> = {}
  for (const [fotoId, d] of entradas) {
    if (fotoId.length > 64 || !d || typeof d.mini !== 'string' || typeof d.preview !== 'string') continue
    if (!d.mini.startsWith(pasta) || !d.preview.startsWith(pasta) || d.mini.includes('..') || d.preview.includes('..')) continue
    const largura = num(d.largura, 1, 100_000)
    const altura = num(d.altura, 1, 100_000)
    if (!largura || !altura) continue
    limpos[fotoId] = {
      mini: d.mini,
      preview: d.preview,
      largura: Math.round(largura),
      altura: Math.round(altura),
      estouro: num(d.estouro, 0, 1),
      fx: num(d.fx, 0, 1) ?? 0.5,
      fy: num(d.fy, 0, 1) ?? 0.5,
      pb: typeof d.pb === 'boolean' ? d.pb : null,
    }
  }
  const { data: atual } = await supabase.from('album_layouts').select('derivados').eq('id', id).maybeSingle<Pick<AlbumLayoutRow, 'derivados'>>()
  if (!atual) return { ok: false, erro: 'Álbum não encontrado.' }
  const { error } = await supabase.from('album_layouts').update({ derivados: { ...(atual.derivados ?? {}), ...limpos } }).eq('id', id)
  if (error) return { ok: false, erro: 'Não foi possível registrar as versões leves.' }
  return { ok: true }
}

/** Pastas, favoritas e prioridades das fotos. */
export async function salvarBiblioteca(id: string, biblioteca: BibliotecaAlbum): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }

  const pastas = (Array.isArray(biblioteca?.pastas) ? biblioteca.pastas : [])
    .slice(0, 100)
    .map((p) => ({ id: String(p.id).slice(0, 40), nome: String(p.nome ?? '').trim().slice(0, 60) }))
    .filter((p) => p.id && p.nome)
  const ids = new Set(pastas.map((p) => p.id))
  const PRIORIDADES = ['principal', 'secundaria', 'complementar']
  const fotos: NonNullable<BibliotecaAlbum['fotos']> = {}
  for (const [fotoId, m] of Object.entries(biblioteca?.fotos ?? {}).slice(0, 5000)) {
    if (fotoId.length > 64 || !m) continue
    const pasta = m.pasta && ids.has(m.pasta) ? m.pasta : null
    const prioridade = m.prioridade && PRIORIDADES.includes(m.prioridade) ? m.prioridade : null
    const foco =
      m.foco && Number.isFinite(m.foco.fx) && Number.isFinite(m.foco.fy)
        ? { fx: Math.min(1, Math.max(0, m.foco.fx)), fy: Math.min(1, Math.max(0, m.foco.fy)) }
        : null
    if (!pasta && !m.favorita && !prioridade && !foco) continue
    fotos[fotoId] = { pasta, favorita: m.favorita === true, prioridade, foco }
  }
  const { error } = await supabase.from('album_layouts').update({ biblioteca: { pastas, fotos } }).eq('id', id)
  if (error) return { ok: false, erro: 'Não foi possível salvar a organização das fotos.' }
  return { ok: true }
}

export async function arquivarAlbum(id: string, arquivado: boolean): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { error } = await supabase.from('album_layouts').update({ arquivado: Boolean(arquivado) }).eq('id', id)
  if (error) return { ok: false, erro: 'Não foi possível arquivar.' }
  revalidatePath('/admin/albuns')
  return { ok: true }
}

/** Finalizado → Em produção (álbum avulso; o de projeto segue a esteira). */
export async function enviarParaProducao(id: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { data, error } = await supabase
    .from('album_layouts')
    .update({ status: 'em_producao' })
    .eq('id', id)
    .is('projeto_id', null)
    .eq('status', 'finalizado')
    .select('id')
    .maybeSingle()
  if (error || !data) return { ok: false, erro: 'Só um álbum finalizado pode ir para a produção.' }
  revalidarAlbum(id)
  return { ok: true }
}

/* -------------------------------- templates -------------------------------- */

const ASSINATURA_RE = /^[PLS](-[PLS])*$/

export async function listarTemplates(): Promise<Resultado<{ templates: AlbumTemplateRow[] }>> {
  const demo = indisponivel()
  if (demo) return demo
  await requireEdicaoDeProducao()
  return { ok: true, templates: await getTemplatesDaEquipe() }
}

/** "Salvar como template": só a geometria (frações da lâmina) e a assinatura. */
export async function salvarTemplate(input: {
  nome: string
  quadros: { x: number; y: number; w: number; h: number; raio?: number }[]
  assinatura: string
}): Promise<Resultado<{ template: AlbumTemplateRow }>> {
  const demo = indisponivel()
  if (demo) return demo
  const { supabase, user } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const nome = String(input?.nome ?? '').trim().slice(0, 80)
  const fr = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null)
  const quadros = (Array.isArray(input?.quadros) ? input.quadros.slice(0, 40) : [])
    .map((q) => ({ x: fr(q.x, -0.1, 1.1), y: fr(q.y, -0.1, 1.1), w: fr(q.w, 0.001, 1.2), h: fr(q.h, 0.001, 1.2), raio: fr(q.raio ?? 0, 0, 200) ?? 0 }))
    .filter((q): q is { x: number; y: number; w: number; h: number; raio: number } => q.x !== null && q.y !== null && q.w !== null && q.h !== null)
  if (!nome) return { ok: false, erro: 'Dê um nome ao template.' }
  if (quadros.length === 0) return { ok: false, erro: 'A lâmina não tem quadros para virar template.' }
  if (!ASSINATURA_RE.test(input?.assinatura ?? '') || input.assinatura.split('-').length !== quadros.length) return { ok: false, erro: 'Assinatura inválida.' }
  const { data, error } = await supabase
    .from('album_templates')
    .insert({ nome, quadros, assinatura: input.assinatura, n_fotos: quadros.length, criado_por: user.id })
    .select('*')
    .single<AlbumTemplateRow>()
  if (error || !data) {
    if (semTabelasDoEditor(error) || /album_templates/i.test(error?.message ?? '')) return { ok: false, erro: ERRO_SEM_TABELAS }
    return { ok: false, erro: 'Não foi possível salvar o template.' }
  }
  return { ok: true, template: data }
}

export async function favoritarTemplate(id: string, favorito: boolean): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { error } = await supabase.from('album_templates').update({ favorito: Boolean(favorito) }).eq('id', id)
  return error ? { ok: false, erro: 'Não foi possível favoritar.' } : { ok: true }
}

/** Conta o uso (ordena "Recentes" e os mais usados). */
export async function registrarUsoTemplate(id: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: true }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { data } = await supabase.from('album_templates').select('usos').eq('id', id).maybeSingle<{ usos: number }>()
  if (!data) return { ok: true }
  await supabase.from('album_templates').update({ usos: data.usos + 1, ultimo_uso: new Date().toISOString() }).eq('id', id)
  return { ok: true }
}

export async function excluirTemplate(id: string): Promise<Resultado> {
  const demo = indisponivel()
  if (demo) return demo
  if (!UUID_RE.test(id)) return { ok: false, erro: 'Pedido inválido.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { error } = await supabase.from('album_templates').delete().eq('id', id)
  return error ? { ok: false, erro: 'Não foi possível excluir o template.' } : { ok: true }
}
