import { NextResponse, type NextRequest } from 'next/server'
import { DEMO_COOKIE, encodeDemoSession, isDemoMode } from '@/lib/demo-mode'
import type { PlatformRole } from '@/types/platform'

const VALID_ROLES: PlatformRole[] = ['admin', 'gestor', 'operador', 'designer', 'fotografo', 'cliente']

/**
 * Login sem Supabase — só existe enquanto `isDemoMode()` for true (sem
 * projeto configurado em `.env.local`). Aceita qualquer e-mail/senha e abre
 * uma sessão local via cookie, sempre com role 'admin', para dar pra navegar
 * pelo painel do cliente e pelo admin antes de configurar um backend real.
 */
export async function POST(request: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: 'Modo de demonstração desativado.' }, { status: 404 })
  }

  const form = await request.formData()
  const email = String(form.get('email') ?? '').trim() || 'demo@seualbum.com.br'
  const nomeEstudio = String(form.get('nome_estudio') ?? '').trim() || 'Estúdio de demonstração'
  const roleParam = String(form.get('role') ?? 'admin') as PlatformRole
  const role = VALID_ROLES.includes(roleParam) ? roleParam : 'admin'
  const nextParam = String(form.get('next') ?? '/dashboard')
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

  const response = NextResponse.redirect(new URL(next, request.nextUrl.origin), { status: 303 })
  response.cookies.set(DEMO_COOKIE, encodeDemoSession({ email, nome_estudio: nomeEstudio, role }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}
