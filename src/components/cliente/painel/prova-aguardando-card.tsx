import Link from 'next/link'
import { Clock, Sparkles } from 'lucide-react'
import type { Checklist, PrazoDeResposta } from '@/lib/prova/painel'
import { cn } from '@/lib/utils'

/**
 * Chamada principal do painel do cliente: uma prova esperando a resposta
 * dele, com prazo e quanto já revisou. O botão grande leva à prova; o link
 * menor, ao painel de aprovação do projeto.
 */
export function ProvaAguardandoCard({
  projetoId,
  nome,
  versao,
  capaUrl,
  prazo,
  checklist,
}: {
  projetoId: string
  nome: string
  versao: number | null
  capaUrl: string | null
  prazo: PrazoDeResposta | null
  checklist: Pick<Checklist, 'revisadas' | 'total'> | null
}) {
  const percentual = checklist && checklist.total > 0 ? Math.round((checklist.revisadas / checklist.total) * 100) : 0
  return (
    <article className="overflow-hidden rounded-2xl bg-[#171717] text-white shadow-md">
      <div className="flex gap-3 p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/10">
          {capaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto via link assinado (URL expira; next/image não se aplica).
            <img src={capaUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Sparkles className="h-6 w-6 text-amber-300" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">Aguardando sua aprovação</p>
          <h3 className="mt-0.5 line-clamp-2 break-words font-semibold">{nome}</h3>
          <p className="mt-0.5 text-xs text-white/60">{versao ? `Prova digital · versão ${versao}` : 'Prova digital'}</p>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4">
        {prazo ? (
          <p
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
              prazo.urgente ? 'bg-amber-400 text-[#171717]' : 'bg-white/10 text-white',
            )}
          >
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            {prazo.texto}
          </p>
        ) : null}

        {checklist && checklist.total > 0 ? (
          <div>
            <p className="text-xs text-white/70">
              <strong className="text-white tabular-nums">{checklist.revisadas}</strong> de {checklist.total}{' '}
              {checklist.total === 1 ? 'lâmina revisada' : 'lâminas revisadas'}
            </p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${percentual}%` }} />
            </div>
          </div>
        ) : null}

        <Link
          href={`/cliente/projetos/${projetoId}/prova`}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#171717] hover:bg-white/90"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {checklist && checklist.revisadas > 0 ? 'Continuar revisando' : 'Revisar e aprovar'}
        </Link>
        <Link
          href={`/cliente/projetos/${projetoId}?aba=aprovacao`}
          className="flex min-h-[44px] items-center justify-center text-sm font-semibold text-white/80 underline underline-offset-4 hover:text-white"
        >
          Ver painel de aprovação
        </Link>
      </div>
    </article>
  )
}
