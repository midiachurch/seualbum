'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Eye, FolderOpen, Layers, MapPin, Upload, UserRound } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { SlaBadge } from '@/components/admin/production/sla-badge'
import { LaminasUpload } from '@/components/admin/projects/laminas-upload'
import type { FormatoAlbum } from '@/lib/resolucao'
import { cn } from '@/lib/utils'
import { PROJECT_STATUS_LABEL, type ProjectStatus } from '@/types/platform'

export type ColunaDesign = 'diagramar' | 'ajustes' | 'revisao' | 'cliente'

export type CartaoDesign = {
  id: string
  numero: number
  nome: string
  status: ProjectStatus
  coluna: ColunaDesign
  estudio: string | null
  meu: boolean
  semResponsavel: boolean
  dataLimiteProducao: string
  dataLimiteAprovacao: string | null
  fotos: number
  ultimaVersao: { numero: number; laminas: number; status: string } | null
  /** Franquia de lâminas do plano — só a contagem; preço é assunto comercial. */
  laminasInclusas: number | null
  pinsPendentes: number
  /** Formato do álbum: o upload checa a resolução de impressão das lâminas. */
  album: FormatoAlbum | null
}

const COLUNAS: { chave: ColunaDesign; titulo: string; dica: string }[] = [
  { chave: 'diagramar', titulo: 'A diagramar', dica: 'Fotos recebidas — primeira versão' },
  { chave: 'ajustes', titulo: 'Ajustes pedidos', dica: 'Resolva os pins e suba a próxima versão' },
  { chave: 'revisao', titulo: 'Em revisão interna', dica: 'Aguardando o gestor aprovar' },
  { chave: 'cliente', titulo: 'Com o cliente', dica: 'Prova liberada, aguardando decisão' },
]

/** Colunas em que o designer deve uma versão nova. */
const PODE_SUBIR: ColunaDesign[] = ['diagramar', 'ajustes']

export function DesignQueue({
  cartoes,
  podeSubir,
  subirInicial,
}: {
  cartoes: CartaoDesign[]
  podeSubir: boolean
  subirInicial: string | null
}) {
  const router = useRouter()
  const [soMeus, setSoMeus] = useState(false)
  const [subindo, setSubindo] = useState<string | null>(podeSubir ? subirInicial : null)
  const [enviado, setEnviado] = useState<{ nome: string; numero: number } | null>(null)

  const visiveis = soMeus ? cartoes.filter((c) => c.meu) : cartoes
  const projetoSubindo = cartoes.find((c) => c.id === subindo) ?? null
  const temMeus = cartoes.some((c) => c.meu)

  function fecharUpload() {
    setSubindo(null)
    // Veio do "Finalizar atualizações" da prova: limpa o ?subir= da URL.
    if (subirInicial) router.replace('/admin/design', { scroll: false })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Fila de design</h1>
          <p className="text-sm text-muted-foreground">
            O que precisa de diagramação agora — abra as lâminas para ver os pins e suba a próxima versão.
          </p>
        </div>
        {temMeus ? (
          <div role="group" aria-label="Filtrar projetos" className="flex rounded-xl border bg-card p-1 text-sm">
            {[
              { valor: false, rotulo: 'Todos' },
              { valor: true, rotulo: 'Atribuídos a mim' },
            ].map((op) => (
              <button
                key={op.rotulo}
                type="button"
                aria-pressed={soMeus === op.valor}
                onClick={() => setSoMeus(op.valor)}
                className={cn(
                  'min-h-[40px] rounded-lg px-3 font-medium transition-colors',
                  soMeus === op.valor ? 'bg-[#171717] text-white' : 'text-[#595959] hover:bg-[#F5F5F5]',
                )}
              >
                {op.rotulo}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {enviado ? (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            Versão {enviado.numero} de &quot;{enviado.nome}&quot; enviada para revisão interna. Assim que o gestor aprovar, o
            fotógrafo recebe o aviso &quot;Nova versão disponível para aprovação&quot;.
          </span>
        </p>
      ) : null}

      {visiveis.length === 0 ? (
        <EmptyState title="Nada na fila" description="Nenhum projeto precisa de diagramação agora." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((coluna) => {
            const itens = visiveis.filter((c) => c.coluna === coluna.chave)
            return (
              <section key={coluna.chave} aria-labelledby={`coluna-${coluna.chave}`} className="min-w-0 rounded-2xl bg-[#F5F5F5] p-3">
                <div className="mb-3 px-1">
                  <h2 id={`coluna-${coluna.chave}`} className="flex items-center justify-between gap-2 text-sm font-semibold">
                    {coluna.titulo}
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-[#595959]">{itens.length}</span>
                  </h2>
                  <p className="text-xs text-[#595959]">{coluna.dica}</p>
                </div>
                {itens.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#DDDDDD] p-4 text-center text-xs text-[#595959]">Vazio</p>
                ) : (
                  <ul className="space-y-3">
                    {itens.map((c) => (
                      <li key={c.id}>
                        <Cartao
                          cartao={c}
                          podeSubir={podeSubir && PODE_SUBIR.includes(c.coluna)}
                          onSubir={() => {
                            setEnviado(null)
                            setSubindo(c.id)
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      <Modal
        open={projetoSubindo !== null}
        onClose={fecharUpload}
        title={projetoSubindo ? `Subir versão ${(projetoSubindo.ultimaVersao?.numero ?? 0) + 1}` : undefined}
        className="max-w-2xl"
      >
        {projetoSubindo ? (
          <div className="space-y-4">
            <p className="break-words text-sm text-[#595959]">
              <span className="font-medium text-[#171717]">{projetoSubindo.nome}</span>
              {projetoSubindo.pinsPendentes > 0 ? (
                <>
                  {' '}
                  — ainda há <strong className="text-[#171717]">{projetoSubindo.pinsPendentes}</strong>{' '}
                  {projetoSubindo.pinsPendentes === 1 ? 'apontamento aberto' : 'apontamentos abertos'} na versão{' '}
                  {projetoSubindo.ultimaVersao?.numero}. Ao subir,{' '}
                  {projetoSubindo.pinsPendentes === 1 ? 'ele conta como aplicado.' : 'eles contam como aplicados.'}
                </>
              ) : null}
            </p>
            <LaminasUpload
              projetoId={projetoSubindo.id}
              album={projetoSubindo.album}
              onCancelar={fecharUpload}
              onConcluido={(v) => {
                setEnviado({ nome: projetoSubindo.nome, numero: v.numero })
                fecharUpload()
                router.refresh()
              }}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function Cartao({ cartao: c, podeSubir, onSubir }: { cartao: CartaoDesign; podeSubir: boolean; onSubir: () => void }) {
  const temLaminas = (c.ultimaVersao?.laminas ?? 0) > 0
  return (
    <article className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-[#595959]">#{c.numero}</span>
        {c.meu ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-2 py-0.5 text-[11px] font-semibold text-white">
            <UserRound className="h-3 w-3" aria-hidden />
            Seu
          </span>
        ) : c.semResponsavel ? (
          <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-medium text-[#595959]">Sem responsável</span>
        ) : null}
        <SlaBadge project={c} />
      </div>

      <h3 className="mt-2 break-words text-sm font-semibold leading-snug">
        <Link href={`/admin/projetos/${c.id}`} className="hover:underline">
          {c.nome}
        </Link>
      </h3>
      {c.estudio ? <p className="break-words text-xs text-[#595959]">{c.estudio}</p> : null}

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#595959]">
        <div className="flex items-center gap-1">
          <dt className="sr-only">Status</dt>
          <dd>{PROJECT_STATUS_LABEL[c.status]}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="sr-only">Versão atual</dt>
          <Layers className="h-3.5 w-3.5" aria-hidden />
          <dd>{c.ultimaVersao ? `V${c.ultimaVersao.numero} · ${c.ultimaVersao.laminas} lâminas` : 'Sem versões'}</dd>
        </div>
        {c.laminasInclusas !== null ? (
          <div
            className={cn(
              'flex items-center gap-1',
              c.ultimaVersao && c.ultimaVersao.laminas > c.laminasInclusas && 'font-semibold text-amber-700',
            )}
          >
            <dt className="sr-only">Lâminas do plano</dt>
            <dd>
              plano: {c.laminasInclusas}
              {c.ultimaVersao && c.ultimaVersao.laminas > c.laminasInclusas
                ? ` (+${c.ultimaVersao.laminas - c.laminasInclusas} extras)`
                : ''}
            </dd>
          </div>
        ) : null}
        {c.pinsPendentes > 0 ? (
          <div className="flex items-center gap-1 font-semibold text-amber-700">
            <dt className="sr-only">Pins pendentes</dt>
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            <dd>
              {c.pinsPendentes} {c.pinsPendentes === 1 ? 'pin pendente' : 'pins pendentes'}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 grid gap-2">
        {podeSubir ? (
          <button
            type="button"
            onClick={onSubir}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#333333]"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Subir nova versão
          </button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {temLaminas ? (
            <Link
              href={`/admin/projetos/${c.id}/prova`}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DDDDDD] px-2 text-center text-xs font-semibold hover:bg-[#F5F5F5]"
            >
              <Eye className="h-4 w-4 shrink-0" aria-hidden />
              Lâminas e pins
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-dashed border-[#DDDDDD] px-2 text-center text-xs text-[#595959]">
              Sem lâminas
            </span>
          )}
          <Link
            href={`/admin/projetos/${c.id}`}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DDDDDD] px-2 text-center text-xs font-semibold hover:bg-[#F5F5F5]"
          >
            <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
            Fotos e briefing
          </Link>
        </div>
      </div>
    </article>
  )
}
