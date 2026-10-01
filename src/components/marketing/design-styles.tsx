/**
 * Os cinco estilos oferecidos no briefing (`ESTILOS_DESIGN` em step-briefing).
 * A constante não é importada de lá porque aquele módulo é client component —
 * num server component o import viraria referência de cliente, não o array.
 * Fotografias de exemplo (picsum) até o portfólio real ser cadastrado.
 */
const ESTILOS = [
  {
    nome: 'Clássico',
    texto: 'Composições simétricas, respiro generoso e uma narrativa que atravessa gerações.',
    image: 'https://picsum.photos/seed/seualbum-classico/720/960',
  },
  {
    nome: 'Moderno',
    texto: 'Ritmo dinâmico, recortes ousados e sequências que alternam detalhe e panorama.',
    image: 'https://picsum.photos/seed/seualbum-moderno/720/960',
  },
  {
    nome: 'Editorial',
    texto: 'Lâminas com cara de revista: hierarquia forte, fotos protagonistas e tensão visual.',
    image: 'https://picsum.photos/seed/seualbum-editorial/720/960',
  },
  {
    nome: 'Minimalista',
    texto: 'Poucas fotos por lâmina, muito espaço em branco e foco total no essencial.',
    image: 'https://picsum.photos/seed/seualbum-minimalista/720/960',
  },
  {
    nome: 'Fine art',
    texto: 'Tratamento autoral e contemplativo, pensado para impressão em papéis especiais.',
    image: 'https://picsum.photos/seed/seualbum-fineart/720/960',
  },
]

interface DesignStylesProps {
  title?: string
  description?: string
}

export function DesignStyles({
  title = 'Cinco linguagens, uma assinatura: a sua.',
  description = 'Você escolhe o estilo no briefing e a diagramação segue a identidade do seu trabalho — não a nossa.',
}: DesignStylesProps) {
  return (
    <section className="font-marketing bg-white py-20 sm:py-28">
      <div className="container">
        <header className="grid gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="text-overline text-[#595959]">Estilos de design</p>
            <h2 className="text-display-l mt-4 text-balance text-[#444444]">{title}</h2>
          </div>
          <p className="text-body text-[#595959] lg:col-span-4 lg:col-start-9">{description}</p>
        </header>

        {/* No celular vira um carrossel de rolagem nativa (com snap) contido na
            própria faixa — a página em si nunca rola na horizontal. */}
        <ul className="-mx-6 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
          {ESTILOS.map((estilo) => (
            <li key={estilo.nome} className="group w-[72%] shrink-0 snap-start sm:w-auto">
              <div className="aspect-[3/4] overflow-hidden bg-[#F5F5F5]">
                {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
                <img
                  src={estilo.image}
                  alt={`Exemplo de fotografia para álbum no estilo ${estilo.nome.toLowerCase()}`}
                  loading="lazy"
                  className="h-full w-full object-cover grayscale contrast-[1.05] motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-105"
                />
              </div>
              <h3 className="text-title mt-5 text-[#444444]">{estilo.nome}</h3>
              <p className="text-body mt-2 text-[#595959]">{estilo.texto}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
