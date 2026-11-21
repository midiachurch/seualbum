'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { requireEdicaoDeProducao, requireUser } from '@/lib/supabase/queries'
import { documentoInicial, prepararLayoutDoProjeto } from '@/lib/album/preparar-projeto'
import { criacaoValida, entradaCriarAlbumValida, enderecoDoEditor, resumoValido, UUID, type EntradaCriarAlbum } from '@/lib/design-selecao/contrato'
import type { CriarAlbumDaSelecaoResultado, DesignHistoricoVersao, DesignSelecaoResumo, RestauracaoAlbumResultado } from '@/types/database'

/**
 * Integração seleção → álbum (D01/D02) e recuperação de versões (D03).
 * Autorização, idempotência e imutabilidade são decididas no banco (0090/0091);
 * aqui só se valida a forma da entrada e se traduzem erros em mensagens que não
 * vazam detalhe interno.
 */

type Falha = { ok: false; erro: string }

const SEM_PERMISSAO = 'Você não tem permissão para criar álbum a partir desta seleção.'
const GENERICO = 'Não foi possível criar o álbum agora. Tente novamente.'

/** Papel e álbuns já criados a partir de seleções do projeto. Quem não tem papel no design recebe `ok: false` (a tela esconde a opção). */
export async function consultarDesignSelecao(projetoId: string): Promise<{ ok: true; resumo: DesignSelecaoResumo } | Falha> {
  if (typeof projetoId !== 'string' || !UUID.test(projetoId) || isDemoMode()) return { ok: false, erro: 'Indisponível.' }
  const { supabase } = await requireUser()
  if (!supabase) return { ok: false, erro: 'Indisponível.' }
  try {
    const { data, error } = await supabase.rpc('design_selecao_resumo', { p_projeto: projetoId })
    if (error || !resumoValido(data)) return { ok: false, erro: 'Indisponível.' }
    return { ok: true, resumo: data }
  } catch {
    return { ok: false, erro: 'Indisponível.' }
  }
}

type Criado = { ok: true; criacao: CriarAlbumDaSelecaoResultado; endereco: string | null }
type FalhaCriar = Falha & { jaTemAlbum?: boolean; precisaFormato?: boolean; sugestao?: string }

/**
 * Cria o álbum a partir de uma seleção entregue (snapshot). Repetir a chamada
 * com a mesma chave devolve o mesmo álbum. O documento nasce com uma lâmina
 * vazia e a seleção na biblioteca; nenhum original é copiado.
 */
export async function criarAlbumDaSelecao(entrada: EntradaCriarAlbum): Promise<Criado | FalhaCriar> {
  if (!entradaCriarAlbumValida(entrada)) return { ok: false, erro: 'Pedido inválido.' }
  if (isDemoMode()) return { ok: false, erro: 'Demonstração: não é possível criar um álbum real.' }
  const { supabase } = await requireUser()
  if (!supabase) return { ok: false, erro: GENERICO }
  try {
    // RLS decide se esta pessoa enxerga a seleção; sem acesso, a resposta é a mesma de "sem permissão".
    const { data: selecao } = await supabase.from('selecoes_entregues').select('id, projeto_id, revisao').eq('id', entrada.selecaoId).maybeSingle()
    if (!selecao) return { ok: false, erro: SEM_PERMISSAO }
    const { data: projeto } = await supabase
      .from('projetos')
      .select('nome, numero, album_config, laminas_inclusas, produto_id')
      .eq('id', selecao.projeto_id)
      .maybeSingle<{ nome: string; numero: number; album_config: unknown; laminas_inclusas: number | null; produto_id: string | null }>()
    if (!projeto) return { ok: false, erro: SEM_PERMISSAO }
    const produtoFormato = projeto.produto_id
      ? ((await supabase.from('produtos').select('formato').eq('id', projeto.produto_id).maybeSingle<{ formato: string }>()).data?.formato ?? null)
      : null

    const escolha = entrada.formato && entrada.orientacao ? { formato: entrada.formato, orientacao: entrada.orientacao as 'quadrado' | 'horizontal' | 'vertical' } : undefined
    const preparo = prepararLayoutDoProjeto(
      { nome: projeto.nome, numero: projeto.numero, albumConfig: projeto.album_config, produtoFormato, laminasInclusas: projeto.laminas_inclusas },
      escolha,
    )
    if (!preparo.ok) return { ok: false, erro: preparo.erro, precisaFormato: true, sugestao: preparo.sugestao }
    const d = preparo.dados
    const nome = entrada.destino === 'projeto' ? d.nome : (entrada.nome?.trim() || `${d.nome} — Seleção ${selecao.revisao}`).slice(0, 120)

    const { data, error } = await supabase.rpc('criar_album_da_selecao', {
      p_selecao_id: entrada.selecaoId,
      p_destino: entrada.destino,
      p_chave: entrada.chave,
      p_nome: nome,
      p_formato: d.formato,
      p_orientacao: d.orientacao,
      p_documento: documentoInicial(),
    })
    if (error) {
      if (error.code === '42501') return { ok: false, erro: SEM_PERMISSAO }
      if (error.code === '22023' && /já tem um álbum/i.test(error.message ?? '')) {
        return { ok: false, jaTemAlbum: true, erro: 'Este projeto já tem um álbum. Crie como álbum avulso ou abra o editor.' }
      }
      return { ok: false, erro: GENERICO }
    }
    if (!criacaoValida(data)) return { ok: false, erro: 'O servidor não confirmou a criação do álbum.' }

    // Formato que não estava no projeto (produto ou escolha) passa a valer também para a prova e a gráfica,
    // como em criarLayoutDoProjeto. Sem permissão de editar o projeto, fica só no álbum.
    if (data.criado && data.destino === 'projeto' && d.origemFormato !== 'projeto') {
      const cfg = projeto.album_config && typeof projeto.album_config === 'object' && !Array.isArray(projeto.album_config) ? projeto.album_config : {}
      await supabase.from('projetos').update({ album_config: { ...(cfg as Record<string, unknown>), formato: d.formato, orientacao: d.orientacao } }).eq('id', selecao.projeto_id)
    }

    revalidatePath('/admin/albuns')
    revalidatePath(`/admin/projetos/${selecao.projeto_id}/editor`)
    revalidatePath(`/dashboard/albuns/${selecao.projeto_id}/compartilhar`)
    // O endereço só é útil a quem abre o editor; a tela decide com `pode_abrir_editor`.
    return { ok: true, criacao: data, endereco: enderecoDoEditor(selecao.projeto_id, data) }
  } catch {
    return { ok: false, erro: GENERICO }
  }
}

/**
 * Restaura uma versão do histórico do álbum: cria NOVA versão (e guarda o
 * estado de antes); nunca sobrescreve o histórico. Idempotente por chave.
 */
export async function restaurarVersaoDoAlbum(layoutId: string, versaoId: string, chave: string): Promise<{ ok: true; restauracao: RestauracaoAlbumResultado } | (Falha & { travado?: boolean })> {
  if (![layoutId, versaoId, chave].every((v) => typeof v === 'string' && UUID.test(v))) return { ok: false, erro: 'Pedido inválido.' }
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const { supabase } = await requireEdicaoDeProducao()
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  try {
    const { data, error } = await supabase.rpc('restaurar_versao_album', { p_layout_id: layoutId, p_versao_id: versaoId, p_chave: chave })
    if (error) {
      if (error.code === '55000') return { ok: false, travado: true, erro: 'Este álbum já foi aprovado e está travado para edição.' }
      if (error.code === '42501') return { ok: false, erro: 'Você não tem permissão para restaurar este álbum.' }
      return { ok: false, erro: 'Não foi possível restaurar a versão.' }
    }
    const r = data as RestauracaoAlbumResultado | null
    if (!r || typeof r.versao_id !== 'string' || !Number.isSafeInteger(r.revisao)) return { ok: false, erro: 'O servidor não confirmou a restauração.' }
    revalidatePath(`/admin/albuns/${layoutId}`)
    return { ok: true, restauracao: r }
  } catch {
    return { ok: false, erro: 'Não foi possível restaurar a versão.' }
  }
}

/** Histórico das versões da prova com lâminas herdadas/alteradas e a assinatura que prova a reprodutibilidade. */
export async function historicoDasVersoesDaProva(projetoId: string): Promise<{ ok: true; versoes: DesignHistoricoVersao[] } | Falha> {
  if (typeof projetoId !== 'string' || !UUID.test(projetoId) || isDemoMode()) return { ok: false, erro: 'Indisponível.' }
  const { supabase } = await requireUser()
  if (!supabase) return { ok: false, erro: 'Indisponível.' }
  try {
    const { data, error } = await supabase.rpc('design_historico_versoes', { p_projeto: projetoId })
    if (error || !Array.isArray(data)) return { ok: false, erro: 'Não foi possível consultar o histórico.' }
    return { ok: true, versoes: data }
  } catch {
    return { ok: false, erro: 'Não foi possível consultar o histórico.' }
  }
}
