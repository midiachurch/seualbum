import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Clock, ShieldCheck, Smartphone } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageHero } from '@/components/marketing/page-hero'
import { OrderSteps } from '@/components/marketing/order-steps'
import { EditorialSplit } from '@/components/marketing/editorial-split'
import { CtaButtons } from '@/components/marketing/cta-buttons'
import { Faq } from '@/components/marketing/faq'
import { CtaBand } from '@/components/marketing/cta-band'
import { getActivePlans } from '@/lib/supabase/queries'
import { FALLBACK_PLANS, PLAN_FAMILY_ORDER, planFamily } from '@/lib/pricing'

export const metadata: Metadata = {
  title: 'Como funciona',
  description:
    'Do envio das fotos pelo celular à prova online e ao arquivo pronto para a gráfica: veja cada etapa da diagramação do seu álbum.',
  alternates: { canonical: '/como-funciona' },
}

/** Os prazos exibidos vêm do catálogo; revalida junto com as demais páginas comerciais. */
export const revalidate = 3600

export default async function ComoFuncionaPage() {
  const dbPlans = await getActivePlans()
  const plans = dbPlans.length > 0 ? dbPlans : FALLBACK_PLANS

  // Prazos por plano, usando o avulso como referência (a assinatura segue a mesma família).
  const referencia = plans
    .filter((p) => p.tipo_cobranca === 'avulso')
    .sort((a, b) => PLAN_FAMILY_ORDER.indexOf(planFamily(a)) - PLAN_FAMILY_ORDER.indexOf(planFamily(b)))
  const menorPrazo = plans.length > 0 ? Math.min(...plans.map((p) => p.prazo_dias)) : null

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Como funciona"
          title="Do último clique ao álbum pronto para a gráfica."
          description="Você envia as fotos e o briefing. Nós diagramamos, você aprova online com o seu cliente e recebe o arquivo final — tudo com a sua marca, nunca a nossa."
          actions={[
            { href: '/dashboard/novo-pedido', label: 'Começar um pedido' },
            { href: '/auth/register', label: 'Criar conta do estúdio', variant: 'secondary' },
          ]}
          image="https://picsum.photos/seed/seualbum-processo/1200/1500"
          imageAlt="Fotógrafo revisando lâminas de um álbum sobre a mesa de trabalho"
          provas={[
            { icon: Smartphone, label: 'Envio direto do celular' },
            ...(menorPrazo !== null ? [{ icon: Clock, label: `Entrega a partir de ${menorPrazo} dias úteis` }] : []),
            { icon: ShieldCheck, label: 'Aprovação online' },
          ]}
        />

        <OrderSteps
          title="Um pedido completo em cinco passos"
          description="O mesmo roteiro que você encontra no painel do estúdio. Nada de planilha, e-mail perdido ou arquivo em anexo."
        />

        <EditorialSplit
          tone="gray"
          eyebrow="01 · Envio"
          title="As fotos saem do seu celular, sem cabo e sem pendrive."
          description="Selecione as imagens direto da galeria do telefone. Se a seleção for grande demais, cole o link de uma pasta do Google Drive ou do Dropbox."
          image="https://picsum.photos/seed/seualbum-envio/1200/900"
          imageAlt="Mãos segurando um celular com a galeria de fotos de um casamento"
          bullets={[
            'Upload direto da galeria do celular',
            'Ou um link do Google Drive ou Dropbox',
            'Briefing com estilo, fotos obrigatórias e observações',
          ]}
        />

        <EditorialSplit
          reverse
          eyebrow="02 · Prova online"
          title="Seu cliente aprova o álbum sem sair de casa."
          description="Quando a diagramação fica pronta, você recebe um link de prova com a sua marca para compartilhar com o cliente. Os ajustes voltam para a produção dentro das rodadas de revisão do seu plano."
          image="https://picsum.photos/seed/seualbum-prova/1200/900"
          imageAlt="Casal visualizando a prova de um álbum em um notebook"
          bullets={[
            'Link de aprovação white label',
            'Status do pedido acompanhado pelo painel',
            'Rodadas de revisão definidas pelo plano',
          ]}
        />

        <EditorialSplit
          tone="gray"
          eyebrow="03 · Entrega"
          title="Arquivo final pronto para a gráfica que você já usa."
          description="Com a prova aprovada, você baixa o arquivo final preparado para impressão e envia direto para o laboratório. Sem retrabalho de exportação."
          image="https://picsum.photos/seed/seualbum-entrega/1200/900"
          imageAlt="Álbum fotográfico impresso aberto sobre uma mesa clara"
        >
          <CtaButtons actions={[{ href: '/dashboard/novo-pedido', label: 'Enviar meu primeiro álbum' }]} />
        </EditorialSplit>

        {referencia.length > 0 ? (
          <section className="font-marketing bg-white py-20 sm:py-28">
            <div className="container">
              <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-overline text-[#595959]">Prazos</p>
                  <h2 className="text-display-l mt-4 text-[#444444]">Quanto tempo leva</h2>
                  <p className="text-body mt-4 text-[#595959]">
                    O prazo conta em dias úteis, a partir da confirmação do briefing e do acesso às fotos.
                  </p>
                </div>
                <Link
                  href="/precos"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[#444444] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#444444]"
                >
                  Ver planos e preços
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </header>

              <ul className="mt-12 grid gap-px overflow-hidden border border-[#EAEAEA] bg-[#EAEAEA] sm:grid-cols-3">
                {referencia.map((plan) => (
                  <li key={plan.id} className="bg-white p-8">
                    <p className="text-heading text-[#444444]">{plan.nome_plano}</p>
                    <p className="mt-4 font-[family-name:var(--font-poppins)] text-5xl font-light leading-none text-[#444444]">
                      {plan.prazo_dias}
                      <span className="text-caption ml-2 align-middle text-[#595959]">dias úteis</span>
                    </p>
                    <p className="text-body mt-4 text-[#595959]">
                      {plan.revisoes_inclusas} {plan.revisoes_inclusas === 1 ? 'rodada' : 'rodadas'} de revisão
                      inclusas
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <Faq />

        <CtaBand
          eyebrow="Pronto para começar"
          title="Seu próximo álbum pode entrar na fila ainda hoje."
          description="Crie a conta do estúdio, abra um pedido e envie as fotos direto do celular."
          actions={[
            { href: '/dashboard/novo-pedido', label: 'Começar um pedido' },
            { href: '/auth/register', label: 'Criar conta', variant: 'secondary' },
          ]}
          image="https://picsum.photos/seed/seualbum-como-cta/1600/900"
        />
      </main>
      <SiteFooter />
    </div>
  )
}
