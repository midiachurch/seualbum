import { Mail } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'
import type { ComunicacaoLogEntry } from '@/types/platform'

const STATUS_LABEL: Record<ComunicacaoLogEntry['status'], string> = {
  simulado: 'Simulado',
  enviado: 'Enviado',
  falhou: 'Falhou',
}

const STATUS_COLOR: Record<ComunicacaoLogEntry['status'], string> = {
  simulado: 'bg-secondary text-secondary-foreground',
  enviado: 'bg-emerald-100 text-emerald-800',
  falhou: 'bg-red-100 text-red-800',
}

/**
 * Caixa de saída (outbox) do projeto — o que o sistema "disparou" para o
 * cliente a cada mudança de status. Gerado pelo gatilho
 * `registrar_comunicacao_status` no banco; nenhum e-mail é enviado de
 * verdade ainda (infraestrutura de envio fica para uma fase seguinte).
 */
export function CommunicationHistory({ entries }: { entries: ComunicacaoLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Nenhuma comunicação registrada ainda"
        description="Toda vez que o status deste projeto mudar para uma etapa relevante ao cliente, o sistema registra aqui o e-mail que seria enviado."
      />
    )
  }

  return (
    <ol className="space-y-4 border-l pl-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
            <Mail className="h-2.5 w-2.5" aria-hidden />
          </span>
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{entry.assunto}</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[entry.status]}`}>
                {STATUS_LABEL[entry.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.dataCriacao)}</p>
            <div
              className="prose-outbox mt-3 text-sm text-foreground"
              // eslint-disable-next-line react/no-danger -- corpo_html é gerado pelo próprio gatilho do banco, nunca por input livre de usuário.
              dangerouslySetInnerHTML={{ __html: entry.corpoHtml }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
