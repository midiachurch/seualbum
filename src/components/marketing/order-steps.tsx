import { cn } from '@/lib/utils'

/**
 * Espelha os cinco passos reais do wizard de novo pedido
 * (`components/dashboard/novo-pedido/wizard.tsx`). Se o wizard mudar, esta
 * lista precisa acompanhar — a página promete exatamente o que o painel entrega.
 */
const PASSOS = [
  {
    label: 'Plano',
    titulo: 'Escolha o plano',
    texto: 'Compare prazo, rodadas de revisão e preço. Assinantes usam o álbum já incluído no mês.',
  },
  {
    label: 'Projeto',
    titulo: 'Conte sobre o projeto',
    texto: 'Nome do casal ou do evento, a data e o contato do seu cliente.',
  },
  {
    label: 'Fotos',
    titulo: 'Envie as fotos',
    texto: 'Direto da galeria do celular ou por um link do Google Drive ou Dropbox.',
  },
  {
    label: 'Briefing',
    titulo: 'Defina o briefing',
    texto: 'Estilo de design, fotos obrigatórias e tudo o que não pode faltar nas lâminas.',
  },
  {
    label: 'Revisão',
    titulo: 'Revise e envie',
    texto: 'Confira o resumo do pedido e mande para a nossa equipe de diagramação.',
  },
]

interface OrderStepsProps {
  eyebrow?: string
  title: string
  description?: string
  tone?: 'white' | 'gray'
}

export function OrderSteps({ eyebrow = 'O pedido', title, description, tone = 'white' }: OrderStepsProps) {
  return (
    <section className={cn('font-marketing py-20 sm:py-28', tone === 'gray' ? 'bg-[#F5F5F5]' : 'bg-white')}>
      <div className="container">
        <header className="max-w-2xl">
          <p className="text-overline text-[#595959]">{eyebrow}</p>
          <h2 className="text-display-l mt-4 text-balance text-[#444444]">{title}</h2>
          {description ? (
            <p className={cn('text-body mt-4', tone === 'gray' ? 'text-[#444444]' : 'text-[#595959]')}>{description}</p>
          ) : null}
        </header>

        {/* Linha do tempo: vertical no celular, cinco colunas a partir do desktop. */}
        <ol className="mt-14 grid gap-px overflow-hidden border border-[#EAEAEA] bg-[#EAEAEA] sm:grid-cols-2 lg:grid-cols-5">
          {PASSOS.map((passo, index) => (
            <li key={passo.label} className="flex flex-col bg-white p-6 sm:p-8">
              <span className="font-[family-name:var(--font-poppins)] text-5xl font-light leading-none text-[#CCCCCC]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-overline mt-6 text-[#595959]">{passo.label}</span>
              <h3 className="mt-2 text-base font-semibold text-[#444444]">{passo.titulo}</h3>
              <p className="text-body mt-2 text-[#595959]">{passo.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
