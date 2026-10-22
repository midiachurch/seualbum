import manifesto from './imagens-locais.json'

type Entrada = { largura: number; altura: number; larguraSm: number }

const IMAGENS = manifesto as Record<string, Entrada>

/**
 * Atributos de <img> para as fotos de `public/images/` (geradas por
 * scripts/optimize-images.mjs): `srcSet` com a variante `-sm.webp` (metade da
 * largura) para o celular baixar menos, `sizes` e `width`/`height` (evitam o
 * salto de layout enquanto a foto carrega). Os componentes de marketing usam
 * <img>, não next/image — sem isto, o celular baixaria sempre a versão grande.
 *
 * Fora do manifesto (URL externa, Storage, foto nova sem rodar o script):
 * devolve só o `src`, como antes.
 *
 * `sizes`: quanto da tela a imagem ocupa, ex. '(min-width: 1024px) 50vw, 100vw'.
 */
export function atributosImagem(src: string, sizes = '100vw') {
  const entrada = IMAGENS[src]
  if (!entrada) return { src }
  return {
    src,
    srcSet: `${src.replace(/\.webp$/, '-sm.webp')} ${entrada.larguraSm}w, ${src} ${entrada.largura}w`,
    sizes,
    width: entrada.largura,
    height: entrada.altura,
  }
}
