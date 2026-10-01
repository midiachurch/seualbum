'use client'

import { Pencil } from 'lucide-react'
import { cn, formatarTamanho, formatBRL, formatDate } from '@/lib/utils'
import { usePedidoWizardStore, type WizardStep } from '@/store/usePedidoWizardStore'
import type { Plan } from '@/types/database'

/** Resumo tipo checkout. Cada bloco tem "Editar" que volta direto ao passo. */
export function StepRevisao({ plano, inclusoNaAssinatura }: { plano: Plan | null; inclusoNaAssinatura: boolean }) {
  const dados = usePedidoWizardStore((s) => s.dadosProjeto)
  const fotos = usePedidoWizardStore((s) => s.fotos)
  const briefing = usePedidoWizardStore((s) => s.briefing)
  const irPara = usePedidoWizardStore((s) => s.irPara)

  const enviadas = fotos.arquivos.filter((a) => a.status === 'enviado')
  const contato = [dados.nomeCliente, dados.telefoneCliente, dados.emailCliente].filter(Boolean)

  return (
    <div className="space-y-3">
      <Bloco titulo="Plano" step={1} onEditar={irPara}>
        {plano ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold text-[#171717]">{plano.nome_plano}</span>
            {inclusoNaAssinatura ? (
              <span className="text-sm font-semibold text-emerald-700">Incluso na assinatura</span>
            ) : (
              <span className="text-lg font-bold text-[#171717]">
                {formatBRL(plano.preco)}
                <span className="ml-1 text-sm font-medium text-[#595959]">
                  {plano.tipo_cobranca === 'assinatura' ? '/mês' : '/álbum'}
                </span>
              </span>
            )}
          </div>
        ) : (
          <Faltando>Escolha um plano</Faltando>
        )}
      </Bloco>

      <Bloco titulo="Projeto" step={2} onEditar={irPara}>
        <p className="font-semibold text-[#171717]">{dados.nomeProjeto || <Faltando>Sem nome</Faltando>}</p>
        {dados.dataEvento ? <p className="text-sm text-[#595959]">{/* Meio-dia local: `yyyy-mm-dd` puro vira meia-noite UTC e cai no dia anterior no Brasil. */}
            {formatDate(`${dados.dataEvento}T12:00:00`)}</p> : null}
        {contato.length > 0 ? <p className="mt-1 break-words text-sm text-[#595959]">{contato.join(' · ')}</p> : null}
      </Bloco>

      <Bloco titulo="Fotos" step={3} onEditar={irPara}>
        {enviadas.length > 0 ? (
          <p className="font-semibold text-[#171717]">
            {enviadas.length} {enviadas.length === 1 ? 'foto enviada' : 'fotos enviadas'}
            <span className="ml-1 font-normal text-[#595959]">
              · {formatarTamanho(enviadas.reduce((s, a) => s + a.tamanho, 0))}
            </span>
          </p>
        ) : null}
        {fotos.linkExterno ? (
          <p className="truncate text-sm text-[#444444]">{fotos.linkExterno}</p>
        ) : null}
        {enviadas.length === 0 && !fotos.linkExterno ? <Faltando>Nenhuma foto enviada</Faltando> : null}
      </Bloco>

      <Bloco titulo="Briefing" step={4} onEditar={irPara}>
        <p className="font-semibold text-[#171717]">{briefing.estilo || <Faltando>Estilo não escolhido</Faltando>}</p>
        {briefing.observacoes ? (
          <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-[#595959]">{briefing.observacoes}</p>
        ) : null}
      </Bloco>

      {plano ? (
        <p className="px-1 pt-2 text-sm text-[#595959]">
          {inclusoNaAssinatura
            ? `Sem cobrança extra: o pedido entra direto na fila de design. Entrega em até ${plano.prazo_dias} dias úteis.`
            : `Depois de enviar, você paga por Pix ou cartão e o pedido entra na fila de design. Entrega em até ${plano.prazo_dias} dias úteis.`}
        </p>
      ) : null}
    </div>
  )
}

function Bloco({
  titulo,
  step,
  onEditar,
  children,
}: {
  titulo: string
  step: WizardStep
  onEditar: (step: WizardStep) => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[#EAEAEA] bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#595959]">{titulo}</h2>
        <button
          type="button"
          onClick={() => onEditar(step)}
          className={cn(
            '-mr-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#444444]',
            'hover:bg-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]',
          )}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Editar
          <span className="sr-only"> {titulo.toLowerCase()}</span>
        </button>
      </div>
      <div className="mt-1">{children}</div>
    </section>
  )
}

function Faltando({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-destructive">{children}</span>
}
