'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { criarPedidoAction } from '@/lib/actions/pedidos'
import { consumirPlanoDaVitrine } from '@/lib/plano-vitrine'
import { WizardFooter } from '@/components/dashboard/novo-pedido/wizard-footer'
import { StepPlano } from '@/components/dashboard/novo-pedido/steps/step-plano'
import { StepProjeto } from '@/components/dashboard/novo-pedido/steps/step-projeto'
import { StepFotos } from '@/components/dashboard/novo-pedido/steps/step-fotos'
import { StepBriefing } from '@/components/dashboard/novo-pedido/steps/step-briefing'
import { StepRevisao } from '@/components/dashboard/novo-pedido/steps/step-revisao'
import {
  TOTAL_STEPS,
  passoCompleto,
  usePedidoWizardStore,
  type WizardStep,
} from '@/store/usePedidoWizardStore'
import { cn, rolagemSuave } from '@/lib/utils'
import type { Plan } from '@/types/database'

const STEPS: Record<WizardStep, { label: string; titulo: string; descricao: string }> = {
  1: { label: 'Plano', titulo: 'Escolha o plano', descricao: 'Prazo, revisões e preço de cada opção.' },
  2: { label: 'Projeto', titulo: 'Sobre o projeto', descricao: 'Quem são e quando foi o evento.' },
  3: { label: 'Fotos', titulo: 'Envie as fotos', descricao: 'Link de uma pasta ou direto da galeria.' },
  4: { label: 'Briefing', titulo: 'Briefing', descricao: 'O estilo e o que não pode faltar no álbum.' },
  5: { label: 'Revisão', titulo: 'Revise e envie', descricao: 'Confira tudo antes de mandar para a equipe.' },
}

/** `true` depois que o estado salvo no `localStorage` foi reaplicado na store. */
function useWizardHydrated() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let ativo = true
    Promise.resolve(usePedidoWizardStore.persist.rehydrate()).finally(() => {
      if (ativo) setHydrated(true)
    })
    return () => {
      ativo = false
    }
  }, [])

  return hydrated
}

export function NovoPedidoWizard({
  plans,
  userId,
  assinaturaId,
  planoDaUrl,
  assinaturasNaoContratadas,
}: {
  plans: Plan[]
  userId: string
  /** Plano de assinatura contratado pelo estúdio — pedidos nele não passam pelo checkout. */
  assinaturaId: string | null
  /** Slug do `?plano=` que veio da vitrine. */
  planoDaUrl: string | null
  assinaturasNaoContratadas: { slug: string; nome: string }[]
}) {
  const hydrated = useWizardHydrated()
  const stepAtual = usePedidoWizardStore((s) => s.stepAtual)
  const planoSelecionado = usePedidoWizardStore((s) => s.planoSelecionado)
  const podeAvancar = usePedidoWizardStore((s) => passoCompleto(s, s.stepAtual))
  const { avancar, voltar, irPara, selecionarPlano, limparPedido } = usePedidoWizardStore.getState()

  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [concluido, setConcluido] = useState(false)
  // O state só muda no próximo render; o ref barra o segundo toque imediato.
  const enviandoRef = useRef(false)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const stepAnterior = useRef<WizardStep | null>(null)
  const [avisoPlano, setAvisoPlano] = useState<string | null>(null)

  // Plano escolhido na vitrine (URL ou, depois da confirmação de e-mail, o
  // localStorage do cadastro) vira a seleção do passo 1. Roda uma vez, logo
  // após reidratar — senão o rascunho salvo sobrescreveria a escolha.
  useEffect(() => {
    if (!hydrated) return
    const daStorage = consumirPlanoDaVitrine()
    const slug = planoDaUrl ?? daStorage
    if (planoDaUrl) router.replace('/dashboard/novo-pedido', { scroll: false })
    if (!slug) return

    const plano = plans.find((p) => p.slug === slug)
    if (plano) {
      selecionarPlano(plano.id)
      return
    }
    const assinatura = assinaturasNaoContratadas.find((p) => p.slug === slug)
    if (assinatura) {
      setAvisoPlano(
        `O plano ${assinatura.nome} é por assinatura e ainda não está ativo para o seu estúdio. Por enquanto, escolha um plano avulso.`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na reidratação
  }, [hydrated])

  // Ao retomar um rascunho: plano que saiu do catálogo é descartado, e o
  // fotógrafo nunca cai num passo à frente de um passo ainda incompleto.
  useEffect(() => {
    if (!hydrated) return
    const state = usePedidoWizardStore.getState()
    if (state.planoSelecionado && !plans.some((p) => p.id === state.planoSelecionado)) {
      selecionarPlano(null)
    }
    const s = usePedidoWizardStore.getState()
    const primeiroIncompleto = ([1, 2, 3, 4] as const).find((step) => !passoCompleto(s, step))
    if (primeiroIncompleto && primeiroIncompleto < s.stepAtual) irPara(primeiroIncompleto)
  }, [hydrated, plans, selecionarPlano, irPara])

  // Troca de passo: volta ao topo e move o foco para o título (leitor de tela
  // anuncia o passo novo). No primeiro render não rouba o foco.
  useEffect(() => {
    if (!hydrated) return
    if (stepAnterior.current !== null && stepAnterior.current !== stepAtual) {
      window.scrollTo({ top: 0, behavior: rolagemSuave() })
      headingRef.current?.focus({ preventScroll: true })
      setErroEnvio(null)
    }
    stepAnterior.current = stepAtual
  }, [stepAtual, hydrated])

  // Rascunho já limpo e navegação em andamento: segura a tela em vez de
  // piscar o passo 1 vazio até a próxima rota carregar.
  if (concluido) return <WizardConcluido />
  if (!hydrated) return <WizardSkeleton />

  const meta = STEPS[stepAtual]
  const plano = plans.find((p) => p.id === planoSelecionado) ?? null

  async function finalizar() {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setEnviando(true)
    setErroEnvio(null)

    const s = usePedidoWizardStore.getState()
    try {
      const result = await criarPedidoAction({
        chaveIdempotencia: s.chaveIdempotencia,
        planoId: s.planoSelecionado ?? '',
        nomeProjeto: s.dadosProjeto.nomeProjeto,
        dataEvento: s.dadosProjeto.dataEvento,
        nomeCliente: s.dadosProjeto.nomeCliente,
        telefoneCliente: s.dadosProjeto.telefoneCliente,
        emailCliente: s.dadosProjeto.emailCliente,
        linkFotos: s.fotos.linkExterno,
        estilo: s.briefing.estilo,
        observacoes: s.briefing.observacoes,
      })

      if (!result.ok) {
        setErroEnvio(result.erro)
        return
      }

      setConcluido(true)
      limparPedido()
      router.push(
        `/dashboard/meus-albuns?enviado=${result.numero ?? 'ok'}${result.semPagamento ? '&fila=1' : ''}`,
      )
    } catch {
      // Queda de rede / sessão expirada: o rascunho continua no localStorage.
      setErroEnvio('Sem conexão com o servidor. Seu rascunho continua salvo — tente de novo.')
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  function handleAvancar() {
    if (stepAtual < TOTAL_STEPS) {
      avancar()
      return
    }
    void finalizar()
  }

  return (
    <div className="mx-auto w-full max-w-xl overflow-x-hidden pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <WizardProgress stepAtual={stepAtual} />

      <header className="mb-6 mt-6">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold tracking-tight text-[#171717] outline-none"
        >
          {meta.titulo}
        </h1>
        <p className="mt-1 text-base text-[#595959]">{meta.descricao}</p>
      </header>

      {stepAtual === 1 && avisoPlano ? (
        <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {avisoPlano}
        </p>
      ) : null}
      {stepAtual === 1 ? <StepPlano plans={plans} assinaturaId={assinaturaId} /> : null}
      {stepAtual === 2 ? <StepProjeto /> : null}
      {stepAtual === 3 ? <StepFotos userId={userId} /> : null}
      {stepAtual === 4 ? <StepBriefing /> : null}
      {stepAtual === 5 ? <StepRevisao plano={plano} inclusoNaAssinatura={plano?.id === assinaturaId} /> : null}

      {erroEnvio ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erroEnvio}
        </div>
      ) : null}

      <WizardFooter
        mostrarVoltar={stepAtual > 1}
        ultimoPasso={stepAtual === TOTAL_STEPS}
        podeAvancar={podeAvancar}
        enviando={enviando}
        onVoltar={voltar}
        onAvancar={handleAvancar}
      />
    </div>
  )
}

function WizardProgress({ stepAtual }: { stepAtual: WizardStep }) {
  return (
    <nav aria-label="Progresso do pedido">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#595959]">
        Passo {stepAtual} de {TOTAL_STEPS} · {STEPS[stepAtual].label}
      </p>
      <ol className="mt-3 grid grid-cols-5 gap-1.5">
        {([1, 2, 3, 4, 5] as const).map((step) => (
          <li
            key={step}
            aria-current={step === stepAtual ? 'step' : undefined}
            className={cn(
              'h-1.5 rounded-full transition-colors duration-300',
              step <= stepAtual ? 'bg-[#171717]' : 'bg-[#EAEAEA]',
            )}
          >
            <span className="sr-only">
              {STEPS[step].label}
              {step < stepAtual ? ' (concluído)' : step === stepAtual ? ' (atual)' : ''}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function WizardConcluido() {
  return (
    <div
      role="status"
      className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-3 text-center"
    >
      <Loader2 className="h-6 w-6 animate-spin text-[#171717]" aria-hidden />
      <p className="text-base font-semibold text-[#171717]">Pedido enviado! Abrindo seus álbuns…</p>
    </div>
  )
}

function WizardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl overflow-x-hidden" aria-busy="true">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-3 h-1.5 w-full" />
      <Skeleton className="mt-6 h-8 w-2/3" />
      <Skeleton className="mt-2 h-5 w-1/2" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  )
}
