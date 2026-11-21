import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/supabase/queries'
import { segredoValido } from '@/lib/portal/segredos'
import { AceitarConvite } from '@/components/dashboard/aceitar-convite'

export const metadata = { title: 'Convite para a equipe', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }

// Sem login, o proxy leva ao acesso e devolve para cá (?next=). O convite é
// validado só no aceite, no banco; esta página não confirma se ele existe.
export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!segredoValido(token)) notFound()
  const { user, profile } = await requireUser()
  if (profile?.role !== 'fotografo' && profile?.role !== 'designer') notFound()
  return <main className="mx-auto max-w-md space-y-4 py-10">
    <h1 className="text-2xl font-semibold">Convite para a equipe</h1>
    <AceitarConvite token={token} email={user.email ?? profile.email} />
  </main>
}
