import type { Banner, MediaAsset, PortfolioCollection } from '@/types/platform'

/** Dados fictícios da Fase 5 (Biblioteca de mídia, Banners, Portfólio). */

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

function asset(
  id: string,
  seed: string,
  nome: string,
  tags: MediaAsset['tags'],
  w: number,
  h: number,
  kb: number,
  ago: number,
): MediaAsset {
  return {
    id,
    url: `https://picsum.photos/seed/${seed}/${w}/${h}`,
    nome,
    tags,
    larguraPx: w,
    alturaPx: h,
    tamanhoKb: kb,
    criadoEm: daysAgo(ago),
  }
}

export const MOCK_MEDIA_ASSETS: MediaAsset[] = [
  asset('media-1', 'banner-hero-casamento', 'banner-hero-casamento.jpg', ['Banners'], 1920, 1080, 842, 40),
  asset('media-2', 'banner-promo-verao', 'banner-promo-verao.jpg', ['Banners'], 1920, 1080, 731, 25),
  asset('media-3', 'banner-black-friday', 'banner-black-friday.jpg', ['Banners'], 1920, 1080, 690, 8),
  asset('media-4', 'capa-casamento-01', 'capa-casamento-01.jpg', ['Capas', 'Portfólio'], 1200, 1200, 412, 60),
  asset('media-5', 'capa-gestante-01', 'capa-gestante-01.jpg', ['Capas', 'Portfólio'], 1200, 1200, 388, 55),
  asset('media-6', 'capa-formatura-01', 'capa-formatura-01.jpg', ['Capas', 'Portfólio'], 1200, 1200, 401, 50),
  asset('media-7', 'portfolio-casamento-02', 'portfolio-casamento-02.jpg', ['Portfólio'], 1600, 1067, 512, 60),
  asset('media-8', 'portfolio-casamento-03', 'portfolio-casamento-03.jpg', ['Portfólio'], 1600, 1067, 498, 59),
  asset('media-9', 'portfolio-casamento-04', 'portfolio-casamento-04.jpg', ['Portfólio'], 1600, 1067, 505, 58),
  asset('media-10', 'portfolio-gestante-02', 'portfolio-gestante-02.jpg', ['Portfólio'], 1600, 1067, 462, 54),
  asset('media-11', 'portfolio-gestante-03', 'portfolio-gestante-03.jpg', ['Portfólio'], 1600, 1067, 470, 53),
  asset('media-12', 'portfolio-formatura-02', 'portfolio-formatura-02.jpg', ['Portfólio'], 1600, 1067, 488, 49),
  asset('media-13', 'portfolio-formatura-03', 'portfolio-formatura-03.jpg', ['Portfólio'], 1600, 1067, 495, 48),
  asset('media-14', 'referencia-editorial-01', 'referencia-editorial-01.jpg', ['Referências'], 1400, 1866, 355, 90),
  asset('media-15', 'referencia-editorial-02', 'referencia-editorial-02.jpg', ['Referências'], 1400, 1866, 362, 88),
  asset('media-16', 'referencia-tipografia', 'referencia-tipografia.jpg', ['Referências'], 1400, 933, 298, 85),
  asset('media-17', 'logo-estudio-parceiro', 'logo-estudio-parceiro.jpg', ['Geral'], 800, 800, 120, 100),
  asset('media-18', 'equipe-bastidores', 'equipe-bastidores.jpg', ['Geral'], 1600, 1067, 445, 30),
]

export const MOCK_BANNERS: Banner[] = [
  {
    id: 'banner-1',
    imagemId: 'media-1',
    titulo: 'Fotografias merecem virar histórias',
    subtitulo: 'Álbuns sob medida para os momentos que você quer guardar para sempre.',
    linkCta: '/criar-album',
    ativo: true,
    ordem: 1,
  },
  {
    id: 'banner-2',
    imagemId: 'media-2',
    titulo: 'Temporada de casamentos',
    subtitulo: 'Condições especiais para álbuns de casamento fechados até dezembro.',
    linkCta: '/precos',
    ativo: true,
    ordem: 2,
  },
  {
    id: 'banner-3',
    imagemId: 'media-3',
    titulo: 'Black Friday Seu Álbum',
    subtitulo: '20% de desconto em álbuns premium — por tempo limitado.',
    linkCta: '/precos',
    ativo: false,
    ordem: 3,
  },
]

export const MOCK_PORTFOLIO_COLLECTIONS: PortfolioCollection[] = [
  {
    id: 'colecao-casamentos',
    nome: 'Casamentos',
    descricao: 'Cerimônias e festas que viraram álbuns inesquecíveis.',
    capaImagemId: 'media-4',
    status: 'publicado',
    ordem: 1,
    itens: [
      { id: 'item-1', imagemId: 'media-4', legenda: 'Casamento Marina & Théo' },
      { id: 'item-2', imagemId: 'media-7', legenda: 'Cerimônia ao ar livre' },
      { id: 'item-3', imagemId: 'media-8', legenda: 'Festa à noite' },
      { id: 'item-4', imagemId: 'media-9', legenda: 'Detalhes da decoração' },
    ],
  },
  {
    id: 'colecao-gestante',
    nome: 'Ensaios de Gestante',
    descricao: 'Ensaios delicados para registrar a espera.',
    capaImagemId: 'media-5',
    status: 'publicado',
    ordem: 2,
    itens: [
      { id: 'item-5', imagemId: 'media-5', legenda: 'Ensaio em estúdio' },
      { id: 'item-6', imagemId: 'media-10', legenda: 'Luz natural' },
      { id: 'item-7', imagemId: 'media-11', legenda: 'Casal em casa' },
    ],
  },
  {
    id: 'colecao-formatura',
    nome: 'Formaturas',
    descricao: 'A conquista de anos de estudo, em papel.',
    capaImagemId: 'media-6',
    status: 'rascunho',
    ordem: 3,
    itens: [
      { id: 'item-8', imagemId: 'media-6', legenda: 'Colação de grau' },
      { id: 'item-9', imagemId: 'media-12', legenda: 'Turma reunida' },
      { id: 'item-10', imagemId: 'media-13', legenda: 'Beca e capelo' },
    ],
  },
]
