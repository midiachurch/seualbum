import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rotaDoPapel, type PlatformRole } from '@/types/platform'

/**
 * Troca o `code` do link de confirmação / magic link / login com Google por uma
 * sessão em cookie. Configure esta URL em Supabase > Authentication > URL
 * Configuration (Redirect URLs).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  const cadastroGoogle = searchParams.get('cadastro') === 'google'

  // Só caminhos internos: um `next` absoluto viraria open redirect.
  const explicitNext =
    nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null

  // Ex.: a pessoa cancelou na tela do Google (?error=access_denied).
  if (searchParams.get('error')) {
    const voltar = cadastroGoogle ? '/auth/register' : '/auth/login'
    return NextResponse.redirect(`${origin}${voltar}?erro=google`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?erro=codigo_ausente`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/login?erro=link_invalido`)
  }

  let role: PlatformRole | null = null
  if (cadastroGoogle) {
    // OAuth não leva metadados de cadastro: a conta nasce 'cliente' e a função
    // promove a fotógrafo só se ela acabou de ser criada (migration 0028).
    const { data: papel, error: erroCadastro } = await supabase.rpc('concluir_cadastro_google')
    if (erroCadastro || !papel) {
      // Sem isso a conta seguia como 'cliente' e caía calada em /cliente.
      console.error('[auth/callback] concluir_cadastro_google falhou', {
        userId: data.user.id,
        code: erroCadastro?.code,
        message: erroCadastro?.message ?? 'retorno vazio',
      })
      // Logado, o proxy tiraria a pessoa de /auth/register. Deslogada, ela
      // pode tentar de novo: a conta tem menos de 30 min e a função promove.
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/auth/register?erro=cadastro_google`)
    }
    role = papel
  } else if (!explicitNext) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()
    role = (profile?.role as PlatformRole | undefined) ?? null
  }

  // "Criar conta com Google" com uma conta que já existia (cliente, equipe…):
  // o novo pedido do estúdio não serve, vai para a área do próprio papel.
  const next =
    cadastroGoogle && role && role !== 'fotografo'
      ? rotaDoPapel(role)
      : explicitNext ?? rotaDoPapel(role ?? 'fotografo')

  console.info('[auth/callback] sessão criada', { userId: data.user.id, cadastroGoogle, role, next })

  return NextResponse.redirect(`${origin}${next}`)
}
