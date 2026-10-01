'use server'

import { revalidatePath } from 'next/cache'
import { requireModuleAction } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'

/**
 * Cria contas reais (auth.users + profiles) chamando a Edge Function
 * `admin-create-user`, que usa a service_role (só disponível no runtime da
 * Edge Function, nunca no servidor Next.js) para provisionar o login. Como
 * não há provedor de e-mail configurado ainda, a senha temporária volta na
 * resposta para o admin repassar manualmente — vira um convite por e-mail de
 * verdade assim que uma Fase de comunicação for implementada.
 */

function assertRealMode() {
  if (isDemoMode()) throw new Error('Ação indisponível em modo de demonstração.')
}

export async function createTeamAccount(input: {
  email: string
  nomeCompleto: string
  role: 'admin' | 'gestor' | 'operador' | 'designer'
  telefone?: string
}): Promise<{ tempPassword: string }> {
  assertRealMode()
  const { supabase } = await requireModuleAction('equipe', 'criar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { data, error } = await supabase.functions.invoke<{ tempPassword: string; error?: string }>('admin-create-user', {
    body: { kind: 'equipe', email: input.email, nomeCompleto: input.nomeCompleto, role: input.role, telefone: input.telefone },
  })
  if (error || !data || data.error) throw new Error(data?.error ?? error?.message ?? 'Não foi possível criar a conta.')

  revalidatePath('/admin/equipe')
  return { tempPassword: data.tempPassword }
}

/** Cria só o registro de CRM (sem login) — mesmo caminho usado pelo wizard de projetos. */
export async function createClienteRecord(input: {
  nome: string
  email: string
  telefone: string
  cidade: string
  estado: string
  origem: string
  fotografoId: string
  observacoesInternas: string | null
}): Promise<string> {
  assertRealMode()
  const { supabase } = await requireModuleAction('clientes', 'criar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      fotografo_id: input.fotografoId,
      nome: input.nome,
      email: input.email,
      telefone: input.telefone || null,
      cidade: input.cidade || null,
      estado: input.estado || null,
      origem: input.origem || null,
      observacoes_internas: input.observacoesInternas,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível criar o cliente.')

  revalidatePath('/admin/clientes')
  return data.id as string
}

export async function createClientAccount(input: {
  email: string
  nomeCompleto: string
  linkClienteId?: string
}): Promise<{ tempPassword: string }> {
  assertRealMode()
  const { supabase } = await requireModuleAction('clientes', 'criar')
  if (!supabase) throw new Error('Sem conexão com o banco.')

  const { data, error } = await supabase.functions.invoke<{ tempPassword: string; error?: string }>('admin-create-user', {
    body: { kind: 'cliente', email: input.email, nomeCompleto: input.nomeCompleto, linkClienteId: input.linkClienteId },
  })
  if (error || !data || data.error) throw new Error(data?.error ?? error?.message ?? 'Não foi possível criar a conta.')

  revalidatePath('/admin/clientes')
  return { tempPassword: data.tempPassword }
}
