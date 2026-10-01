import { NextResponse, type NextRequest } from 'next/server'

/**
 * Recebe o Database Webhook do Supabase (trigger `trg_notificar_aguardando_aprovacao`
 * em `public.projetos`, ver supabase/migrations/0004_webhook_status.sql) sempre
 * que um projeto entra em "Aguardando aprovação do cliente". Hoje só registra
 * a intenção — a Fase 9 troca o `console.log` por um disparo de e-mail real
 * (Resend/Postmark) usando o endereço do cliente.
 *
 * Protegida por um segredo compartilhado (`WEBHOOK_SECRET`) enviado pelo
 * gatilho via header — sem isso, qualquer um na internet poderia forjar
 * chamadas para esta rota.
 */

type ProjetoWebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: { id: string; nome: string; status: string; cliente_id: string } | null
  old_record: { status: string } | null
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: ProjetoWebhookPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { record, old_record: oldRecord } = payload
  if (!record) return NextResponse.json({ ok: true, skipped: 'sem record' })

  const virouAguardandoAprovacao =
    record.status === 'aguardando_aprovacao_cliente' && oldRecord?.status !== 'aguardando_aprovacao_cliente'

  if (virouAguardandoAprovacao) {
    console.log(
      `[webhook:status] Email de aprovação seria enviado para o cliente do projeto "${record.nome}" ` +
        `(projeto_id=${record.id}, cliente_id=${record.cliente_id}).`,
    )
  }

  return NextResponse.json({ ok: true, notificou: virouAguardandoAprovacao })
}
