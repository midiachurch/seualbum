import type { Metadata } from 'next'
import { OrcamentosManager } from '@/components/dashboard/orcamentos-manager'
import { getOrcamentos, getProdutos, requireUser } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'

export const metadata: Metadata = { title: 'Meus orçamentos' }

export default async function OrcamentosPage() {
  const { supabase, user } = await requireUser()

  let logoUrl: string | null = null
  if (supabase && !isDemoMode()) {
    const { data } = await supabase.from('fotografos').select('logo_url').eq('id', user.id).single()
    logoUrl = data?.logo_url ?? null
  }

  const [orcamentos, produtos] = await Promise.all([getOrcamentos(), getProdutos()])

  return (
    <OrcamentosManager
      fotografoId={user.id}
      initialOrcamentos={orcamentos}
      produtos={produtos.filter((p) => p.ativo)}
      logoUrl={logoUrl}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}
    />
  )
}
