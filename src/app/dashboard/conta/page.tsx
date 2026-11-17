import { requireUser } from '@/lib/supabase/queries'
export default async function ContaPage() {
  const { user, profile } = await requireUser()
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Seu espaço</p>
        <h1 className="mt-3 text-3xl font-semibold">Minha conta</h1>
        <p className="mt-3 text-slate-600">Os dados da sua sessão de fotógrafo.</p>
      </header>
      <dl className="space-y-6 rounded-2xl border bg-white p-6">
        <div>
          <dt className="text-sm text-slate-500">Nome</dt>
          <dd className="mt-1 font-medium">{profile?.nome_completo}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">E-mail</dt>
          <dd className="mt-1 break-all font-medium">{user.email}</dd>
        </div>
      </dl>
      <form action="/auth/signout" method="post">
        <button className="min-h-11 rounded-xl border bg-white px-5">Sair da conta</button>
      </form>
    </div>
  )
}
