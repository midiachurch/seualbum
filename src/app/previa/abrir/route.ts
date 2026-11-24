import { NextRequest, NextResponse } from 'next/server'
import { previaLocalAtiva } from '@/lib/previa-local/ambiente'
import { DEMO_COOKIE, encodeDemoSession } from '@/lib/demo-mode'
import type { PlatformRole } from '@/types/platform'

const areas: Record<string, { role: PlatformRole; caminho: string }> = {
  fotografo: { role: 'fotografo', caminho: '/dashboard' },
  admin: { role: 'admin', caminho: '/admin' },
  cliente: { role: 'cliente', caminho: '/cliente' },
  designer: { role: 'designer', caminho: '/admin/design' },
}

export function GET(request: NextRequest) {
  if (!previaLocalAtiva()) return new NextResponse(null, { status: 404 })
  const chave = request.nextUrl.searchParams.get('area') ?? ''
  if (!Object.hasOwn(areas, chave)) return new NextResponse(null, { status: 404 })
  const area = areas[chave]
  // O servidor dev pode normalizar request.url para localhost; manter a origem
  // digitada pelo visitante evita perder o cookie ao entrar por 127.0.0.1.
  const response = new NextResponse(null, { status: 303, headers: { Location: area.caminho } })
  response.cookies.set(DEMO_COOKIE, encodeDemoSession({
    email: 'previa@example.invalid', nome_estudio: 'Estúdio demonstração', role: area.role,
  }), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400 })
  return response
}
