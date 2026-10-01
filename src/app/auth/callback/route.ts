import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Troca o `code` do link de confirmação / magic link por uma sessão em cookie.
 * Configure esta URL em Supabase > Authentication > URL Configuration.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')

  // Só caminhos internos: um `next` absoluto viraria open redirect.
  const next =
    nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?erro=codigo_ausente`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?erro=link_invalido`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
