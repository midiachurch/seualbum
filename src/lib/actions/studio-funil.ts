'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/demo-mode'
import { uuidValido } from '@/lib/portal/segredos'
import { requireUser } from '@/lib/supabase/queries'
import { chaveValida, mensagemDeErro, type Resultado } from '@/lib/studio/erros'
import { ETAPAS, MOTIVOS_PERDA, ORIGENS } from '@/lib/studio/constantes'
import type { StudioEtapa, StudioMotivoPerda, StudioOrigem } from '@/types/database'

/**
 * Funil comercial (0080). A etapa é COMERCIAL e nunca altera o status de
 * produção do projeto. Quem pode o quê é decidido no banco pela sessão; aqui
 * só se valida a forma da entrada e se esconde o erro interno.
 */

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
const DEMO = { ok: false as const, erro: 'Demonstração: o funil não será gravado no servidor.' }
const reais = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 99_999_999
const texto = (v: unknown, min: number, max: number) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max

export type EntradaNegocio = {
  organizacaoId: string
  chave: string
  titulo: string
  nome: string
  email: string
  telefone: string
  origem: string
  valor: number
  clienteId?: string | null
  responsavelId?: string | null
}

export async function criarNegocioStudio(entrada: EntradaNegocio): Promise<Resultado<{ id: string }>> {
  const falha = { ok: false as const, erro: 'Não foi possível criar o negócio. Confira os dados.' }
  if (!uuidValido(entrada?.organizacaoId) || !chaveValida(entrada.chave) || !texto(entrada.titulo, 2, 160)) return falha
  if (!ORIGENS.includes(entrada.origem as StudioOrigem) || !reais(entrada.valor)) return falha
  const comCliente = entrada.clienteId != null && entrada.clienteId !== ''
  if (comCliente && !uuidValido(entrada.clienteId)) return falha
  if (entrada.responsavelId && !uuidValido(entrada.responsavelId)) return falha
  if (!comCliente && !texto(entrada.nome, 2, 120)) return falha
  const email = (entrada.email ?? '').trim()
  if (email && (email.length > 254 || !EMAIL.test(email))) return falha
  if ((entrada.telefone ?? '').length > 40) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('criar_negocio_studio', {
      p_org: entrada.organizacaoId, p_chave: entrada.chave, p_titulo: entrada.titulo.trim(),
      p_nome: comCliente ? null : entrada.nome.trim(), p_email: email || null, p_telefone: entrada.telefone?.trim() || null,
      p_origem: entrada.origem as StudioOrigem, p_valor: entrada.valor,
      p_cliente_id: comCliente ? entrada.clienteId : null, p_responsavel: entrada.responsavelId || null,
    })
    if (error || typeof data !== 'string') return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true, id: data }
  } catch { return falha }
}

/** Idempotente: a mesma chave (retry) não duplica histórico. `mudou=false` é sucesso sem efeito. */
export async function mudarEtapaStudio(
  negocioId: string, para: string, chave: string, motivo?: string | null, detalhe?: string | null,
): Promise<Resultado<{ mudou: boolean }>> {
  const falha = { ok: false as const, erro: 'Não foi possível mudar a etapa.' }
  if (!uuidValido(negocioId) || !chaveValida(chave) || !ETAPAS.includes(para as StudioEtapa)) return falha
  if (para === 'perdido' && !MOTIVOS_PERDA.includes(motivo as StudioMotivoPerda)) return { ok: false, erro: 'Informe o motivo da perda.' }
  if ((detalhe ?? '').length > 500) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('mudar_etapa_negocio_studio', {
      p_negocio: negocioId, p_para: para as StudioEtapa, p_chave: chave,
      p_motivo: para === 'perdido' ? (motivo as StudioMotivoPerda) : null, p_detalhe: para === 'perdido' ? detalhe?.trim() || null : null,
    })
    if (error || typeof data !== 'boolean') return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true, mudou: data }
  } catch { return falha }
}

export async function atualizarNegocioStudio(
  negocioId: string,
  dados: { titulo: string; valor: number; origem: string; responsavelId: string; orcamentoId?: string | null },
): Promise<Resultado> {
  const falha = { ok: false as const, erro: 'Não foi possível atualizar o negócio.' }
  if (!uuidValido(negocioId) || !uuidValido(dados?.responsavelId) || !texto(dados.titulo, 2, 160)) return falha
  if (!reais(dados.valor) || !ORIGENS.includes(dados.origem as StudioOrigem)) return falha
  if (dados.orcamentoId && !uuidValido(dados.orcamentoId)) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('atualizar_negocio_studio', {
      p_negocio: negocioId, p_titulo: dados.titulo.trim(), p_valor: dados.valor, p_origem: dados.origem as StudioOrigem,
      p_responsavel: dados.responsavelId, p_orcamento: dados.orcamentoId || null,
    })
    if (error || data !== true) return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true }
  } catch { return falha }
}

/** Vincula (ou desvincula, com null) um projeto do MESMO cliente; não mexe no status de produção. */
export async function vincularProjetoNegocioStudio(negocioId: string, projetoId: string | null): Promise<Resultado> {
  const falha = { ok: false as const, erro: 'Não foi possível vincular o projeto.' }
  if (!uuidValido(negocioId) || (projetoId !== null && !uuidValido(projetoId))) return falha
  if (isDemoMode()) return DEMO
  const { supabase } = await requireUser()
  if (!supabase) return falha
  try {
    const { data, error } = await supabase.rpc('vincular_projeto_negocio_studio', { p_negocio: negocioId, p_projeto: projetoId })
    if (error || data !== true) return { ok: false, erro: mensagemDeErro(error, falha.erro) }
    revalidatePath('/dashboard/estudio')
    return { ok: true }
  } catch { return falha }
}
