/**
 * Estrutura configurável do catálogo público (Diretriz 12) — permite alterar
 * a vitrine (/albuns, /servicos, etc.) sem reconstruir componentes.
 */
export type AlbumOption = {
  id: string
  name: string
  description: string
  image: string
  price?: number
}
