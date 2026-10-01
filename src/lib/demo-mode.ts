import type { PlatformRole } from '@/types/platform'

/**
 * Sem NEXT_PUBLIC_SUPABASE_URL não existe projeto Supabase configurado. Nesse
 * caso o app roda em modo de demonstração: sessão local via cookie e dados
 * mockados, para dar pra navegar pelo painel do cliente e pelo admin sem
 * precisar configurar um backend antes. Sai de cena sozinho assim que um
 * projeto Supabase real for configurado em `.env.local`.
 */
export function isDemoMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL
}

export const DEMO_COOKIE = 'seualbum_demo_session'

export type DemoSession = {
  email: string
  nome_estudio: string
  /** Perfil escolhido na tela de login, só existe em modo de demonstração. */
  role: PlatformRole
}

export function encodeDemoSession(session: DemoSession) {
  return Buffer.from(JSON.stringify(session)).toString('base64')
}

export function decodeDemoSession(raw: string): DemoSession | null {
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) as DemoSession
  } catch {
    return null
  }
}
