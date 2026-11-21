import { NextResponse } from 'next/server'
import { obterSitePublicado } from '@/lib/sites/publico'
import { baseAbsoluta, gerarRobotsTxt } from '@/lib/sites/seo'

export const revalidate = 60

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = await obterSitePublicado(slug)
  if (!site) return new NextResponse('User-agent: *\nDisallow: /\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  return new NextResponse(gerarRobotsTxt(baseAbsoluta(site)), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
