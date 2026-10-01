import type { Metadata } from 'next'
import { BadgeCheck, Eye, LayoutTemplate, Printer, RefreshCcw, Smartphone } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageHero } from '@/components/marketing/page-hero'
import { ValuePillars, type ValuePillar } from '@/components/marketing/value-pillars'
import { DesignStyles } from '@/components/marketing/design-styles'
import { EditorialSplit } from '@/components/marketing/editorial-split'
import { CtaButtons } from '@/components/marketing/cta-buttons'
import { CtaBand } from '@/components/marketing/cta-band'

export const metadata: Metadata = {
  title: 'Serviços',
  description:
    'Diagramação white label de álbuns fotográficos em cinco estilos, com prova online para o cliente, rodadas de revisão e arquivo pronto para a gráfica.',
  alternates: { canonical: '/servicos' },
}

const SERVICOS: ValuePillar[] = [
  {
    icon: LayoutTemplate,
    titulo: 'Diagramação de álbuns',
    texto: 'Sequência narrativa, ritmo entre lâminas e composição pensada foto a foto, no estilo que você escolher.',
  },
  {
    icon: BadgeCheck,
    titulo: 'White label de ponta a ponta',
    texto: 'A prova, a comunicação e os arquivos saem com a sua marca. Seu cliente conhece só o seu estúdio.',
  },
  {
    icon: Eye,
    titulo: 'Prova online',
    texto: 'Um link de aprovação para o cliente folhear o álbum e aprovar sem reunião nem PDF por e-mail.',
  },
  {
    icon: RefreshCcw,
    titulo: 'Rodadas de revisão',
    texto: 'Ajustes inclusos em cada plano, registrados no pedido — sem ruído, sem versão perdida.',
  },
  {
    icon: Printer,
    titulo: 'Arquivo pronto para a gráfica',
    texto: 'Entrega preparada para impressão, pronta para seguir para o laboratório que você já usa.',
  },
  {
    icon: Smartphone,
    titulo: 'Envio pelo celular',
    texto: 'Suba as fotos direto da galeria do telefone ou mande um link do Google Drive ou Dropbox.',
  },
]

export default function ServicosPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Serviços"
          title="Diagramação autoral para fotógrafos que assinam cada entrega."
          description="Você fotografa e cuida do cliente. Nós transformamos a seleção em um álbum com narrativa, pronto para aprovação e impressão — sempre com a sua marca."
          actions={[
            { href: '/auth/register', label: 'Criar conta do estúdio' },
            { href: '/precos', label: 'Ver planos e preços', variant: 'secondary' },
          ]}
          image="https://picsum.photos/seed/seualbum-servicos/1200/1500"
          imageAlt="Lâminas de um álbum fotográfico diagramado dispostas sobre a mesa"
        />

        <ValuePillars
          eyebrow="O que entregamos"
          title="Tudo o que acontece entre a seleção e a gráfica"
          description="Um único serviço, desenhado para tirar a diagramação da sua agenda sem tirar o seu nome do trabalho."
          items={SERVICOS}
        />

        <DesignStyles />

        <EditorialSplit
          tone="gray"
          eyebrow="White label"
          title="O álbum é seu. A marca também."
          description="Não aparecemos na prova, nos arquivos nem na conversa com o seu cliente. Para quem recebe o álbum, todo o trabalho saiu do seu estúdio."
          image="https://picsum.photos/seed/seualbum-whitelabel/1200/900"
          imageAlt="Fotógrafa entregando um álbum impresso a um casal"
          bullets={[
            'Link de prova sem nenhuma marca nossa',
            'Arquivos finais sem assinatura de terceiros',
            'Você define o briefing e aprova cada versão',
          ]}
        />

        <EditorialSplit
          reverse
          eyebrow="Para estúdios"
          title="Volume alto, fila curta."
          description="Na assinatura mensal, o estúdio tem uma cota de álbuns por mês e cada pedido vai direto para a fila de diagramação, sem passar pelo checkout. Nos planos maiores, o prazo de entrega é menor."
          image="https://picsum.photos/seed/seualbum-estudio/1200/900"
          imageAlt="Estúdio fotográfico com álbuns organizados na estante"
        >
          <CtaButtons
            actions={[
              { href: '/precos#modelos', label: 'Comparar avulso e assinatura' },
              { href: '/como-funciona', label: 'Como funciona', variant: 'secondary' },
            ]}
          />
        </EditorialSplit>

        <CtaBand
          eyebrow="Comece agora"
          title="Envie as fotos. Receba um álbum com a sua assinatura."
          description="Crie a conta do estúdio e abra o primeiro pedido — escolha o plano, envie as fotos e defina o briefing em cinco passos."
          actions={[
            { href: '/auth/register', label: 'Criar conta do estúdio' },
            { href: '/dashboard/novo-pedido', label: 'Começar um pedido', variant: 'secondary' },
          ]}
          image="https://picsum.photos/seed/seualbum-servicos-cta/1600/900"
        />
      </main>
      <SiteFooter />
    </div>
  )
}
