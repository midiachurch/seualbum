'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Mail, Phone, RefreshCw, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { marcarAlertaCrm, rodarAlertasCrm } from '@/lib/actions/crm'
import { cn, formatDate } from '@/lib/utils'
import type { AlertaCrm } from '@/lib/supabase/queries'
import type { NotificacaoCrmStatus } from '@/types/database'

const STATUS: Record<NotificacaoCrmStatus, { rotulo: string; classe: string }> = {
  aberta: { rotulo: 'Aberto', classe: 'bg-amber-100 text-amber-900' },
  contatado: { rotulo: 'Contatado', classe: 'bg-sky-100 text-sky-900' },
  resolvida: { rotulo: 'Resolvido', classe: 'bg-emerald-100 text-emerald-900' },
  dispensada: { rotulo: 'Dispensado', classe: 'bg-[#F5F5F5] text-[#595959]' },
}

/** "2026-09" → "setembro de 2026" */
function nomeDoMes(ref: string) {
  const [ano, mes] = ref.split('-').map(Number)
  if (!ano || !mes) return ref
  return new Date(ano, mes - 1, 15).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function descricao(a: AlertaCrm) {
  if (a.tipo === 'sem_pedido_7d') {
    return `Cadastrado há ${a.dados.dias_cadastrado ?? '7+'} dias e ainda não fez nenhum pedido.`
  }
  const cota = a.dados.albuns_inclusos ? ` (cota: ${a.dados.albuns_inclusos} álbuns)` : ''
  return `Assinante${a.dados.plano ? ` ${a.dados.plano}` : ''} sem nenhum pedido em ${nomeDoMes(a.referencia)}${cota}.`
}

/**
 * CRM de retenção no dashboard da gestão (Fase de expansão, migration 0024).
 * A detecção roda sozinha todo dia às 09:00 (pg_cron); aqui a gestão age
 * sobre cada alerta. No futuro, o disparo de WhatsApp/e-mail lê desta fila.
 */
export function RetencaoCard({ alertas }: { alertas: AlertaCrm[] }) {
  const router = useRouter()
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [atualizando, startAtualizar] = useTransition()

  const ativos = alertas.filter((a) => a.status === 'aberta' || a.status === 'contatado')
  const encerrados = alertas.filter((a) => a.status === 'resolvida' || a.status === 'dispensada')
  const visiveis = mostrarEncerrados ? alertas : ativos

  async function marcar(id: string, status: NotificacaoCrmStatus) {
    setOcupado(id)
    setAviso(null)
    const r = await marcarAlertaCrm(id, status)
    setOcupado(null)
    if (!r.ok) setAviso(r.erro)
    else router.refresh()
  }

  function atualizar() {
    setAviso(null)
    startAtualizar(async () => {
      const r = await rodarAlertasCrm()
      if (!r.ok) setAviso(r.erro)
      else {
        const { novos = 0, resolvidos = 0 } = r.dados ?? {}
        setAviso(
          novos === 0 && resolvidos === 0
            ? 'Nada novo: nenhum fotógrafo entrou ou saiu das regras desde a última verificação.'
            : `${novos} ${novos === 1 ? 'alerta novo' : 'alertas novos'} · ${resolvidos} resolvido(s) automaticamente.`,
        )
        router.refresh()
      }
    })
  }

  return (
    <section aria-labelledby="crm-retencao" className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="crm-retencao" className="flex items-center gap-2 text-lg font-medium tracking-tight">
            <UserX className="h-5 w-5" aria-hidden />
            Retenção de fotógrafos
            {ativos.length > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{ativos.length}</span>
            ) : null}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sem pedido 7 dias após o cadastro, ou assinante sem pedido até o dia 20 do mês. Verificado todo dia às 09:00.
          </p>
        </div>
        <Button variant="outline" size="sm" className="min-h-[40px]" onClick={atualizar} disabled={atualizando}>
          <RefreshCw className={cn('h-4 w-4', atualizando && 'animate-spin')} aria-hidden />
          {atualizando ? 'Verificando…' : 'Verificar agora'}
        </Button>
      </div>

      {aviso ? (
        <p role="status" className="mt-3 rounded-xl bg-[#F5F5F5] p-3 text-sm text-[#444444]">
          {aviso}
        </p>
      ) : null}

      {visiveis.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum fotógrafo parado agora. 🎉
        </p>
      ) : (
        <ul className="mt-4 divide-y">
          {visiveis.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-semibold">{a.fotografo.estudio}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS[a.status].classe)}>
                    {STATUS[a.status].rotulo}
                  </span>
                </p>
                <p className="text-sm text-[#444444]">{descricao(a)}</p>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {a.fotografo.nome ? <span>{a.fotografo.nome}</span> : null}
                  {a.fotografo.email ? (
                    <a href={`mailto:${a.fotografo.email}`} className="inline-flex min-h-[32px] items-center gap-1 break-all underline-offset-2 hover:underline">
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {a.fotografo.email}
                    </a>
                  ) : null}
                  {a.fotografo.telefone ? (
                    <a href={`tel:${a.fotografo.telefone}`} className="inline-flex min-h-[32px] items-center gap-1 underline-offset-2 hover:underline">
                      <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {a.fotografo.telefone}
                    </a>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    alerta de {formatDate(a.criadaEm)}
                    {a.dados.resolvida_automaticamente ? ' · voltou a pedir' : ''}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {a.status === 'aberta' ? (
                  <Button size="sm" variant="brand" className="min-h-[40px]" disabled={ocupado === a.id} onClick={() => marcar(a.id, 'contatado')}>
                    Marcar como contatado
                  </Button>
                ) : null}
                {a.status === 'aberta' || a.status === 'contatado' ? (
                  <>
                    <Button size="sm" variant="outline" className="min-h-[40px]" disabled={ocupado === a.id} onClick={() => marcar(a.id, 'resolvida')}>
                      Resolver
                    </Button>
                    <Button size="sm" variant="ghost" className="min-h-[40px]" disabled={ocupado === a.id} onClick={() => marcar(a.id, 'dispensada')}>
                      Dispensar
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="min-h-[40px]" disabled={ocupado === a.id} onClick={() => marcar(a.id, 'aberta')}>
                    Reabrir
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {encerrados.length > 0 ? (
        <button
          type="button"
          onClick={() => setMostrarEncerrados((v) => !v)}
          className="mt-2 min-h-[40px] text-sm font-medium text-[#444444] underline-offset-2 hover:underline"
        >
          {mostrarEncerrados ? 'Ocultar encerrados' : `Ver encerrados (${encerrados.length})`}
        </button>
      ) : null}
    </section>
  )
}
