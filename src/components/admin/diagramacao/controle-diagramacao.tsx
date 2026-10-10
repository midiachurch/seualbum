'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, Columns3, Copy, Eye, Link2, Loader2, Pause, PenTool, Play, Rows3, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import {
  atribuirDiagramacao,
  definirEsperaDiagramacao,
  definirPrazoDiagramacao,
  definirPrioridadeDiagramacao,
  type ResultadoDiagramacao,
} from '@/lib/actions/diagramacao'
import {
  ERRO_SEM_MIGRACAO_DIAGRAMACAO,
  ETAPAS_DIAGRAMACAO,
  ETAPA_COR,
  ETAPA_LABEL,
  PRIORIDADES,
  PRIORIDADE_COR,
  PRIORIDADE_LABEL,
  descreverPrazo,
  diaDoPrazo,
  filtrarItens,
  linkEditor,
  linkProva,
  linkPublicarAprovacao,
  ordenarPorUrgencia,
  origemDoItem,
  type DiagramacaoItemRow,
  type EtapaDiagramacao,
  type FiltrosDiagramacao,
  type ItemRef,
  type PrioridadeDiagramacao,
  type TipoItemDiagramacao,
} from '@/lib/diagramacao/regras'
import { cn } from '@/lib/utils'

export type MembroEquipe = { id: string; nome: string; papel: string }

const chave = (i: Pick<DiagramacaoItemRow, 'tipo' | 'id'>) => `${i.tipo}:${i.id}`
const ref = (i: Pick<DiagramacaoItemRow, 'tipo' | 'id'>): ItemRef => ({ tipo: i.tipo, id: i.id })

const SELECT = 'h-9 rounded-lg border border-input bg-background px-2 text-sm'

function haQuanto(iso: string | null) {
  if (!iso) return '—'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 60) return min < 1 ? 'agora' : `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return d < 60 ? `há ${d} dia${d > 1 ? 's' : ''}` : new Date(iso).toLocaleDateString('pt-BR')
}

/**
 * Centro de controle da diagramação: todos os álbuns em diagramação (projetos
 * e avulsos), filtráveis, em tabela ou quadro. A gestão (admin/gestor)
 * atribui — inclusive em massa —, muda prazo e prioridade e pausa; os demais
 * só consultam e abrem editor/prova.
 */
export function ControleDiagramacao({
  itens,
  equipe,
  podeGerir,
  semMigracao,
  filtrosIniciais,
}: {
  itens: DiagramacaoItemRow[]
  equipe: MembroEquipe[]
  podeGerir: boolean
  semMigracao: boolean
  filtrosIniciais: FiltrosDiagramacao
}) {
  const router = useRouter()
  const [filtros, setFiltros] = useState<FiltrosDiagramacao>({ mostrarEmEspera: true, ...filtrosIniciais })
  const [visao, setVisao] = useState<'tabela' | 'quadro'>('tabela')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [massaResponsavel, setMassaResponsavel] = useState('')
  const [massaPrioridade, setMassaPrioridade] = useState<PrioridadeDiagramacao | ''>('')
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [pendente, iniciar] = useTransition()
  const [prazoDe, setPrazoDe] = useState<DiagramacaoItemRow | null>(null)
  const [esperaDe, setEsperaDe] = useState<DiagramacaoItemRow | null>(null)

  const estudios = useMemo(
    () => [...new Set(itens.map((i) => i.estudio).filter((e): e is string => Boolean(e)))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [itens],
  )
  const visiveis = useMemo(() => ordenarPorUrgencia(filtrarItens(itens, filtros)), [itens, filtros])
  const selecionadosVisiveis = visiveis.filter((i) => selecionados.has(chave(i)))
  const todosMarcados = visiveis.length > 0 && selecionadosVisiveis.length === visiveis.length

  function set<K extends keyof FiltrosDiagramacao>(k: K, v: FiltrosDiagramacao[K]) {
    setFiltros((f) => ({ ...f, [k]: v }))
  }

  function executar(acao: () => Promise<ResultadoDiagramacao>, sucesso: string, depois?: () => void) {
    setAviso(null)
    iniciar(async () => {
      const r = await acao()
      if (r.ok) {
        setAviso({ tipo: 'ok', texto: sucesso.replace('{n}', String(r.atualizados)) })
        depois?.()
        router.refresh()
      } else {
        setAviso({ tipo: 'erro', texto: r.erro })
      }
    })
  }

  function alternar(i: DiagramacaoItemRow) {
    setSelecionados((s) => {
      const n = new Set(s)
      if (n.has(chave(i))) n.delete(chave(i))
      else n.add(chave(i))
      return n
    })
  }

  function marcarTodos() {
    setSelecionados(todosMarcados ? new Set() : new Set(visiveis.map(chave)))
  }

  async function copiarLink(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/album/${token}`)
      setAviso({ tipo: 'ok', texto: 'Link de aprovação copiado.' })
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não foi possível copiar o link.' })
    }
  }

  const nomeDe = (id: string | null) => (id ? (equipe.find((m) => m.id === id)?.nome ?? null) : null)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diagramação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Centro de controle: quem está com cada álbum, prazos, provas e apontamentos.{' '}
            <Link href="/admin/design" className="font-medium underline-offset-4 hover:underline">
              Fila do designer
            </Link>
            {podeGerir ? (
              <>
                {' · '}
                <Link href="/admin/diagramacao/templates" className="font-medium underline-offset-4 hover:underline">
                  Templates de lâmina
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Visualização">
          {(['tabela', 'quadro'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisao(v)}
              aria-pressed={visao === v}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium',
                visao === v ? 'bg-[#171717] text-white' : 'text-[#595959] hover:bg-[#F5F5F5]',
              )}
            >
              {v === 'tabela' ? <Rows3 className="h-4 w-4" aria-hidden /> : <Columns3 className="h-4 w-4" aria-hidden />}
              {v === 'tabela' ? 'Tabela' : 'Quadro'}
            </button>
          ))}
        </div>
      </header>

      {semMigracao ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{ERRO_SEM_MIGRACAO_DIAGRAMACAO}</p>
      ) : null}

      <section aria-label="Filtros" className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="busca-diag" className="text-xs">Buscar</Label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              id="busca-diag"
              value={filtros.busca ?? ''}
              onChange={(e) => set('busca', e.target.value)}
              placeholder="Álbum, nº, estúdio, cliente, responsável"
              className="h-9 pl-8"
            />
          </div>
        </div>
        <Filtro rotulo="Etapa">
          <select className={SELECT} value={filtros.etapa ?? ''} onChange={(e) => set('etapa', e.target.value as EtapaDiagramacao | '')}>
            <option value="">Todas</option>
            {ETAPAS_DIAGRAMACAO.map((e) => (
              <option key={e} value={e}>{ETAPA_LABEL[e]}</option>
            ))}
          </select>
        </Filtro>
        <Filtro rotulo="Responsável">
          <select className={SELECT} value={filtros.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value)}>
            <option value="">Todos</option>
            <option value="sem">Sem responsável</option>
            {equipe.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </Filtro>
        <Filtro rotulo="Estúdio">
          <select className={SELECT} value={filtros.estudio ?? ''} onChange={(e) => set('estudio', e.target.value)}>
            <option value="">Todos</option>
            {estudios.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </Filtro>
        <Filtro rotulo="Prioridade">
          <select className={SELECT} value={filtros.prioridade ?? ''} onChange={(e) => set('prioridade', e.target.value as PrioridadeDiagramacao | '')}>
            <option value="">Todas</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
            ))}
          </select>
        </Filtro>
        <Filtro rotulo="Tipo">
          <select className={SELECT} value={filtros.tipo ?? ''} onChange={(e) => set('tipo', e.target.value as TipoItemDiagramacao | '')}>
            <option value="">Todos</option>
            <option value="projeto">Projetos</option>
            <option value="avulso">Avulsos</option>
          </select>
        </Filtro>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(filtros.soAtrasados)} onChange={(e) => set('soAtrasados', e.target.checked)} />
          Só atrasados
        </label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={filtros.mostrarEmEspera === false} onChange={(e) => set('mostrarEmEspera', !e.target.checked)} />
          Ocultar em espera
        </label>
      </section>

      {aviso ? (
        <p
          role="status"
          className={cn(
            'rounded-xl border p-3 text-sm',
            aviso.tipo === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-destructive/30 bg-destructive/5 text-destructive',
          )}
        >
          {aviso.texto}
        </p>
      ) : null}

      {podeGerir && selecionadosVisiveis.length > 0 ? (
        <section aria-label="Ações em massa" className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[#171717] bg-white p-3 shadow-sm">
          <span className="text-sm font-medium">
            {selecionadosVisiveis.length} selecionado{selecionadosVisiveis.length > 1 ? 's' : ''}
          </span>
          <select className={SELECT} value={massaResponsavel} onChange={(e) => setMassaResponsavel(e.target.value)} aria-label="Responsável para os selecionados">
            <option value="">Escolha o responsável…</option>
            <option value="sem">Sem responsável</option>
            {equipe.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="brand"
            disabled={pendente || !massaResponsavel}
            onClick={() =>
              executar(
                () => atribuirDiagramacao(selecionadosVisiveis.map(ref), massaResponsavel === 'sem' ? null : massaResponsavel),
                '{n} álbum(ns) atribuído(s).',
                () => setSelecionados(new Set()),
              )
            }
          >
            Atribuir
          </Button>
          <select
            className={SELECT}
            value={massaPrioridade}
            onChange={(e) => setMassaPrioridade(e.target.value as PrioridadeDiagramacao | '')}
            aria-label="Prioridade para os selecionados"
          >
            <option value="">Prioridade…</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="brandOutline"
            disabled={pendente || !massaPrioridade}
            onClick={() =>
              massaPrioridade &&
              executar(() => definirPrioridadeDiagramacao(selecionadosVisiveis.map(ref), massaPrioridade), 'Prioridade aplicada em {n} álbum(ns).')
            }
          >
            Aplicar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>
            Limpar seleção
          </Button>
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Salvando" /> : null}
        </section>
      ) : null}

      {visiveis.length === 0 ? (
        <EmptyState
          title={itens.length === 0 ? 'Nenhum álbum em diagramação' : 'Nenhum álbum com esses filtros'}
          description={itens.length === 0 ? 'Os projetos aparecem aqui quando as fotos chegam; os avulsos, ao serem criados no editor.' : undefined}
        />
      ) : visao === 'tabela' ? (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-[#FAFAFA] text-left text-xs text-muted-foreground">
              <tr>
                {podeGerir ? (
                  <th className="w-10 px-3 py-2">
                    <input type="checkbox" checked={todosMarcados} onChange={marcarTodos} aria-label="Selecionar todos" />
                  </th>
                ) : null}
                <th className="px-3 py-2 font-medium">Álbum</th>
                <th className="px-3 py-2 font-medium">Etapa</th>
                <th className="px-3 py-2 font-medium">Responsável</th>
                <th className="px-3 py-2 font-medium">Estúdio / cliente</th>
                <th className="px-3 py-2 font-medium">Prazo</th>
                <th className="px-3 py-2 font-medium">Prioridade</th>
                <th className="px-3 py-2 font-medium">Prova</th>
                <th className="px-3 py-2 text-right font-medium">Apont.</th>
                <th className="px-3 py-2 font-medium">Atividade</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visiveis.map((i) => {
                const prova = linkProva(i)
                const publicar = linkPublicarAprovacao(i)
                return (
                  <tr key={chave(i)} className={cn(i.em_espera && 'bg-[#FAFAFA] text-muted-foreground', selecionados.has(chave(i)) && 'bg-sky-50')}>
                    {podeGerir ? (
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selecionados.has(chave(i))} onChange={() => alternar(i)} aria-label={`Selecionar ${i.nome}`} />
                      </td>
                    ) : null}
                    <td className="max-w-[220px] px-3 py-2.5">
                      <p className="truncate font-medium text-foreground">
                        {i.numero ? <span className="text-muted-foreground">#{i.numero} </span> : null}
                        {i.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {i.tipo === 'projeto' ? 'Projeto' : 'Avulso'}
                        {i.em_espera ? ` · Em espera${i.em_espera_motivo ? `: ${i.em_espera_motivo}` : ''}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', ETAPA_COR[i.etapa])}>{ETAPA_LABEL[i.etapa]}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {podeGerir ? (
                        <select
                          className={cn(SELECT, 'h-8 max-w-[160px]')}
                          value={i.responsavel_id ?? ''}
                          disabled={pendente}
                          aria-label={`Responsável por ${i.nome}`}
                          onChange={(e) => {
                            const novo = e.target.value || null
                            executar(() => atribuirDiagramacao([ref(i)], novo), novo ? `Atribuído a ${nomeDe(novo) ?? 'responsável'}.` : 'Atribuição removida.')
                          }}
                        >
                          <option value="">Sem responsável</option>
                          {/* Responsável inativo continua aparecendo até ser trocado. */}
                          {i.responsavel_id && !equipe.some((m) => m.id === i.responsavel_id) ? (
                            <option value={i.responsavel_id}>{i.responsavel_nome ?? 'Inativo'}</option>
                          ) : null}
                          {equipe.map((m) => (
                            <option key={m.id} value={m.id}>{m.nome}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{i.responsavel_nome ?? <span className="text-muted-foreground">—</span>}</span>
                      )}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5">{origemDoItem(i)}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        disabled={!podeGerir}
                        onClick={() => setPrazoDe(i)}
                        className={cn(
                          'inline-flex items-center gap-1 whitespace-nowrap rounded-md text-left text-xs',
                          podeGerir && 'hover:underline',
                          i.atrasado ? 'font-semibold text-destructive' : 'text-[#444444]',
                        )}
                        title={i.prazo ? new Date(i.prazo).toLocaleString('pt-BR') : undefined}
                      >
                        {i.atrasado ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : <CalendarClock className="h-3.5 w-3.5" aria-hidden />}
                        {descreverPrazo(i.prazo)}
                      </button>
                      {i.cliente_atrasado ? <p className="text-[11px] text-destructive">Cliente: {descreverPrazo(i.prazo_cliente).toLowerCase()}</p> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      {podeGerir ? (
                        <select
                          className={cn(SELECT, 'h-8')}
                          value={i.prioridade}
                          disabled={pendente}
                          aria-label={`Prioridade de ${i.nome}`}
                          onChange={(e) => {
                            const p = e.target.value as PrioridadeDiagramacao
                            executar(() => definirPrioridadeDiagramacao([ref(i)], p), `Prioridade: ${PRIORIDADE_LABEL[p]}.`)
                          }}
                        >
                          {PRIORIDADES.map((p) => (
                            <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', PRIORIDADE_COR[i.prioridade])}>{PRIORIDADE_LABEL[i.prioridade]}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">{i.versao_atual ? `V${i.versao_atual}` : '—'}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', i.apontamentos_abertos > 0 && 'font-semibold text-red-700')}>{i.apontamentos_abertos}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{haQuanto(i.ultima_atividade)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <AcaoLink href={linkEditor(i)} rotulo="Abrir editor" icone={<PenTool className="h-4 w-4" aria-hidden />} />
                        {prova ? (
                          <AcaoLink href={prova} novaAba={i.tipo === 'avulso'} rotulo="Ver prova" icone={<Eye className="h-4 w-4" aria-hidden />} />
                        ) : null}
                        {i.tipo === 'avulso' && i.aprovacao_token ? (
                          <AcaoBotao rotulo="Copiar link de aprovação" onClick={() => copiarLink(i.aprovacao_token!)} icone={<Copy className="h-4 w-4" aria-hidden />} />
                        ) : publicar ? (
                          <AcaoLink href={publicar} rotulo="Publicar link de aprovação" icone={<Link2 className="h-4 w-4" aria-hidden />} />
                        ) : null}
                        {podeGerir && i.etapa !== 'aprovado' ? (
                          i.em_espera ? (
                            <AcaoBotao
                              rotulo="Retomar"
                              onClick={() => executar(() => definirEsperaDiagramacao(ref(i), false), 'Diagramação retomada.')}
                              icone={<Play className="h-4 w-4" aria-hidden />}
                            />
                          ) : (
                            <AcaoBotao rotulo="Pôr em espera" onClick={() => setEsperaDe(i)} icone={<Pause className="h-4 w-4" aria-hidden />} />
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Quadro itens={visiveis} />
      )}

      <PrazoModal
        item={prazoDe}
        pendente={pendente}
        onClose={() => setPrazoDe(null)}
        onSalvar={(item, dia) => executar(() => definirPrazoDiagramacao(ref(item), dia), 'Prazo atualizado.', () => setPrazoDe(null))}
      />
      <EsperaModal
        item={esperaDe}
        pendente={pendente}
        onClose={() => setEsperaDe(null)}
        onSalvar={(item, motivo) => executar(() => definirEsperaDiagramacao(ref(item), true, motivo), 'Diagramação em espera.', () => setEsperaDe(null))}
      />
    </div>
  )
}

function Filtro({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {rotulo}
      {children}
    </label>
  )
}

const ACAO = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[#444444] hover:bg-[#F5F5F5] hover:text-[#171717]'

function AcaoLink({ href, rotulo, icone, novaAba = false }: { href: string; rotulo: string; icone: React.ReactNode; novaAba?: boolean }) {
  return (
    <Link href={href} title={rotulo} aria-label={rotulo} className={ACAO} target={novaAba ? '_blank' : undefined}>
      {icone}
    </Link>
  )
}

function AcaoBotao({ rotulo, icone, onClick }: { rotulo: string; icone: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" title={rotulo} aria-label={rotulo} className={ACAO} onClick={onClick}>
      {icone}
    </button>
  )
}

/** Quadro por etapa: mesma lista filtrada, em colunas. */
function Quadro({ itens }: { itens: DiagramacaoItemRow[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {ETAPAS_DIAGRAMACAO.map((etapa) => {
        const daEtapa = itens.filter((i) => i.etapa === etapa)
        return (
          <section key={etapa} aria-label={ETAPA_LABEL[etapa]} className="rounded-2xl bg-[#FAFAFA] p-3">
            <h2 className="flex items-center justify-between text-sm font-semibold">
              {ETAPA_LABEL[etapa]}
              <span className="rounded-full bg-white px-2 text-xs tabular-nums text-muted-foreground">{daEtapa.length}</span>
            </h2>
            <ul className="mt-3 space-y-2">
              {daEtapa.map((i) => {
                const prova = linkProva(i)
                return (
                  <li key={chave(i)} className={cn('rounded-xl border bg-white p-3 text-sm', i.atrasado && 'border-destructive/40')}>
                    <p className="font-medium leading-snug">
                      {i.numero ? <span className="text-muted-foreground">#{i.numero} </span> : null}
                      {i.nome}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{origemDoItem(i)}</p>
                    <p className="mt-0.5 text-xs">{i.responsavel_nome ?? <span className="text-muted-foreground">Sem responsável</span>}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {i.prioridade !== 'normal' ? (
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', PRIORIDADE_COR[i.prioridade])}>{PRIORIDADE_LABEL[i.prioridade]}</span>
                      ) : null}
                      {i.em_espera ? <span className="rounded-full bg-[#EAEAEA] px-2 py-0.5 text-[10px] font-semibold">Em espera</span> : null}
                      {i.apontamentos_abertos > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">{i.apontamentos_abertos} apont.</span>
                      ) : null}
                    </div>
                    <p className={cn('mt-2 text-xs', i.atrasado ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{descreverPrazo(i.prazo)}</p>
                    <div className="mt-2 flex gap-1">
                      <AcaoLink href={linkEditor(i)} rotulo="Abrir editor" icone={<PenTool className="h-4 w-4" aria-hidden />} />
                      {prova ? <AcaoLink href={prova} novaAba={i.tipo === 'avulso'} rotulo="Ver prova" icone={<Eye className="h-4 w-4" aria-hidden />} /> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function PrazoModal({
  item,
  pendente,
  onClose,
  onSalvar,
}: {
  item: DiagramacaoItemRow | null
  pendente: boolean
  onClose: () => void
  onSalvar: (item: DiagramacaoItemRow, dia: string | null) => void
}) {
  return (
    <Modal open={Boolean(item)} onClose={onClose} title="Prazo da diagramação">
      {item ? <FormPrazo key={chave(item)} item={item} pendente={pendente} onClose={onClose} onSalvar={onSalvar} /> : null}
    </Modal>
  )
}

function FormPrazo({
  item,
  pendente,
  onClose,
  onSalvar,
}: {
  item: DiagramacaoItemRow
  pendente: boolean
  onClose: () => void
  onSalvar: (item: DiagramacaoItemRow, dia: string | null) => void
}) {
  const [dia, setDia] = useState(diaDoPrazo(item.prazo))
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSalvar(item, dia || null)
      }}
    >
      <p className="text-sm text-muted-foreground">
        {item.nome}
        {item.tipo === 'projeto' ? ' — SLA interno da equipe (o prazo de aprovação do cliente não muda).' : ''}
      </p>
      <div>
        <Label htmlFor="prazo-dia">Entregar até</Label>
        <Input id="prazo-dia" type="date" className="mt-1" value={dia} onChange={(e) => setDia(e.target.value)} required={item.tipo === 'projeto'} />
      </div>
      <div className={MODAL_ACOES}>
        {item.tipo === 'avulso' && item.prazo ? (
          <Button type="button" variant="ghost" disabled={pendente} onClick={() => onSalvar(item, null)}>
            Remover prazo
          </Button>
        ) : null}
        <Button type="button" variant="brandOutline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="brand" disabled={pendente || (item.tipo === 'projeto' && !dia)}>
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Salvar prazo
        </Button>
      </div>
    </form>
  )
}

function EsperaModal({
  item,
  pendente,
  onClose,
  onSalvar,
}: {
  item: DiagramacaoItemRow | null
  pendente: boolean
  onClose: () => void
  onSalvar: (item: DiagramacaoItemRow, motivo: string) => void
}) {
  return (
    <Modal open={Boolean(item)} onClose={onClose} title="Pôr em espera">
      {item ? <FormEspera key={chave(item)} item={item} pendente={pendente} onClose={onClose} onSalvar={onSalvar} /> : null}
    </Modal>
  )
}

function FormEspera({
  item,
  pendente,
  onClose,
  onSalvar,
}: {
  item: DiagramacaoItemRow
  pendente: boolean
  onClose: () => void
  onSalvar: (item: DiagramacaoItemRow, motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSalvar(item, motivo)
      }}
    >
      <p className="text-sm text-muted-foreground">
        {item.nome} sai da lista de urgentes e não conta como atrasado enquanto estiver em espera.
      </p>
      <div>
        <Label htmlFor="motivo-espera">Motivo (opcional)</Label>
        <Input
          id="motivo-espera"
          className="mt-1"
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: aguardando fotos extras do estúdio"
        />
      </div>
      <div className={MODAL_ACOES}>
        <Button type="button" variant="brandOutline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="brand" disabled={pendente}>
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Pôr em espera
        </Button>
      </div>
    </form>
  )
}
