import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'
import { listarConversas } from '@/lib/actions/mensagens'
import { requireClientPortal } from '@/lib/supabase/queries'

export const metadata: Metadata = { title: 'Mensagens' }

/**
 * Atalho "Mensagens" do menu do cliente final. A conversa vive na aba
 * Mensagens de cada álbum; com um álbum só (o comum), vai direto para ela.
 */
export default async function ClienteMensagensPage() {
  const { supabase } = await requireClientPortal()
  if (!supabase) redirect('/cliente')

  // A RLS de `projetos` devolve só os álbuns deste cliente.
  const [{ data: projetos }, lista] = await Promise.all([
    supabase.from('projetos').select('id, nome').order('created_at', { ascending: false }).limit(50),
    listarConversas({ canal: 'cliente_estudio', incluirVazias: true }),
  ])
  const albuns = (projetos ?? []) as { id: string; nome: string }[]
  if (albuns.length === 1) redirect(`/cliente/projetos/${albuns[0].id}?aba=mensagens`)

  const porProjeto = new Map((lista.ok ? lista.conversas : []).map((c) => [c.projetoId, c]))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-[#171717]">Mensagens</h1>
      {albuns.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#DADADA] p-8 text-center text-sm text-[#6B6B6B]">
          Quando o seu álbum for criado, você conversa com o seu fotógrafo por aqui.
        </p>
      ) : (
        <ul className="divide-y divide-[#EAEAEA] overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
          {albuns.map((p) => {
            const conversa = porProjeto.get(p.id)
            return (
              <li key={p.id}>
                <Link href={`/cliente/projetos/${p.id}?aba=mensagens`} className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#171717]">{p.nome}</span>
                    <span className="block truncate text-xs text-[#6B6B6B]">
                      {conversa?.ultimaMensagemPrevia ?? (conversa ? `Converse com ${conversa.estudio}` : 'Converse com o seu fotógrafo')}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {conversa && conversa.naoLidas > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#171717] px-1.5 text-[11px] font-bold text-white">
                        {conversa.naoLidas}
                      </span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-[#8A8A8A]" aria-hidden />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
