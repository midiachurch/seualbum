import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Eye, PenTool } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ERRO_SEM_MIGRACAO_DIAGRAMACAO,
  ETAPA_COR,
  ETAPA_LABEL,
  PRIORIDADE_COR,
  PRIORIDADE_LABEL,
  descreverPrazo,
  formatarHoras,
  linkEditor,
  linkProva,
  origemDoItem,
  type ResumoDiagramacao,
} from '@/lib/diagramacao/regras'
import { cn } from '@/lib/utils'
import { PLATFORM_ROLE_LABEL, type PlatformRole } from '@/types/platform'

/**
 * Seção "Diagramação" do dashboard (/admin): KPIs, carga por diagramador e os
 * itens mais urgentes, tudo de uma RPC (`diagramacao_resumo`, migration 0038).
 */
export function ResumoDiagramacaoSecao({ resumo, semMigracao }: { resumo: ResumoDiagramacao | null; semMigracao: boolean }) {
  return (
    <section aria-labelledby="secao-diagramacao" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="secao-diagramacao" className="text-lg font-medium tracking-tight">
            Diagramação
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Projetos da esteira e álbuns avulsos do editor.</p>
        </div>
        <Link
          href="/admin/diagramacao"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Centro de controle
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {semMigracao ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{ERRO_SEM_MIGRACAO_DIAGRAMACAO}</p>
      ) : !resumo ? (
        <EmptyState title="Não foi possível carregar a diagramação agora" />
      ) : (
        <Conteudo resumo={resumo} />
      )}
    </section>
  )
}

function Conteudo({ resumo }: { resumo: ResumoDiagramacao }) {
  const k = resumo.kpis
  const cards: { rotulo: string; valor: number; detalhe: string; destaque?: boolean; href: string }[] = [
    {
      rotulo: 'Em diagramação',
      valor: k.em_diagramacao,
      detalhe: `${k.a_diagramar} a começar · ${k.sem_responsavel} sem responsável`,
      href: '/admin/diagramacao',
    },
    {
      rotulo: 'Com o cliente',
      valor: k.aguardando_cliente,
      detalhe: k.cliente_atrasado > 0 ? `${k.cliente_atrasado} com aprovação vencida` : 'Aguardando aprovação',
      href: '/admin/diagramacao?etapa=aguardando_cliente',
    },
    {
      rotulo: 'Ajustes pedidos',
      valor: k.alteracoes,
      detalhe: 'Cliente pediu alterações',
      href: '/admin/diagramacao?etapa=alteracoes',
    },
    {
      rotulo: 'Aprovados',
      valor: k.aprovados_30d,
      detalhe: 'Últimos 30 dias',
      href: '/admin/diagramacao?etapa=aprovado',
    },
    {
      rotulo: 'Atrasados',
      valor: k.atrasados,
      detalhe: k.em_espera > 0 ? `Prazo vencido · ${k.em_espera} em espera` : 'Prazo da diagramação vencido',
      destaque: k.atrasados > 0,
      href: '/admin/diagramacao?atrasados=1',
    },
  ]

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.rotulo}
            href={c.href}
            className={cn(
              'rounded-2xl border bg-card p-5 transition-colors hover:border-[#171717]',
              c.destaque && 'border-destructive/40 bg-destructive/5',
            )}
          >
            <p className="text-sm text-muted-foreground">{c.rotulo}</p>
            <p className={cn('mt-1 text-3xl font-bold tabular-nums tracking-tight', c.destaque && 'text-destructive')}>{c.valor}</p>
            <p className="mt-2 text-xs text-muted-foreground">{c.detalhe}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-[#444444]">Carga por diagramador</h3>
          {resumo.designers.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="Nenhum diagramador ativo" description="Convide designers em Equipe." />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-[#FAFAFA] text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Diagramador</th>
                    <th className="px-3 py-2 text-right font-medium">Atribuídos</th>
                    <th className="px-3 py-2 text-right font-medium">Em andamento</th>
                    <th className="px-3 py-2 text-right font-medium">Atrasados</th>
                    <th className="px-4 py-2 text-right font-medium" title="Da entrada (ou do pedido de ajustes) até a versão enviada, últimos 90 dias">
                      Entrega média
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {resumo.designers.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/diagramacao?responsavel=${d.id}`} className="font-medium hover:underline">
                          {d.nome_completo}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">{PLATFORM_ROLE_LABEL[d.papel as PlatformRole] ?? d.papel}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{d.atribuidos}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{d.em_andamento}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums', d.atrasados > 0 && 'font-semibold text-destructive')}>{d.atrasados}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatarHoras(d.horas_medias)}
                        {d.entregas_90d > 0 ? <span className="ml-1 text-xs">({d.entregas_90d})</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#444444]">Mais urgentes</h3>
          {resumo.urgentes.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="Nada urgente na diagramação" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {resumo.urgentes.map((i) => {
                const prova = linkProva(i)
                return (
                  <li key={`${i.tipo}:${i.id}`} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {i.numero ? <span className="text-muted-foreground">#{i.numero} </span> : null}
                          {i.nome}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {origemDoItem(i)} · {i.responsavel_nome ?? 'Sem responsável'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {i.prioridade !== 'normal' ? (
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', PRIORIDADE_COR[i.prioridade])}>
                            {PRIORIDADE_LABEL[i.prioridade]}
                          </span>
                        ) : null}
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ETAPA_COR[i.etapa])}>{ETAPA_LABEL[i.etapa]}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className={cn('flex items-center gap-1 text-xs', i.atrasado || i.cliente_atrasado ? 'text-destructive' : 'text-muted-foreground')}>
                        {i.atrasado || i.cliente_atrasado ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : null}
                        {i.cliente_atrasado ? `Cliente: ${descreverPrazo(i.prazo_cliente).toLowerCase()}` : descreverPrazo(i.prazo)}
                        {i.apontamentos_abertos > 0 ? ` · ${i.apontamentos_abertos} apontamento${i.apontamentos_abertos > 1 ? 's' : ''}` : ''}
                      </p>
                      <div className="flex gap-1.5">
                        <Link
                          href={linkEditor(i)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#171717] px-2.5 text-xs font-semibold text-white hover:bg-[#2E2E2E]"
                        >
                          <PenTool className="h-3.5 w-3.5" aria-hidden />
                          Abrir editor
                        </Link>
                        {prova ? (
                          <Link
                            href={prova}
                            target={i.tipo === 'avulso' ? '_blank' : undefined}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold text-[#444444] hover:bg-[#F5F5F5]"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                            Ver prova
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
