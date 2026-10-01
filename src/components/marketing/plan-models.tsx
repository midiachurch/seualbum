import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatBRL } from '@/lib/utils'
import { PLAN_FAMILY_ORDER, planFamily } from '@/lib/pricing'
import type { Plan } from '@/types/database'

// -----------------------------------------------------------------------------
// Derivações do catálogo
// -----------------------------------------------------------------------------

/** Tudo o que a página promete sai daqui — nenhum número fica escrito à mão. */
function resumoDoCatalogo(plans: Plan[]) {
  const ordenar = (lista: Plan[]) =>
    [...lista].sort(
      (a, b) =>
        a.ordem - b.ordem ||
        PLAN_FAMILY_ORDER.indexOf(planFamily(a)) - PLAN_FAMILY_ORDER.indexOf(planFamily(b)),
    )
  const avulsos = ordenar(plans.filter((p) => p.tipo_cobranca === 'avulso'))
  const assinaturas = ordenar(plans.filter((p) => p.tipo_cobranca === 'assinatura'))

  const min = (valores: number[]) => (valores.length > 0 ? Math.min(...valores) : null)
  const max = (valores: number[]) => (valores.length > 0 ? Math.max(...valores) : null)

  const comCota = assinaturas.filter((p) => (p.albuns_inclusos ?? 0) > 0)

  return {
    avulsos,
    assinaturas,
    menorAvulso: min(avulsos.map((p) => p.preco)),
    menorAssinatura: min(assinaturas.map((p) => p.preco)),
    menorCustoPorAlbum: min(comCota.map((p) => p.preco / (p.albuns_inclusos as number))),
    maiorCota: max(comCota.map((p) => p.albuns_inclusos as number)),
    prazoAvulso: faixa(avulsos.map((p) => p.prazo_dias)),
    prazoAssinatura: faixa(assinaturas.map((p) => p.prazo_dias)),
    revisoesAvulso: faixa(avulsos.map((p) => p.revisoes_inclusas)),
    revisoesAssinatura: faixa(assinaturas.map((p) => p.revisoes_inclusas)),
  }
}

function faixa(valores: number[]) {
  if (valores.length === 0) return null
  return { min: Math.min(...valores), max: Math.max(...valores) }
}

function textoFaixa(f: { min: number; max: number } | null, unidade: string) {
  if (!f) return '—'
  return f.min === f.max ? `${f.min} ${unidade}` : `${f.min} a ${f.max} ${unidade}`
}

/** Plano de assinatura que abre o cadastro: o destacado no catálogo, senão o primeiro. */
function assinaturaPadrao(assinaturas: Plan[]) {
  return assinaturas.find((p) => p.destaque) ?? assinaturas[0]
}

// -----------------------------------------------------------------------------
// Avulso × Assinatura
// -----------------------------------------------------------------------------

interface ModeloProps {
  plans: Plan[]
}

/**
 * Os dois jeitos de contratar, lado a lado. O ponto que mais gera dúvida — o
 * assinante não passa pelo checkout — aparece no fluxo de cada modelo, não
 * escondido numa nota de rodapé.
 */
export function PlanModels({ plans }: ModeloProps) {
  const r = resumoDoCatalogo(plans)
  const assinaturaCta = assinaturaPadrao(r.assinaturas)

  const linhas: { label: string; avulso: string; assinatura: string }[] = [
    {
      label: 'Como você paga',
      avulso: 'Por álbum, via Pix ou cartão no checkout',
      assinatura: 'Mensalidade fixa do estúdio',
    },
    {
      label: 'Álbuns',
      avulso: 'Um por pedido, quantos quiser',
      assinatura: r.maiorCota ? `Cota mensal de até ${r.maiorCota} álbuns, conforme o plano` : 'Cota mensal conforme o plano',
    },
    {
      label: 'Checkout a cada pedido',
      avulso: 'Sim — o pedido entra na fila após o pagamento',
      assinatura: 'Não — o pedido vai direto para a fila de diagramação',
    },
    {
      label: 'Prazo de entrega',
      avulso: textoFaixa(r.prazoAvulso, 'dias úteis'),
      assinatura: textoFaixa(r.prazoAssinatura, 'dias úteis'),
    },
    {
      label: 'Rodadas de revisão',
      avulso: textoFaixa(r.revisoesAvulso, 'por álbum'),
      assinatura: textoFaixa(r.revisoesAssinatura, 'por álbum'),
    },
  ]

  return (
    <section id="modelos" className="font-marketing bg-white py-20 sm:py-28">
      <div className="container">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-overline text-[#595959]">Duas formas de contratar</p>
          <h2 className="text-display-l mt-4 text-balance text-[#444444]">Um álbum hoje, ou todos os álbuns do mês</h2>
          <p className="text-body mt-4 text-[#595959]">
            O serviço é o mesmo nos dois modelos: diagramação white label, prova online e arquivo pronto
            para a gráfica. Muda só a forma de pagar — e a agilidade para colocar o pedido na fila.
          </p>
        </header>

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-2">
          {/* Avulso */}
          <article className="flex flex-col border border-[#EAEAEA] bg-white p-8 sm:p-10">
            <p className="text-overline text-[#595959]">Plano avulso</p>
            <h3 className="text-display-l mt-3 text-[#444444]">Pague por álbum</h3>
            <p className="text-body mt-3 text-[#595959]">
              Para quem entrega álbuns de vez em quando e prefere pagar só quando tem trabalho.
            </p>
            {r.menorAvulso !== null ? (
              <p className="mt-8 text-[#444444]">
                <span className="text-caption block text-[#595959]">a partir de</span>
                <span className="font-[family-name:var(--font-poppins)] text-4xl font-light">
                  {formatBRL(r.menorAvulso)}
                </span>
                <span className="text-caption text-[#595959]"> /álbum</span>
              </p>
            ) : null}

            <ol className="mt-8 space-y-4 border-t border-[#EAEAEA] pt-8">
              {[
                'Escolha o plano ao criar o pedido',
                'Pague via Pix ou cartão no checkout',
                'O pedido entra na fila de diagramação',
              ].map((passo, index) => (
                <li key={passo} className="text-body flex items-start gap-4 text-[#444444]">
                  <span className="font-[family-name:var(--font-poppins)] text-sm text-[#595959]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {passo}
                </li>
              ))}
            </ol>

            <div className="mt-auto pt-10">
              <Button
                asChild
                size="lg"
                className="btn-marketing w-full border-2 border-[#444444]/40 bg-transparent text-[#444444] hover:border-[#444444] hover:bg-transparent"
              >
                <Link href="/dashboard/novo-pedido">Pedir um álbum avulso</Link>
              </Button>
            </div>
          </article>

          {/* Assinatura */}
          <article className="flex flex-col bg-[#171717] p-8 text-white sm:p-10">
            <p className="text-overline text-white/70">Assinatura mensal</p>
            <h3 className="text-display-l mt-3">Para estúdios com agenda cheia</h3>
            <p className="text-body mt-3 text-white/80">
              Uma cota de álbuns por mês, custo menor por entrega e pedidos que não param no pagamento.
            </p>
            {r.menorAssinatura !== null ? (
              <p className="mt-8">
                <span className="text-caption block text-white/70">a partir de</span>
                <span className="font-[family-name:var(--font-poppins)] text-4xl font-light">
                  {formatBRL(r.menorAssinatura)}
                </span>
                <span className="text-caption text-white/70"> /mês</span>
                {r.menorCustoPorAlbum !== null ? (
                  <span className="text-caption mt-1 block text-white/70">
                    custo por álbum a partir de {formatBRL(r.menorCustoPorAlbum)}
                  </span>
                ) : null}
              </p>
            ) : null}

            <ol className="mt-8 space-y-4 border-t border-white/15 pt-8">
              {[
                'Assine o plano do seu estúdio',
                'Crie pedidos sem passar pelo checkout',
                'Vai direto para a fila — com prazo menor nos planos maiores',
              ].map((passo, index) => (
                <li key={passo} className="text-body flex items-start gap-4 text-white">
                  <span className="font-[family-name:var(--font-poppins)] text-sm text-white/60">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {passo}
                </li>
              ))}
            </ol>

            <div className="mt-auto pt-10">
              <Button
                asChild
                size="lg"
                className="btn-marketing w-full border-2 border-white bg-white text-[#171717] hover:bg-[#EAEAEA]"
              >
                <Link href={assinaturaCta ? `/auth/register?plano=${assinaturaCta.slug}` : '/auth/register'}>
                  Assinar para o meu estúdio
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </article>
        </div>

        {/* Lado a lado — no celular cada critério vira um bloco com as duas respostas. */}
        <dl className="mx-auto mt-16 max-w-5xl border-t border-[#EAEAEA]">
          <div className="hidden grid-cols-[1fr_1.2fr_1.2fr] gap-6 border-b border-[#EAEAEA] py-4 sm:grid">
            <span className="text-overline text-[#595959]">Lado a lado</span>
            <span className="text-overline text-[#595959]">Avulso</span>
            <span className="text-overline text-[#595959]">Assinatura</span>
          </div>
          {linhas.map((linha) => (
            <div
              key={linha.label}
              className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-[#EAEAEA] py-5 sm:grid-cols-[1fr_1.2fr_1.2fr]"
            >
              <dt className="col-span-2 text-sm font-semibold text-[#444444] sm:col-span-1">{linha.label}</dt>
              <dd className="text-body text-[#595959]">
                <span className="text-overline mb-1 block text-[#595959] sm:hidden">Avulso</span>
                {linha.avulso}
              </dd>
              <dd className="text-body text-[#444444]">
                <span className="text-overline mb-1 block text-[#595959] sm:hidden">Assinatura</span>
                {linha.assinatura}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------------
// Faça as contas
// -----------------------------------------------------------------------------

interface Simulacao {
  assinatura: Plan
  avulso: Plan
  volume: number
  custoAvulso: number
  economia: number
  percentual: number
  porAlbum: number
  /** Menor volume mensal a partir do qual a assinatura sai mais barata. */
  compensaAPartirDe: number
}

/**
 * Compara cada assinatura com o avulso da mesma família, supondo que o estúdio
 * usa a cota inteira do mês. Só entra na lista quando a assinatura realmente
 * economiza — a página não inventa vantagem que o catálogo não sustenta.
 */
function simular(plans: Plan[]): Simulacao[] {
  const { avulsos, assinaturas } = resumoDoCatalogo(plans)

  return assinaturas.flatMap((assinatura) => {
    const volume = assinatura.albuns_inclusos ?? 0
    const avulso = avulsos.find((p) => planFamily(p) === planFamily(assinatura))
    if (!avulso || volume <= 0 || avulso.preco <= 0) return []

    const custoAvulso = volume * avulso.preco
    const economia = custoAvulso - assinatura.preco
    if (economia <= 0) return []

    return [
      {
        assinatura,
        avulso,
        volume,
        custoAvulso,
        economia,
        percentual: Math.round((economia / custoAvulso) * 100),
        porAlbum: assinatura.preco / volume,
        compensaAPartirDe: Math.floor(assinatura.preco / avulso.preco) + 1,
      },
    ]
  })
}

export function SubscriptionMath({ plans }: ModeloProps) {
  const simulacoes = simular(plans)
  if (simulacoes.length === 0) return null

  // O exemplo principal usa o plano em destaque; os demais ficam como apoio.
  const principal = simulacoes.find((s) => s.assinatura.destaque) ?? simulacoes[0]

  return (
    <section id="faca-as-contas" className="font-marketing bg-white py-20 sm:py-28">
      <div className="container grid gap-12 lg:grid-cols-12 lg:gap-8">
        <header className="lg:col-span-4">
          <p className="text-overline text-[#595959]">Faça as contas</p>
          <h2 className="text-display-l mt-4 text-balance text-[#444444]">
            Quando a assinatura passa a valer a pena
          </h2>
          <p className="text-body mt-4 text-[#595959]">
            Se você entrega {principal.volume} álbuns por mês no padrão {principal.avulso.nome_plano}, pagar
            um a um custa {formatBRL(principal.custoAvulso)}. Na assinatura, o mesmo mês sai por{' '}
            {formatBRL(principal.assinatura.preco)} — {formatBRL(principal.economia)} a menos.
          </p>
          <p className="text-caption mt-4 text-[#595959]">
            Cálculo com os preços atuais do catálogo, considerando a cota mensal inteira utilizada.
          </p>
        </header>

        <ul className="grid gap-px overflow-hidden border border-[#EAEAEA] bg-[#EAEAEA] lg:col-span-7 lg:col-start-6">
          {simulacoes.map((s) => (
            <li
              key={s.assinatura.id}
              className={cn('bg-white p-6 sm:p-8', s === principal && 'ring-2 ring-inset ring-[#171717]')}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-heading text-[#444444]">{s.assinatura.nome_plano}</h3>
                <span className="text-caption text-[#595959]">
                  {s.volume} álbuns por mês · entrega em {s.assinatura.prazo_dias} dias úteis
                </span>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-caption text-[#595959]">Avulso</dt>
                  <dd className="mt-1 text-sm text-[#595959] line-through decoration-[#595959]/50">
                    {formatBRL(s.custoAvulso)}
                  </dd>
                  <dd className="text-caption text-[#595959]">
                    {s.volume} × {formatBRL(s.avulso.preco)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-[#595959]">Assinatura</dt>
                  <dd className="mt-1 font-[family-name:var(--font-poppins)] text-xl font-light text-[#444444]">
                    {formatBRL(s.assinatura.preco)}
                  </dd>
                  <dd className="text-caption text-[#595959]">{formatBRL(s.porAlbum)} por álbum</dd>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <dt className="text-caption text-[#595959]">Você economiza</dt>
                  <dd className="mt-1 font-[family-name:var(--font-poppins)] text-xl font-light text-[#171717]">
                    {formatBRL(s.economia)}
                    <span className="text-caption text-[#595959]"> /mês ({s.percentual}%)</span>
                  </dd>
                </div>
              </dl>

              {s.compensaAPartirDe <= s.volume ? (
                <p className="text-body mt-5 flex items-start gap-2 text-[#444444]">
                  <Check className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Compensa a partir de {s.compensaAPartirDe} {s.compensaAPartirDe === 1 ? 'álbum' : 'álbuns'} por mês.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
