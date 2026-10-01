'use server'

import { revalidatePath } from 'next/cache'
import { requireModuleAction } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'

/**
 * Gestão do catálogo de adicionais (0026) pela operação: custo (o que o
 * estúdio paga), preço sugerido de revenda, imagem, ordem e se está ativo.
 * Mesmo módulo do catálogo de álbuns ('vitrine' = admin e gestor), que é
 * exatamente quem a RLS deixa gravar (`is_gestor_ou_admin`).
 *
 * Não há exclusão: faturas antigas apontam para o item. Desativar tira o
 * adicional do catálogo do estúdio e do modal de oferta da prova.
 */

export type DadosAdicional = {
  nome: string
  descricao: string
  imagemUrl: string | null
  custo: number
  sugerido: number
}

type Resultado = { ok: true } | { ok: false; erro: string }

const PRECO_MAXIMO = 99_999

function caminhos() {
  revalidatePath('/admin/catalogo/adicionais')
  revalidatePath('/dashboard/catalogo')
}

function slugDe(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

type Linha = { nome: string; descricao: string | null; imagem_url: string | null; preco_custo: number; preco_sugerido: number }

function validar(d: DadosAdicional): { erro: string } | { linha: Linha } {
  const nome = String(d?.nome ?? '').trim()
  if (nome.length < 2 || nome.length > 80) return { erro: 'O nome precisa ter entre 2 e 80 caracteres.' }
  const descricao = String(d?.descricao ?? '').trim()
  if (descricao.length > 300) return { erro: 'A descrição pode ter no máximo 300 caracteres.' }
  const custo = Math.round(Number(d?.custo) * 100) / 100
  const sugerido = Math.round(Number(d?.sugerido) * 100) / 100
  if (!Number.isFinite(custo) || custo < 0 || custo > PRECO_MAXIMO) return { erro: 'Custo inválido.' }
  if (!Number.isFinite(sugerido) || sugerido < 0 || sugerido > PRECO_MAXIMO) return { erro: 'Preço sugerido inválido.' }
  const imagem = d?.imagemUrl ? String(d.imagemUrl) : null
  if (imagem && !/^https:\/\//.test(imagem)) return { erro: 'Imagem inválida.' }
  return {
    linha: { nome, descricao: descricao || null, imagem_url: imagem, preco_custo: custo, preco_sugerido: sugerido },
  }
}

export async function criarAdicional(dados: DadosAdicional): Promise<Resultado> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const { supabase } = await requireModuleAction('vitrine', 'criar')
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const v = validar(dados)
  if ('erro' in v) return { ok: false, erro: v.erro }

  const base = slugDe(v.linha.nome) || 'adicional'
  const { data: existentes } = await supabase.from('adicionais').select('slug, ordem').order('ordem', { ascending: false })
  const slugs = new Set((existentes ?? []).map((e) => e.slug))
  let slug = base
  for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`
  const ordem = (existentes?.[0]?.ordem ?? 0) + 1

  const { error } = await supabase.from('adicionais').insert({ ...v.linha, slug, ordem })
  if (error) {
    console.error('[criarAdicional]', error.message)
    return { ok: false, erro: 'Não foi possível criar o adicional.' }
  }
  caminhos()
  return { ok: true }
}

export async function atualizarAdicional(id: string, dados: DadosAdicional): Promise<Resultado> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const v = validar(dados)
  if ('erro' in v) return { ok: false, erro: v.erro }

  const { error } = await supabase
    .from('adicionais')
    .update({ ...v.linha, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    console.error('[atualizarAdicional]', error.message)
    return { ok: false, erro: 'Não foi possível salvar.' }
  }
  caminhos()
  return { ok: true }
}

export async function alternarAdicionalAtivo(id: string, ativo: boolean): Promise<Resultado> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  const { error } = await supabase
    .from('adicionais')
    .update({ ativo: Boolean(ativo), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    console.error('[alternarAdicionalAtivo]', error.message)
    return { ok: false, erro: 'Não foi possível alterar.' }
  }
  caminhos()
  return { ok: true }
}

/** Grava a ordem de exibição (estúdio e modal de oferta) a partir da lista inteira. */
export async function reordenarAdicionais(ids: string[]): Promise<Resultado> {
  if (isDemoMode()) return { ok: false, erro: 'Indisponível em modo de demonstração.' }
  const { supabase } = await requireModuleAction('vitrine', 'editar')
  if (!supabase) return { ok: false, erro: 'Sem conexão com o banco.' }
  if (!Array.isArray(ids) || ids.length > 100 || ids.some((i) => typeof i !== 'string')) return { ok: false, erro: 'Ordem inválida.' }
  const resultados = await Promise.all(
    ids.map((id, i) => supabase.from('adicionais').update({ ordem: i + 1 }).eq('id', id)),
  )
  if (resultados.some((r) => r.error)) {
    console.error('[reordenarAdicionais]', resultados.find((r) => r.error)?.error?.message)
    return { ok: false, erro: 'Não foi possível salvar a ordem.' }
  }
  caminhos()
  return { ok: true }
}
