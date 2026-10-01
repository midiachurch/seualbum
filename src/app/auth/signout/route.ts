import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEMO_COOKIE, isDemoMode } from '@/lib/demo-mode'

/** POST-only: um GET permitiria deslogar o usuário via <img> em outro site. */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.nextUrl.origin), { status: 303 })

  if (isDemoMode()) {
    response.cookies.delete(DEMO_COOKIE)
    return response
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  return response
}
