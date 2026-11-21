import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LojaPortal } from '@/components/portal/loja-portal'
import { segredoValido } from '@/lib/portal/segredos'
import { lerPortal, sessaoPortal } from '@/lib/portal/servidor'
import { createPublicClient } from '@/lib/supabase/server'
import type { StoreCatalogoItem } from '@/types/database'

export const metadata: Metadata = { title: 'Loja da galeria', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

export default async function LojaPortalPage({ params }: { params: Promise<{ link: string }> }) {
  const { link } = await params
  if (!segredoValido(link)) notFound()
  const hash = await sessaoPortal(link)
  const projeto = hash ? await lerPortal(link) : null
  if (!hash || !projeto) return <main className="mx-auto max-w-2xl space-y-3 p-6">
    <p role="status">Entre na galeria com o código para abrir a loja.</p>
    <Link className="underline" href={`/portal/${link}`}>Voltar para a galeria</Link>
  </main>
  const { data } = await createPublicClient().rpc('store_catalogo_portal', { p_sessao_hash: hash })
  const catalogo = Array.isArray(data) ? (data as unknown as StoreCatalogoItem[]) : []
  return <main className="mx-auto max-w-3xl space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Loja · {projeto.nome}</h1>
    <Link className="text-sm underline" href={`/portal/${link}`}>← Voltar para a galeria</Link>
    <LojaPortal link={link} catalogo={catalogo} favoritas={projeto.favorita_ids} />
  </main>
}
