import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { RetencaoCard } from '@/components/admin/crm/retencao-card'
import {
  getAlertasCrm,
  getClients,
  getDashboardMetrics,
  getMetricasFinanceiras,
  getPhotographers,
  getRealAlerts,
  getRecentActivity,
  requirePlatformAccess,
} from '@/lib/supabase/queries'
import { cn, formatBRL, formatRelativeDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }

const THIRTY_DAYS_MS = 30 * 86_400_000

export default async function AdminDashboardPage() {
  const { role } = await requirePlatformAccess('dashboard')
  // Faturamento é assunto da gestão: o operador também abre o dashboard, mas
  // não vê os números financeiros.
  const veFinanceiro = role === 'admin' || role === 'gestor'
  const [metrics, clients, photographers, activity, alerts, financeiro, alertasCrm] = await Promise.all([
    getDashboardMetrics(),
    getClients(),
    getPhotographers(),
    getRecentActivity(),
    getRealAlerts(),
    veFinanceiro ? getMetricasFinanceiras() : Promise.resolve(null),
    // CRM de retenção: assunto comercial, também só da gestão (RLS 0024).
    veFinanceiro ? getAlertasCrm() : Promise.resolve([]),
  ])
  const now = Date.now()

  const novosUsuarios =
    clients.filter((c) => now - new Date(c.createdAt).getTime() < THIRTY_DAYS_MS).length +
    photographers.filter((p) => now - new Date(p.createdAt).getTime() < THIRTY_DAYS_MS).length

  const cards = [
    { label: 'Total de clientes', valor: clients.length },
    { label: 'Total de fotógrafos', valor: photographers.length },
    { label: 'Projetos ativos', valor: metrics.ativos },
    { label: 'Aguardando produção', valor: metrics.aguardandoProducao },
    { label: 'Em produção', valor: metrics.emProducao },
    { label: 'Aguardando aprovação', valor: metrics.aguardandoAprovacao },
    { label: 'Concluídos', valor: metrics.concluidos },
    { label: 'Atrasados', valor: metrics.atrasados, destaque: metrics.atrasados > 0 },
    { label: 'Novos usuários (30 dias)', valor: novosUsuarios },
    { label: 'Novos projetos (30 dias)', valor: metrics.novosProjetos30d },
  ]

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da operação da plataforma.</p>
      </header>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p
              className={cn(
                'mt-1 text-3xl font-bold tracking-tight',
                card.destaque && 'text-destructive',
              )}
            >
              {card.valor}
            </p>
          </div>
        ))}
      </section>

      {financeiro ? <IndicadoresFinanceiros m={financeiro} /> : null}

      {veFinanceiro ? <RetencaoCard alertas={alertasCrm} /> : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Atividades recentes">
          <h2 className="text-lg font-medium tracking-tight">Atividades recentes</h2>
          {activity.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Nenhuma atividade registrada ainda" />
            </div>
          ) : (
            <ol className="mt-4 space-y-4 border-l pl-4">
              {activity.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-foreground" />
                  <p className="text-sm text-foreground">
                    {entry.projeto ? <span className="font-medium">{entry.projeto}: </span> : null}
                    {entry.mensagem}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelativeDate(entry.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-label="Alertas">
          <h2 className="text-lg font-medium tracking-tight">Alertas</h2>
          <ul className="mt-4 space-y-3">
            {alerts.length === 0 ? (
              <EmptyState title="Nenhum alerta no momento" />
            ) : (
              alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-sm',
                    alert.severidade === 'urgente'
                      ? 'border-destructive/30 bg-destructive/5 text-destructive'
                      : 'border-amber-300 bg-amber-50 text-amber-900',
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {alert.mensagem}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}

function IndicadoresFinanceiros({ m }: { m: Awaited<ReturnType<typeof getMetricasFinanceiras>> }) {
  return (
    <section aria-labelledby="indicadores-financeiros">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="indicadores-financeiros" className="text-lg font-medium tracking-tight">
            Indicadores financeiros
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pedidos avulsos pagos pelo checkout. Mensalidades de assinatura não entram aqui.
          </p>
        </div>
        <Link
          href="/admin/pedidos"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Ver esteira
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[#171717] p-5 text-white sm:col-span-2 lg:col-span-1">
          <p className="text-sm text-white/70">Faturamento global</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{formatBRL(m.faturamento)}</p>
          <p className="mt-2 text-xs text-white/60">
            {m.pedidosPagos} {m.pedidosPagos === 1 ? 'pedido pago' : 'pedidos pagos'}
          </p>
        </div>

        <CardFinanceiro
          rotulo="Ticket médio"
          valor={m.pedidosPagos > 0 ? formatBRL(m.ticketMedio) : '—'}
          detalhe={m.pedidosPagos > 0 ? 'Faturamento ÷ pedidos pagos' : 'Nenhum pedido pago ainda'}
        />
        <CardFinanceiro
          rotulo="Na fila de design"
          valor={String(m.naFilaDesign)}
          detalhe="Pagos ou de assinantes, aguardando a equipe"
          destaque={m.naFilaDesign > 0}
        />
        <CardFinanceiro
          rotulo="Aguardando pagamento"
          valor={String(m.aguardandoPagamento)}
          detalhe={m.aguardandoPagamento > 0 ? `${formatBRL(m.aReceber)} a receber` : 'Nenhum pedido em aberto'}
        />
      </div>
    </section>
  )
}

function CardFinanceiro({
  rotulo,
  valor,
  detalhe,
  destaque = false,
}: {
  rotulo: string
  valor: string
  detalhe: string
  destaque?: boolean
}) {
  return (
    <div className={cn('rounded-2xl border bg-card p-5', destaque && 'border-[#171717]')}>
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{valor}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detalhe}</p>
    </div>
  )
}
