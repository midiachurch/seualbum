'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'
import { urlDeLeitura } from '@/lib/r2/cliente'
import { entradaValida, entregaValida, manifestoCsv, UUID, type EntregaSelecao, type FotoSelecionada } from '@/lib/selecao-entregue/contrato'

type Falha = { ok: false; erro: string; conflito?: boolean }
export async function entregarSelecao(projetoId: string, fotoIds: string[], revisaoEsperada: number, chave: string): Promise<{ ok: true; entrega: EntregaSelecao } | Falha> {
  if (!entradaValida(projetoId, fotoIds, revisaoEsperada, chave)) return { ok: false, erro: 'Seleção inválida.' }
  if (isDemoMode()) return { ok: false, erro: 'Demonstração: não é possível entregar uma seleção real.' }
  const { supabase } = await requireUser()
  if (!supabase) return { ok: false, erro: 'Banco indisponível.' }
  try {
    const { data, error } = await supabase.rpc('entregar_selecao', { p_projeto_id: projetoId, p_foto_ids: fotoIds, p_revisao_esperada: revisaoEsperada, p_chave: chave })
    if (error) return { ok: false, conflito: error.code === '40001', erro: error.code === '40001' ? 'A seleção mudou. Recarregue antes de confirmar.' : 'Não foi possível entregar esta seleção.' }
    if (!entregaValida(data)) return { ok: false, erro: 'O servidor não confirmou a seleção.' }
    revalidatePath(`/cliente/projetos/${projetoId}`)
    revalidatePath(`/dashboard/projetos/${projetoId}`)
    return { ok: true, entrega: data }
  } catch { return { ok: false, erro: 'Não foi possível entregar esta seleção. Tente novamente.' } }
}

/** Consulta RLS em cada exportação; nenhuma chave privilegiada. URLs duram cinco minutos. */
export async function exportarSelecao(selecaoId: string): Promise<{ ok: true; csv: string; arquivos: { fotoId: string; nomeOriginal: string | null; url: string }[] } | Falha> {
  if (typeof selecaoId !== 'string' || !UUID.test(selecaoId) || isDemoMode()) return { ok: false, erro: 'Seleção indisponível.' }
  const { supabase } = await requireUser()
  if (!supabase) return { ok: false, erro: 'Banco indisponível.' }
  try {
    const { data: selecao, error: erroSelecao } = await supabase.from('selecoes_entregues').select('id').eq('id',selecaoId).maybeSingle()
    if (!selecao || erroSelecao) return { ok: false, erro: 'Seleção indisponível.' }
    const { data, error } = await supabase.from('selecao_entregue_fotos').select('foto_id,bucket,storage_path,nome_original').eq('selecao_id',selecaoId).order('foto_id')
    if (error || !data?.length) return { ok: false, erro: 'Seleção indisponível.' }
    const fotos = data as FotoSelecionada[]
    // Limita assinatura por lote para galerias grandes, sem gerar chamadas ilimitadas.
    const arquivos: { fotoId: string; nomeOriginal: string | null; url: string }[] = []
    for (let i=0; i<fotos.length; i+=10) {
      const lote = await Promise.all(fotos.slice(i,i+10).map(async (foto) => {
        let url: string
        if (foto.bucket === 'r2') url = await urlDeLeitura(foto.storage_path, { expiraEmS: 300, ...(foto.nome_original ? { nomeDownload: foto.nome_original } : {}) })
        else if (foto.bucket === 'projetos_fotos' || foto.bucket === 'pedidos_fotos') {
          const { data: assinado, error: erro } = await supabase.storage.from(foto.bucket).createSignedUrl(foto.storage_path,300, { download: foto.nome_original ?? true })
          if (erro || !assinado?.signedUrl) throw new Error('Arquivo indisponível')
          url = assinado.signedUrl
        } else throw new Error('Bucket não autorizado')
        return { fotoId: foto.foto_id, nomeOriginal: foto.nome_original, url }
      }))
      arquivos.push(...lote)
    }
    return { ok: true, csv: manifestoCsv(fotos), arquivos }
  } catch { return { ok: false, erro: 'Não foi possível preparar os arquivos. Tente novamente.' } }
}

export async function consultarSelecoes(projetoId: string): Promise<{ ok: true; favoritas: string[]; entregas: { id: string; revisao: number; total: number; criadaEm: string }[]; podeEntregar: boolean } | Falha> {
  if (typeof projetoId !== 'string' || !UUID.test(projetoId) || isDemoMode()) return { ok: false, erro: 'Seleção indisponível.' }
  const { supabase, profile } = await requireUser()
  if (!supabase) return { ok: false, erro: 'Banco indisponível.' }
  try {
    const { data: projeto, error: erroProjeto } = await supabase.from('projetos').select('id').eq('id',projetoId).maybeSingle()
    if (!projeto || erroProjeto) return { ok: false, erro: 'Projeto indisponível.' }
    const [{ data: favoritas, error: erroFotos }, { data: entregas, error: erroEntregas }] = await Promise.all([
      supabase.from('fotos').select('id').eq('projeto_id',projetoId).eq('favorita',true),
      supabase.from('selecoes_entregues').select('id,revisao,foto_ids,created_at').eq('projeto_id',projetoId).order('revisao',{ascending:false}),
    ])
    if (erroFotos || erroEntregas) return { ok: false, erro: 'Não foi possível consultar a seleção.' }
    return { ok: true, favoritas: (favoritas ?? []).map((f)=>f.id), entregas: (entregas ?? []).map((e)=>({ id:e.id,revisao:e.revisao,total:e.foto_ids.length,criadaEm:e.created_at })), podeEntregar: profile?.role === 'fotografo' || profile?.role === 'cliente' }
  } catch { return { ok:false,erro:'Não foi possível consultar a seleção.' } }
}
