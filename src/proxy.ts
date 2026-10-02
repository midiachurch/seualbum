import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'
import { DEMO_COOKIE, isDemoMode } from '@/lib/demo-mode'
import { areaDoPapel, rotaDoPapel, type PlatformRole } from '@/types/platform'

/** Rotas que exigem sessão ativa. */
const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/cliente']
/**
 * Cada área protegida pertence a um papel (ver `rotaDoPapel`): equipe em
 * /admin, estúdio em /dashboard, cliente final em /cliente. Quem estiver na
 * área errada vai direto para a própria.
 */
const AREAS: { prefixo: string; casa: ReturnType<typeof areaDoPapel> }[] = [
  { prefixo: '/admin', casa: '/admin' },
  { prefixo: '/dashboard', casa: '/dashboard' },
  { prefixo: '/cliente', casa: '/cliente' },
]
/**
 * Dentro do /admin, o designer só abre a própria fila, a produção de um
 * projeto (fotos/briefing/versões, a prova com os pins e o editor) e os
 * álbuns avulsos do editor. O resto — dashboard
 * financeiro, clientes, fotógrafos, pedidos, equipe, vitrine — é barrado aqui,
 * antes de renderizar (as páginas e a RLS da 0021 também barram).
 */
const ROTAS_DO_DESIGNER = [
  /^\/admin\/design(\/|$)/,
  /^\/admin\/albuns(\/|$)/,
  /^\/admin\/projetos\/(?!novo(\/|$))[^/]+(\/(prova|editor))?\/?$/,
]

/** Rotas de autenticação — inacessíveis para quem já está logado. */
const AUTH_PREFIXES = ['/auth/login', '/auth/register']

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Sem projeto Supabase configurado: sessão local via cookie de demo, sempre
  // com acesso equivalente a admin — não passa pelo Supabase em nenhum ponto.
  if (isDemoMode()) {
    const hasSession = Boolean(request.cookies.get(DEMO_COOKIE)?.value)
    const isProtected = matches(pathname, PROTECTED_PREFIXES)
    const isAuthRoute = matches(pathname, AUTH_PREFIXES)

    if (isProtected && !hasSession) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.search = ''
      url.searchParams.set('next', `${pathname}${search}`)
      return NextResponse.redirect(url)
    }

    if (isAuthRoute && hasSession) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  // Visitante sem nenhum cookie do Supabase numa rota pública: não há sessão
  // para renovar nem papel para checar — pula a ida ao servidor de Auth, que
  // custava ~100–200 ms em toda página da vitrine.
  const temCookieDeSessao = request.cookies.getAll().some((c) => c.name.startsWith('sb-'))
  if (!temCookieDeSessao && !matches(pathname, PROTECTED_PREFIXES)) {
    return NextResponse.next()
  }

  // `response` já carrega os cookies de sessão renovados: toda saída desta
  // função deve derivar dele, ou o refresh do token é perdido.
  const { supabase, response } = createMiddlewareClient(request)

  // getUser() revalida o JWT no servidor de Auth. getSession() apenas lê o
  // cookie — que é forjável — e não serve como base para autorização.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtected = matches(pathname, PROTECTED_PREFIXES)
  const isAuthRoute = matches(pathname, AUTH_PREFIXES)

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    const redirect = NextResponse.redirect(url)
    // Propaga os cookies renovados para a resposta de redirect.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.search = ''
    // Devolve o usuário ao destino original depois do login.
    url.searchParams.set('next', `${pathname}${search}`)
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  // Papel só é consultado onde decide algo (áreas protegidas e telas de
  // login/cadastro) — rotas públicas não pagam o SELECT extra.
  if (user && (isProtected || isAuthRoute)) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const papel = (profile?.role as PlatformRole | undefined) ?? null
    const casa = rotaDoPapel(papel)

    // Já logado não vê login/cadastro: vai para a própria área.
    if (isAuthRoute) return redirectTo(casa)

    // Compara a ÁREA (/admin…), não a página inicial: a casa do designer é
    // /admin/design, e ele continua podendo abrir outras rotas do /admin
    // que o papel dele permitir (os layouts/páginas fazem essa checagem).
    const area = AREAS.find((a) => matches(pathname, [a.prefixo]))
    if (area && area.casa !== areaDoPapel(papel)) return redirectTo(casa)
    if (papel === 'designer' && area?.prefixo === '/admin' && !ROTAS_DO_DESIGNER.some((r) => r.test(pathname))) {
      return redirectTo(casa)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto:
     * - _next/static, _next/image  (build assets)
     * - favicon e arquivos estáticos por extensão
     * - /api  (Route Handlers autenticam por conta própria)
     */
    '/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
  ],
}
