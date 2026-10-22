import { atributosImagem } from '@/lib/imagens-locais'

const PASSOS = [
  {
    titulo: 'Envie o link das fotos',
    texto:
      'Cole a URL do Drive, Dropbox ou WeTransfer e preencha o briefing: estilo, número de lâminas e a gráfica que vai imprimir.',
    imagem: '/images/home/passo-01-envio.webp',
    alt: 'Mãos digitando no notebook, com a câmera profissional ao lado',
  },
  {
    titulo: 'Acompanhe a produção',
    texto:
      'O pedido entra na esteira e você vê o status em tempo real no painel — de "pendente" a "aguardando aprovação".',
    imagem: '/images/home/passo-02-producao.webp',
    alt: 'Designer apontando para uma grade de fotos no monitor durante a diagramação',
  },
  {
    titulo: 'Aprove com o seu cliente',
    texto:
      'Você recebe um link de prova white label. Os ajustes voltam para a produção dentro das rodadas do seu plano.',
    imagem: '/images/home/passo-03-aprovacao.webp',
    alt: 'Casal vendo a prova do álbum em um tablet sobre a mesa',
  },
  {
    titulo: 'Baixe os arquivos finais',
    texto:
      'Entregamos no template da sua gráfica, com o editável incluído nos planos Plus e Studio.',
    imagem: '/images/processo/entrega.webp',
    alt: 'Álbum fotográfico impresso aberto sobre uma mesa de madeira',
  },
]

export function HowItWorks() {
  return (
    <section id="servicos" className="font-marketing bg-white py-24 sm:py-28">
      <div className="container">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-12">
          <header className="lg:col-span-3">
            <p className="text-overline text-[#595959]">Processo</p>
            <h2 className="text-display-l mt-4 text-[#444444]">Como funciona</h2>
            <p className="text-body mt-4 text-[#595959]">
              Quatro passos entre o final do evento e o álbum na gráfica.
            </p>
          </header>

          <ol className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
            {PASSOS.map((passo, index) => (
              <li key={passo.titulo} className="group">
                <div className="mb-6 aspect-[4/3] overflow-hidden bg-[#F5F5F5]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- next/image cache corrompe no volume externo (AppleDouble/exFAT), ver auditoria. */}
                  <img
                    {...atributosImagem(passo.imagem, '(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw')}
                    alt={passo.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.03]"
                  />
                </div>
                <span className="block font-[family-name:var(--font-poppins)] text-7xl font-light leading-none text-[#CCCCCC]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-base font-semibold text-[#444444]">{passo.titulo}</h3>
                <p className="text-body mt-2 text-[#595959]">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
