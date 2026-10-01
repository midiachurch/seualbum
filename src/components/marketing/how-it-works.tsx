const PASSOS = [
  {
    titulo: 'Envie o link das fotos',
    texto:
      'Cole a URL do Drive, Dropbox ou WeTransfer e preencha o briefing: estilo, número de lâminas e a gráfica que vai imprimir.',
  },
  {
    titulo: 'Acompanhe a produção',
    texto:
      'O pedido entra na esteira e você vê o status em tempo real no painel — de "pendente" a "aguardando aprovação".',
  },
  {
    titulo: 'Aprove com o seu cliente',
    texto:
      'Você recebe um link de prova white label. Os ajustes voltam para a produção dentro das rodadas do seu plano.',
  },
  {
    titulo: 'Baixe os arquivos finais',
    texto:
      'Entregamos no template da sua gráfica, com o editável incluído nos planos Plus e Studio.',
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
              <li key={passo.titulo}>
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
