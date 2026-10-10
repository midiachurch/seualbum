'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  History,
  MessageCircle,
  Send,
  Sparkles,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { clientRequestChanges } from '@/lib/actions/projetos'
import { marcarLaminaRevisada } from '@/lib/actions/painel-cliente'
import {
  ESTADO_CHECKLIST_LABEL,
  SITUACAO_VERSAO_LABEL,
  STATUS_PAINEL_COR,
  apontamentosDoPainel,
  checklistDaVersao,
  linhaDoTempoDeVersoes,
  prazoDeResposta,
  resumoDosAjustes,
  situacaoDoProjeto,
  versoesLiberadas,
  type EstadoChecklist,
  type SituacaoVersao,
} from '@/lib/prova/painel'
import { cn, formatDate } from '@/lib/utils'
import type { EstadoRevisaoLamina, Project, ProofComment, RevisaoLamina } from '@/types/platform'

const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

const COR_ESTADO: Record<EstadoChecklist, string> = {
  aprovada: 'bg-emerald-100 text-emerald-900',
  com_comentarios: 'bg-amber-100 text-amber-900',
  vista: 'bg-[#F0F0F0] text-[#444444]',
  nao_vista: 'bg-white text-[#6B6B6B] ring-1 ring-inset ring-[#DDDDDD]',
}

const COR_SITUACAO_VERSAO: Record<SituacaoVersao, string> = {
  aguardando_voce: 'bg-amber-400 text-[#171717]',
  em_analise: 'bg-sky-100 text-sky-900',
  ajustes_pedidos: 'bg-orange-100 text-orange-900',
  aprovada: 'bg-emerald-100 text-emerald-900',
  substituida: 'bg-[#F0F0F0] text-[#6B6B6B]',
}

type Filtro = 'todas' | EstadoChecklist

/**
 * Painel de aprovação do cliente final (aba "Aprovação" do projeto). Resume a
 * prova sem abrir o visualizador: situação e prazo, checklist das lâminas da
 * versão atual, apontamentos com o que o estúdio já resolveu e a linha do
 * tempo das versões.
 *
 * As decisões reaproveitam os fluxos existentes: "Aprovar álbum" abre a prova
 * já no modal de aprovação (com o upsell de adicionais da 0026) e "Pedir
 * ajustes" grava o mesmo `alteracao_solicitada` da prova, com o resumo de
 * todos os comentários da versão.
 */
export function PainelAprovacao({
  project,
  comentarios,
  revisoes: revisoesIniciais,
  meuId,
}: {
  project: Project
  comentarios: ProofComment[]
  /** `null` = checklist indisponível (migration 0039 ainda não aplicada). */
  revisoes: RevisaoLamina[] | null
  meuId?: string | null
}) {
  const router = useRouter()
  const situacao = situacaoDoProjeto(project)
  const podeDecidir = project.status === 'aguardando_aprovacao_cliente'
  const checklistAtivo = revisoesIniciais !== null
  const provaHref = `/cliente/projetos/${project.id}/prova`

  const liberadas = useMemo(() => versoesLiberadas(project.designVersions), [project.designVersions])
  const versaoAtual = liberadas[liberadas.length - 1]
  const [revisoes, setRevisoes] = useState<Record<string, EstadoRevisaoLamina>>(() =>
    Object.fromEntries((revisoesIniciais ?? []).filter((r) => r.versao === versaoAtual?.numero).map((r) => [r.laminaId, r.estado])),
  )
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [todosApontamentos, setTodosApontamentos] = useState(false)
  const [ajustesAberto, setAjustesAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [ajustesEnviados, setAjustesEnviados] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  const checklist = useMemo(
    () =>
      checklistDaVersao(
        versaoAtual,
        comentarios,
        Object.entries(revisoes).map(([laminaId, estado]) => ({ laminaId, estado, versao: versaoAtual?.numero ?? 0 })),
      ),
    [versaoAtual, comentarios, revisoes],
  )
  const versaoParcial = checklist.itens.some((i) => !i.alterada)
  const apontamentos = useMemo(
    () => apontamentosDoPainel(comentarios, project.designVersions, meuId),
    [comentarios, project.designVersions, meuId],
  )
  const etapas = useMemo(
    () => linhaDoTempoDeVersoes(project.designVersions, project.approvals, comentarios, project.status),
    [project.designVersions, project.approvals, comentarios, project.status],
  )
  const prazo = podeDecidir ? prazoDeResposta(project.dataLimiteAprovacao) : null
  const comentariosDaVersaoAtual = versaoAtual ? comentarios.filter((c) => c.versao === versaoAtual.numero) : []
  const abertos = apontamentos.filter((a) => a.aberto).length
  const itensFiltrados = checklist.itens.filter((i) => filtro === 'todas' || i.estado === filtro)
  const apontamentosVisiveis = todosApontamentos ? apontamentos : apontamentos.slice(0, 5)
  const percentual = checklist.total > 0 ? Math.round((checklist.revisadas / checklist.total) * 100) : 0

  async function alternarOk(laminaId: string) {
    if (!podeDecidir || !checklistAtivo || salvando) return
    const antes = revisoes[laminaId]
    const aprovar = antes !== 'aprovada'
    setRevisoes((prev) => ({ ...prev, [laminaId]: aprovar ? 'aprovada' : 'vista' }))
    setErro(null)
    if (DEMO_MODE) return
    setSalvando(laminaId)
    const voltar = () =>
      setRevisoes((prev) => {
        const novo = { ...prev }
        if (antes) novo[laminaId] = antes
        else delete novo[laminaId]
        return novo
      })
    try {
      const r = await marcarLaminaRevisada(project.id, laminaId, aprovar ? 'aprovada' : 'desfazer')
      if (!r.ok) {
        voltar()
        setErro(r.erro)
      }
    } catch {
      voltar()
      setErro('Não foi possível salvar. Tente de novo.')
    } finally {
      setSalvando(null)
    }
  }

  async function enviarAjustes() {
    if (!versaoAtual || comentariosDaVersaoAtual.length === 0) return
    setEnviando(true)
    setErro(null)
    try {
      if (!DEMO_MODE) await clientRequestChanges(project.id, versaoAtual.numero, resumoDosAjustes(comentarios, versaoAtual.numero))
      setAjustesAberto(false)
      setAjustesEnviados(true)
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar os ajustes. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  if (liberadas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#DDDDDD] bg-white px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F5F5]">
          <Clock className="h-6 w-6 text-[#6B6B6B]" aria-hidden />
        </span>
        <p className="font-semibold text-[#171717]">A primeira prova ainda está sendo preparada</p>
        <p className="max-w-xs text-sm text-[#595959]">
          Assim que o estúdio liberar, ela aparece aqui para você revisar lâmina por lâmina.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Situação, prazo e decisões ---------------------------------- */}
      <section aria-labelledby="painel-situacao" className="space-y-4 rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_PAINEL_COR[situacao.status])}>
            {ajustesEnviados ? 'Em ajustes pelo estúdio' : situacao.label}
          </span>
          {versaoAtual ? <span className="text-xs text-[#6B6B6B]">Versão {versaoAtual.numero}</span> : null}
        </div>
        <h2 id="painel-situacao" className="sr-only">
          Situação da prova
        </h2>
        <p className="text-sm text-[#444444]">
          {ajustesEnviados ? 'Recebemos seus pedidos. O estúdio está preparando uma nova versão.' : situacao.descricao}
        </p>

        {prazo && !ajustesEnviados ? (
          <p
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
              prazo.urgente ? 'bg-amber-50 text-amber-900' : 'bg-[#F5F5F5] text-[#444444]',
            )}
          >
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            {prazo.texto}
          </p>
        ) : null}

        {situacao.rastreio ? (
          <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <Truck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Código de rastreio: <strong className="select-all font-mono">{situacao.rastreio}</strong>
              {situacao.enviadoEm ? ` · despachado em ${formatDate(situacao.enviadoEm)}` : ''}
            </span>
          </p>
        ) : null}

        {podeDecidir && !ajustesEnviados ? (
          <div className="space-y-2">
            <Link
              href={provaHref}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Abrir a prova e revisar
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAjustesAberto(true)}
                className="min-h-[48px] rounded-xl border border-[#CCCCCC] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#F5F5F5]"
              >
                Pedir ajustes
              </button>
              <Link
                href={`${provaHref}?acao=aprovar`}
                className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" aria-hidden />
                Aprovar álbum
              </Link>
            </div>
          </div>
        ) : (
          <Link
            href={provaHref}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#CCCCCC] px-4 text-sm font-semibold text-[#171717] hover:bg-[#F5F5F5]"
          >
            <Eye className="h-4 w-4" aria-hidden />
            Ver a prova
          </Link>
        )}

        {erro ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {erro}
          </p>
        ) : null}
      </section>

      {/* 2. Checklist de lâminas --------------------------------------- */}
      {versaoAtual && checklist.total > 0 ? (
        <section aria-labelledby="painel-checklist" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 id="painel-checklist" className="text-sm font-semibold uppercase tracking-wide text-[#6B6B6B]">
              Lâminas da versão {versaoAtual.numero}
            </h2>
            {versaoParcial ? (
              <span className="text-xs text-[#6B6B6B]">{checklist.itens.filter((i) => i.alterada).length} alteradas</span>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4">
            <p className="text-sm text-[#171717]" aria-live="polite">
              <strong className="text-lg tabular-nums">{checklist.revisadas}</strong> de {checklist.total}{' '}
              {checklist.total === 1 ? 'lâmina revisada' : 'lâminas revisadas'}
            </p>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#EAEAEA]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={checklist.total}
              aria-valuenow={checklist.revisadas}
              aria-label="Lâminas revisadas"
            >
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percentual}%` }} />
            </div>
            <p className="mt-2 text-xs text-[#6B6B6B]">
              {checklist.aprovadas} {checklist.aprovadas === 1 ? 'aprovada' : 'aprovadas'} · {checklist.comComentarios} com comentários ·{' '}
              {checklist.naoVistas} {checklist.naoVistas === 1 ? 'ainda não vista' : 'ainda não vistas'}
            </p>
            {!checklistAtivo ? (
              <p className="mt-2 text-xs text-[#6B6B6B]">Comente nas lâminas pela prova para pedir mudanças.</p>
            ) : null}
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar lâminas">
            {(
              [
                ['todas', `Todas (${checklist.total})`],
                ['nao_vista', `Não vistas (${checklist.naoVistas})`],
                ['com_comentarios', `Com comentários (${checklist.comComentarios})`],
                ['aprovada', `Aprovadas (${checklist.aprovadas})`],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtro === valor}
                onClick={() => setFiltro(valor)}
                className={cn(
                  'min-h-[36px] shrink-0 rounded-full px-3 text-xs font-semibold transition-colors',
                  filtro === valor ? 'bg-[#171717] text-white' : 'bg-white text-[#444444] ring-1 ring-inset ring-[#DDDDDD]',
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <ul className="divide-y divide-[#EAEAEA] overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
            {itensFiltrados.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-[#6B6B6B]">Nenhuma lâmina neste filtro.</li>
            ) : (
              itensFiltrados.map((item) => {
                const ok = item.estado === 'aprovada'
                return (
                  <li key={item.lamina.id} className="flex items-center gap-3 pr-2">
                    <Link
                      href={`${provaHref}?lamina=${item.indice + 1}`}
                      className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2 pl-3"
                      aria-label={`Abrir ${item.rotulo} na prova — ${ESTADO_CHECKLIST_LABEL[item.estado]}`}
                    >
                      <span className="relative h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-md bg-[#F0F0F0]">
                        {item.lamina.url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- lâmina via link assinado (URL expira; next/image não se aplica).
                          <img src={item.lamina.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-[#171717]">
                          {item.rotulo}
                          {versaoParcial && item.alterada ? (
                            <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
                              Alterada
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', COR_ESTADO[item.estado])}>
                            {item.estado === 'nao_vista' ? <EyeOff className="h-3 w-3" aria-hidden /> : null}
                            {ESTADO_CHECKLIST_LABEL[item.estado]}
                          </span>
                          {item.comentarios > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#6B6B6B]">
                              <MessageCircle className="h-3 w-3" aria-hidden />
                              {item.comentarios}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                    {podeDecidir && checklistAtivo && !ajustesEnviados ? (
                      <button
                        type="button"
                        onClick={() => void alternarOk(item.lamina.id)}
                        disabled={salvando === item.lamina.id || item.estado === 'com_comentarios'}
                        aria-pressed={ok}
                        aria-label={ok ? `Desfazer "ok" da ${item.rotulo}` : `Marcar ${item.rotulo} como ok`}
                        title={item.estado === 'com_comentarios' ? 'Esta lâmina tem comentários abertos' : undefined}
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-40',
                          ok ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[#CCCCCC] text-[#CCCCCC] hover:border-emerald-600 hover:text-emerald-600',
                        )}
                      >
                        <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
                      </button>
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-[#CCCCCC]" aria-hidden />
                    )}
                  </li>
                )
              })
            )}
          </ul>
        </section>
      ) : null}

      {/* 3. Apontamentos ------------------------------------------------- */}
      <section aria-labelledby="painel-apontamentos" className="space-y-3">
        <h2 id="painel-apontamentos" className="text-sm font-semibold uppercase tracking-wide text-[#6B6B6B]">
          Apontamentos{apontamentos.length ? ` (${abertos} ${abertos === 1 ? 'aberto' : 'abertos'})` : ''}
        </h2>
        {apontamentos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#DDDDDD] bg-white px-4 py-6 text-center text-sm text-[#595959]">
            Nenhum apontamento ainda. Na prova, toque no ponto da lâmina que precisa mudar e escreva o que ajustar.
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {apontamentosVisiveis.map((a) => (
                <li key={a.comentario.id} className="rounded-2xl border border-[#EAEAEA] bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                    <span>
                      {a.rotulo} · Versão {a.versao}
                    </span>
                    {a.meu ? <span className="rounded-full bg-[#F0F0F0] px-1.5 py-0.5 normal-case tracking-normal text-[#444444]">Você</span> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-[#171717] [overflow-wrap:anywhere]">{a.comentario.texto}</p>
                  <p className="mt-2">
                    {a.aberto ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        <Clock className="h-3 w-3" aria-hidden />
                        Aberto
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        {a.resolvidoNaVersao ? `Resolvido pelo estúdio na versão ${a.resolvidoNaVersao}` : 'Resolvido pelo estúdio'}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            {apontamentos.length > 5 ? (
              <button
                type="button"
                onClick={() => setTodosApontamentos((v) => !v)}
                className="min-h-[44px] w-full rounded-xl text-sm font-semibold text-[#171717] underline underline-offset-4"
              >
                {todosApontamentos ? 'Mostrar menos' : `Ver todos os ${apontamentos.length} apontamentos`}
              </button>
            ) : null}
          </>
        )}
      </section>

      {/* 4. Linha do tempo das versões ----------------------------------- */}
      <section aria-labelledby="painel-versoes" className="space-y-3">
        <h2 id="painel-versoes" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#6B6B6B]">
          <History className="h-4 w-4" aria-hidden />
          Versões
        </h2>
        <ol className="space-y-0">
          {etapas.map((etapa, i) => {
            const ultima = i === etapas.length - 1
            return (
              <li key={etapa.id} className="relative flex gap-3 pb-5 last:pb-0">
                {!ultima ? <span className="absolute left-[15px] top-8 h-full w-0.5 bg-[#EAEAEA]" aria-hidden /> : null}
                <span
                  className={cn(
                    'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    i === 0 ? 'bg-[#171717] text-white' : 'bg-[#EAEAEA] text-[#6B6B6B]',
                  )}
                >
                  v{etapa.numero}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-[#EAEAEA] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#171717]">
                      Versão {etapa.numero}
                      <span className="ml-1.5 text-xs font-normal text-[#6B6B6B]">{formatDate(etapa.data)}</span>
                    </p>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', COR_SITUACAO_VERSAO[etapa.situacao])}>
                      {SITUACAO_VERSAO_LABEL[etapa.situacao]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#595959]">
                    {etapa.parcial
                      ? `${etapa.alteradas} de ${etapa.total} ${etapa.total === 1 ? 'lâmina alterada' : 'lâminas alteradas'}`
                      : `${etapa.total} ${etapa.total === 1 ? 'lâmina' : 'lâminas'}${etapa.numero === liberadas[0]?.numero ? ' · primeira versão' : ' · versão completa'}`}
                    {etapa.apontamentos > 0
                      ? ` · ${etapa.apontamentos} ${etapa.apontamentos === 1 ? 'apontamento' : 'apontamentos'}${etapa.resolvidos ? `, ${etapa.resolvidos} resolvido${etapa.resolvidos === 1 ? '' : 's'}` : ''}`
                      : ''}
                  </p>
                  {etapa.decididaEm ? (
                    <p className="mt-0.5 text-xs text-[#6B6B6B]">
                      {etapa.situacao === 'aprovada' ? 'Aprovada' : 'Ajustes pedidos'} em {formatDate(etapa.decididaEm)}
                    </p>
                  ) : null}
                  <Link
                    href={`${provaHref}?versao=${etapa.numero}`}
                    className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-[#171717] underline underline-offset-4"
                  >
                    Ver versão {etapa.numero}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <Modal open={ajustesAberto} onClose={() => setAjustesAberto(false)} title="Pedir ajustes ao estúdio">
        <div className="space-y-4">
          {comentariosDaVersaoAtual.length === 0 ? (
            <p className="text-sm text-[#595959]">
              Você ainda não deixou nenhum comentário nesta versão. Abra a prova e toque nas lâminas para marcar o que mudar.
            </p>
          ) : (
            <>
              <p className="text-sm text-[#595959]">
                {comentariosDaVersaoAtual.length === 1
                  ? 'Este comentário vai para o estúdio como pedido de ajustes:'
                  : `Estes ${comentariosDaVersaoAtual.length} comentários vão para o estúdio como um pedido de ajustes:`}
              </p>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {apontamentos
                  .filter((a) => a.versao === versaoAtual?.numero)
                  .map((a) => (
                    <li key={a.comentario.id} className="rounded-xl border p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">{a.rotulo}</p>
                      <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">{a.comentario.texto}</p>
                    </li>
                  ))}
              </ul>
            </>
          )}
          <div className={MODAL_ACOES}>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setAjustesAberto(false)}>
              Continuar revisando
            </Button>
            {comentariosDaVersaoAtual.length === 0 ? (
              <Link
                href={provaHref}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#171717] px-5 text-sm font-semibold text-white"
              >
                Abrir a prova
              </Link>
            ) : (
              <Button variant="brand" className="min-h-[44px]" onClick={enviarAjustes} disabled={enviando}>
                <Send className="h-4 w-4" aria-hidden />
                {enviando ? 'Enviando…' : 'Enviar pedido de ajustes'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
