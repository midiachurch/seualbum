import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Images, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { requireUser } from '@/lib/supabase/queries'
import { NewGallery } from '@/components/portal/new-gallery'
export default async function GaleriasPage() {
  const { user, profile, supabase } = await requireUser()
  if (profile?.role !== 'fotografo') notFound()
  const result = supabase
    ? await supabase
        .from('projetos')
        .select('id,nome,created_at,arquivos:fotos(count)')
        .eq('fotografo_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
        .returns<{ id: string; nome: string; created_at: string; arquivos: { count: number }[] }[]>()
    : null
  const ids = result?.data?.map((p) => p.id) ?? []
  const selections =
    supabase && ids.length
      ? await supabase
          .from('selecoes_entregues')
          .select('id,projeto_id,revisao,foto_ids,created_at')
          .in('projeto_id', ids)
          .order('created_at', { ascending: false })
          .limit(100)
      : null
  const latest = selections?.data?.[0]
  const galleries = result?.data ?? []
  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Seu Álbum · Digital
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Suas galerias</h1>
          <p className="mt-3 max-w-lg text-slate-600">
            Suas fotos, a escolha do cliente. Tudo em um só lugar.
          </p>
        </div>
        <NewGallery />
      </header>
      {latest && (
        <section
          aria-label="Última seleção recebida"
          className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:p-6"
        >
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <CheckCircle2 size={18} aria-hidden />
              Última seleção recebida
            </p>
            <h2 className="mt-2 font-semibold">{galleries.find((p) => p.id === latest.projeto_id)?.nome}</h2>
            <p className="mt-1 text-sm text-emerald-900">
              {latest.foto_ids.length} fotos · Revisão {latest.revisao} ·{' '}
              {new Date(latest.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </p>
          </div>
          <Link
            href={`/dashboard/galerias/${latest.projeto_id}?aba=selecoes`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-950 underline underline-offset-4"
          >
            Ver seleção e exportar CSV
            <ArrowUpRight size={16} />
          </Link>
        </section>
      )}
      {selections?.error && (
        <p role="alert" className="rounded-xl border bg-white p-4 text-sm">
          Não foi possível consultar as seleções. Abra uma galeria para tentar novamente.
        </p>
      )}
      <section aria-labelledby="lista-galerias">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="lista-galerias" className="text-lg font-semibold">
            Todas as galerias
          </h2>
          <span className="text-sm text-slate-500">
            {galleries.length}
            {galleries.length === 100 ? ' mais recentes' : ' galerias'}
          </span>
        </div>
        {result?.error ? (
          <p role="alert" className="rounded-2xl border bg-white p-6">
            Não foi possível carregar as galerias. Atualize a página para tentar novamente.
          </p>
        ) : !galleries.length ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed bg-white px-6 py-16 text-center">
            <Images size={36} className="text-slate-400" aria-hidden />
            <h3 className="mt-5 text-xl font-semibold">Sua próxima história começa aqui</h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              Crie sua primeira galeria, adicione as fotos e compartilhe o acesso privado com seu cliente.
            </p>
            <a href="#conteudo" className="mt-5 text-sm text-slate-600">
              Use Criar galeria para começar.
            </a>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {galleries.map((p) => {
              const selection = selections?.data?.find((s) => s.projeto_id === p.id)
              const count = p.arquivos?.[0]?.count ?? 0
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/galerias/${p.id}`}
                  className="group rounded-2xl border bg-white p-6 transition hover:border-slate-400 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-slate-100 p-3 text-slate-600">
                      <Images size={24} aria-hidden />
                    </span>
                    <ArrowUpRight size={20} className="text-slate-400 group-hover:text-primary" aria-hidden />
                  </div>
                  <h3 className="mt-6 break-words text-lg font-semibold">{p.nome}</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {count} fotos · Criada em{' '}
                    {new Date(p.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </p>
                  <span
                    className={`mt-5 inline-flex rounded-full px-3 py-1 text-xs font-medium ${selection ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {selection
                      ? `Seleção recebida · r${selection.revisao}`
                      : count
                        ? 'Pronta para compartilhar'
                        : 'Aguardando fotos'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
