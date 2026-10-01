'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * "Magic login" do ambiente local: um clique entra com uma conta de teste.
 *
 * - Só funciona com `next dev` (`NODE_ENV === 'development'`). Num build de
 *   produção a action responde erro mesmo se alguém chamá-la direto.
 * - As credenciais ficam no `.env.local` (DEV_LOGIN_*), lidas só aqui no
 *   servidor — nunca vão para o bundle do navegador nem para o repositório.
 * - O login é o `signInWithPassword` normal do Supabase: a sessão, a RLS e as
 *   checagens de papel são as de verdade, só o formulário é pulado.
 */

export type PerfilDevLogin = 'admin' | 'designer' | 'fotografo' | 'cliente'

const PERFIS: Record<PerfilDevLogin, { emailEnv: string; senhaEnv: string; destino: string }> = {
  admin: { emailEnv: 'DEV_LOGIN_ADMIN_EMAIL', senhaEnv: 'DEV_LOGIN_ADMIN_PASSWORD', destino: '/admin/pedidos' },
  designer: { emailEnv: 'DEV_LOGIN_DESIGNER_EMAIL', senhaEnv: 'DEV_LOGIN_DESIGNER_PASSWORD', destino: '/admin/design' },
  fotografo: {
    emailEnv: 'DEV_LOGIN_FOTOGRAFO_EMAIL',
    senhaEnv: 'DEV_LOGIN_FOTOGRAFO_PASSWORD',
    destino: '/dashboard/novo-pedido',
  },
  // O casal (cliente final): cai direto nos álbuns dele, para testar a prova e o upsell.
  cliente: { emailEnv: 'DEV_LOGIN_CLIENTE_EMAIL', senhaEnv: 'DEV_LOGIN_CLIENTE_PASSWORD', destino: '/cliente' },
}

export async function devLoginAction(perfil: PerfilDevLogin): Promise<{ erro: string }> {
  if (process.env.NODE_ENV !== 'development') return { erro: 'Indisponível fora do ambiente de desenvolvimento.' }

  const config = PERFIS[perfil]
  if (!config) return { erro: 'Perfil inválido.' }

  const email = process.env[config.emailEnv]
  const senha = process.env[config.senhaEnv]
  if (!email || !senha) {
    return { erro: `Preencha ${config.emailEnv} e ${config.senhaEnv} no .env.local e reinicie o servidor.` }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) {
    console.error('[devLoginAction]', perfil, error.message)
    return { erro: `Login de teste falhou (${error.message}). Confira as credenciais no .env.local.` }
  }

  // Fora do try de propósito: `redirect()` funciona lançando uma exceção interna.
  redirect(config.destino)
}

/** Para a tela de login mostrar quais atalhos já têm credencial. */
export async function perfisDevConfigurados(): Promise<Record<PerfilDevLogin, boolean>> {
  if (process.env.NODE_ENV !== 'development') return { admin: false, designer: false, fotografo: false, cliente: false }
  return {
    admin: Boolean(process.env.DEV_LOGIN_ADMIN_EMAIL && process.env.DEV_LOGIN_ADMIN_PASSWORD),
    designer: Boolean(process.env.DEV_LOGIN_DESIGNER_EMAIL && process.env.DEV_LOGIN_DESIGNER_PASSWORD),
    fotografo: Boolean(process.env.DEV_LOGIN_FOTOGRAFO_EMAIL && process.env.DEV_LOGIN_FOTOGRAFO_PASSWORD),
    cliente: Boolean(process.env.DEV_LOGIN_CLIENTE_EMAIL && process.env.DEV_LOGIN_CLIENTE_PASSWORD),
  }
}
