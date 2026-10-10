'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { getPlatformRole, requireAdmin } from '@/lib/supabase/queries'
import {
  ERRO_SEM_MIGRACAO_DIAGRAMACAO,
  PRIORIDADE_LABEL,
  ehPrioridade,
  ehUuid,
  prazoDoDia,
  semMigracaoDiagramacao,
  validarItens,
  type ItemRef,
  type PrioridadeDiagramacao,
} from '@/lib/diagramacao/regras'
import { EQUIPE_ROLES, hasPermission, type PlatformRole } from '@/types/platform'
import type { AlbumLayoutRow, ProjetoRow } from '@/types/database'

/**
 * Ações do centro de controle da diagramação (migration 0038). Atribuir,
 * mudar prazo, priorizar e pausar são da gestão (admin/gestor = 'atribuir'
 * em projetos); o banco confirma com a trigger `guardar_controle_diagramacao`.
 * Toda mudança em projeto deixa rastro na timeline (`projeto_atividades`).
 */

export type ResultadoDiagramacao = { ok: true; atualizados: number } | { ok: false; erro: string }

type Cliente = NonNullable<Awaited<ReturnType<typeof requireAdmin>>['supabase']>

const ERRO_PERMISSAO = 'Só admin ou gestor podem atribuir, priorizar ou pausar a diagramação.'

async function exigirGestao(): Promise<{ supabase: Cliente; userId: string } | { erro: string }> {
  if (isDemoMode()) return { erro: 'Indisponível no modo de demonstração.' }
  const { supabase, user } = await requireAdmin()
  const role = await getPlatformRole()
  if (!role || !hasPermission(role, 'projetos', 'atribuir')) return { erro: ERRO_PERMISSAO }
  if (!supabase) return { erro: 'Sem conexão com o banco.' }
  return { supabase, userId: user.id }
}

function traduzirErro(error: { message?: string; code?: string } | null, padrao: string): string {
  if (!error) return padrao
  if (semMigracaoDiagramacao(error.message)) return ERRO_SEM_MIGRACAO_DIAGRAMACAO
  if (error.code === '42501') return ERRO_PERMISSAO
  return padrao
}

function revalidar() {
  revalidatePath('/admin')
  revalidatePath('/admin/diagramacao')
  revalidatePath('/admin/design')
  revalidatePath('/admin/albuns')
  revalidatePath('/admin/producao')
}

function separar(itens: ItemRef[]) {
  return {
    projetos: itens.filter((i) => i.tipo === 'projeto').map((i) => i.id),
    avulsos: itens.filter((i) => i.tipo === 'avulso').map((i) => i.id),
  }
}

async function registrarAtividade(supabase: Cliente, autorId: string, projetoIds: string[], mensagem: string) {
  if (projetoIds.length === 0) return
  const { error } = await supabase
    .from('projeto_atividades')
    .insert(projetoIds.map((projeto_id) => ({ projeto_id, autor_id: autorId, mensagem })))
  if (error) console.error('[diagramacao] atividade', error.message)
}

type Alteracao = {
  projeto?: Partial<Pick<ProjetoRow, 'responsavel_id' | 'data_limite_producao' | 'prioridade' | 'em_espera' | 'em_espera_motivo'>>
  avulso?: Partial<Pick<AlbumLayoutRow, 'responsavel_id' | 'prazo' | 'prioridade' | 'em_espera' | 'em_espera_motivo'>>
}

/** Aplica a mesma alteração em projetos e avulsos; devolve os ids de projeto alterados. */
async function aplicar(
  supabase: Cliente,
  itens: ItemRef[],
  alteracao: Alteracao,
  erroPadrao: string,
): Promise<{ ok: true; projetos: string[]; total: number } | { ok: false; erro: string }> {
  const { projetos, avulsos } = separar(itens)
  let total = 0
  let alterados: string[] = []
  if (projetos.length > 0 && alteracao.projeto) {
    const { data, error } = await supabase.from('projetos').update(alteracao.projeto).in('id', projetos).select('id')
    if (error) return { ok: false, erro: traduzirErro(error, erroPadrao) }
    alterados = ((data ?? []) as { id: string }[]).map((r) => r.id)
    total += alterados.length
  }
  if (avulsos.length > 0 && alteracao.avulso) {
    const { data, error } = await supabase
      .from('album_layouts')
      .update(alteracao.avulso)
      .in('id', avulsos)
      .is('projeto_id', null)
      .select('id')
    if (error) return { ok: false, erro: traduzirErro(error, erroPadrao) }
    total += (data ?? []).length
  }
  if (total === 0) return { ok: false, erro: 'Nenhum álbum encontrado (ou sem permissão).' }
  return { ok: true, projetos: alterados, total }
}

/** Atribui (ou tira) o diagramador de um ou vários álbuns — a atribuição em massa usa a mesma ação. */
export async function atribuirDiagramacao(itens: ItemRef[], responsavelId: string | null): Promise<ResultadoDiagramacao> {
  const lista = validarItens(itens)
  if (!lista) return { ok: false, erro: 'Seleção inválida.' }
  if (responsavelId !== null && !ehUuid(responsavelId)) return { ok: false, erro: 'Responsável inválido.' }

  const ctx = await exigirGestao()
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { supabase, userId } = ctx

  let nome: string | null = null
  if (responsavelId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome_completo, role, status')
      .eq('id', responsavelId)
      .maybeSingle<{ id: string; nome_completo: string; role: PlatformRole; status: string }>()
    if (!data || !EQUIPE_ROLES.includes(data.role) || data.status !== 'ativo') {
      return { ok: false, erro: 'Escolha um membro ativo da equipe.' }
    }
    nome = data.nome_completo
  }

  const r = await aplicar(
    supabase,
    lista,
    { projeto: { responsavel_id: responsavelId }, avulso: { responsavel_id: responsavelId } },
    'Não foi possível atribuir.',
  )
  if (!r.ok) return r
  await registrarAtividade(supabase, userId, r.projetos, nome ? `Diagramação atribuída a ${nome}.` : 'Atribuição da diagramação removida.')
  revalidar()
  return { ok: true, atualizados: r.total }
}

/**
 * Prazo da diagramação, dia no formato do `<input type="date">`. No projeto é
 * o SLA interno (`data_limite_producao`, obrigatório); no avulso pode ser limpo.
 */
export async function definirPrazoDiagramacao(item: ItemRef, dia: string | null): Promise<ResultadoDiagramacao> {
  const lista = validarItens([item])
  if (!lista) return { ok: false, erro: 'Álbum inválido.' }
  const prazo = dia === null || dia === '' ? null : prazoDoDia(dia)
  if (dia && !prazo) return { ok: false, erro: 'Data inválida.' }
  if (!prazo && item.tipo === 'projeto') return { ok: false, erro: 'Projeto precisa de prazo.' }

  const ctx = await exigirGestao()
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { supabase, userId } = ctx

  const r = await aplicar(
    supabase,
    lista,
    { projeto: prazo ? { data_limite_producao: prazo } : undefined, avulso: { prazo } },
    'Não foi possível mudar o prazo.',
  )
  if (!r.ok) return r
  if (prazo) {
    const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(prazo))
    await registrarAtividade(supabase, userId, r.projetos, `Prazo da diagramação alterado para ${data}.`)
  }
  revalidar()
  return { ok: true, atualizados: r.total }
}

export async function definirPrioridadeDiagramacao(itens: ItemRef[], prioridade: PrioridadeDiagramacao): Promise<ResultadoDiagramacao> {
  const lista = validarItens(itens)
  if (!lista) return { ok: false, erro: 'Seleção inválida.' }
  if (!ehPrioridade(prioridade)) return { ok: false, erro: 'Prioridade inválida.' }

  const ctx = await exigirGestao()
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { supabase, userId } = ctx

  const r = await aplicar(supabase, lista, { projeto: { prioridade }, avulso: { prioridade } }, 'Não foi possível mudar a prioridade.')
  if (!r.ok) return r
  await registrarAtividade(supabase, userId, r.projetos, `Prioridade da diagramação: ${PRIORIDADE_LABEL[prioridade]}.`)
  revalidar()
  return { ok: true, atualizados: r.total }
}

/** Pausa ("em espera", com motivo) ou retoma. O banco carimba o "desde quando". */
export async function definirEsperaDiagramacao(item: ItemRef, emEspera: boolean, motivo?: string | null): Promise<ResultadoDiagramacao> {
  const lista = validarItens([item])
  if (!lista) return { ok: false, erro: 'Álbum inválido.' }
  const texto = emEspera ? String(motivo ?? '').trim().slice(0, 300) || null : null

  const ctx = await exigirGestao()
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { supabase, userId } = ctx

  const dados = { em_espera: Boolean(emEspera), em_espera_motivo: texto }
  const r = await aplicar(supabase, lista, { projeto: dados, avulso: dados }, emEspera ? 'Não foi possível pausar.' : 'Não foi possível retomar.')
  if (!r.ok) return r
  await registrarAtividade(
    supabase,
    userId,
    r.projetos,
    emEspera ? `Diagramação em espera${texto ? `: ${texto}` : '.'}` : 'Diagramação retomada.',
  )
  revalidar()
  return { ok: true, atualizados: r.total }
}

/* ------------------------------------------------------------------------ */
/* Templates de lâmina (gestão)                                              */
/* ------------------------------------------------------------------------ */

export async function renomearTemplateAlbum(id: string, nome: string): Promise<ResultadoDiagramacao> {
  if (!ehUuid(id)) return { ok: false, erro: 'Template inválido.' }
  const limpo = String(nome ?? '').trim()
  if (limpo.length < 1 || limpo.length > 80) return { ok: false, erro: 'O nome precisa ter de 1 a 80 caracteres.' }

  const ctx = await exigirGestao()
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { data, error } = await ctx.supabase.from('album_templates').update({ nome: limpo }).eq('id', id).select('id')
  if (error) return { ok: false, erro: traduzirErro(error, 'Não foi possível renomear.') }
  if ((data ?? []).length === 0) return { ok: false, erro: 'Template não encontrado.' }
  revalidatePath('/admin/diagramacao/templates')
  return { ok: true, atualizados: 1 }
}

/** Desativado some do editor (`getTemplatesDaEquipe`), sem perder o template. */
export async function definirTemplateAtivo(id: string, ativo: boolean): Promise<ResultadoDiagramacao> {
  if (!ehUuid(id)) return { ok: false, erro: 'Template inválido.' }

  const ctx = await exigirGestao()
  if ('erro' in ctx) return { ok: false, erro: ctx.erro }
  const { data, error } = await ctx.supabase.from('album_templates').update({ ativo: Boolean(ativo) }).eq('id', id).select('id')
  if (error) return { ok: false, erro: traduzirErro(error, ativo ? 'Não foi possível reativar.' : 'Não foi possível desativar.') }
  if ((data ?? []).length === 0) return { ok: false, erro: 'Template não encontrado.' }
  revalidatePath('/admin/diagramacao/templates')
  return { ok: true, atualizados: 1 }
}
