#!/usr/bin/env node
/**
 * Gera as imagens do site (public/images/) a partir dos originais licenciados
 * do Envato Elements em `_envato-raw/` (fora do git — ver .gitignore):
 * recorte "cover" no tamanho de cada destino e WebP qualidade 80 (esforço
 * máximo do encoder), mais uma variante `-sm.webp` com metade da largura para
 * celular. As dimensões vão para `src/lib/imagens-locais.json`, que
 * `atributosImagem()` (src/lib/imagens-locais.ts) transforma em srcSet/sizes/
 * width/height nos <img> — os componentes usam <img>, não next/image.
 *
 *   node scripts/optimize-images.mjs            # gera tudo (sobrescreve)
 *   node scripts/optimize-images.mjs estilos    # só os destinos que contêm "estilos"
 *
 * O recorte é centralizado; `posicao` ajusta só onde o centro cortaria o
 * assunto (ex.: noiva no canto de uma foto horizontal virando retrato).
 *
 * Licença: Licença Comercial Vitalícia do Envato Elements, projeto "seualbum".
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEM = path.join(RAIZ, '_envato-raw')
const DESTINO = path.join(RAIZ, 'public', 'images')

/** [original em _envato-raw, destino em public/images, largura, altura, posicao?] */
const IMAGENS = [
  ['photographer-editing-images-on-laptop-in-workplace-2026-10-05-20-01-42-utc.jpg', 'home/passo-01-envio.webp', 1200, 900],
  ['woman-discussing-designs-on-computer-with-coworker-2026-09-25-07-50-54-utc.jpg', 'home/passo-02-producao.webp', 1200, 900],
  ['senior-couple-enjoying-pictures-on-tablet-together-2026-09-24-02-45-40-utc.jpg', 'home/passo-03-aprovacao.webp', 1200, 900],
  ['family-vacation-memories-preserved-in-photo-album-2026-09-22-01-55-39-utc.jpg', 'processo/entrega.webp', 1200, 900],
  ['three-women-pointing-at-old-photographs-in-an-albu-2026-09-25-03-35-45-utc.jpg', 'cta/album-maos.webp', 1600, 900],
  ['young-man-looking-through-a-photo-album-at-home-2026-09-08-20-54-38-utc.jpg', 'processo/processo.webp', 1200, 1500],
  ['woman-in-dress-being-photographed-by-phone-2026-09-22-17-27-42-utc.jpg', 'processo/envio.webp', 1200, 900],
  ['smiling-couple-relaxing-at-home-with-laptop-2026-09-22-02-50-41-utc.jpg', 'processo/prova.webp', 1200, 900],
  ['senior-couple-happily-looking-at-photo-album-2026-09-22-14-09-25-utc.jpg', 'cta/como-funciona.webp', 1600, 900],
  ['affectionate-couple-embrace-outdoors-in-black-and-2026-09-21-13-56-56-utc.jpg', 'estilos/classico.webp', 720, 960],
  ['beautiful-couple-in-love-celebrate-wedding-day-2026-09-24-17-38-19-utc.jpg', 'estilos/moderno.webp', 720, 960],
  ['woman-posing-in-a-glamorous-white-gown-2026-09-22-02-55-24-utc.jpg', 'estilos/editorial.webp', 720, 960],
  ['woman-in-white-dress-holding-flowers-on-white-2026-09-22-17-21-17-utc.jpg', 'estilos/minimalista.webp', 720, 960],
  ['blonde-woman-in-bridal-dress-stands-by-window-2026-09-22-13-51-09-utc.jpg', 'estilos/fineart.webp', 720, 960, 'east'],
  ['photo-editing-session-with-prints-on-wooden-desk-2026-09-21-18-26-10-utc.jpg', 'servicos/servicos.webp', 1200, 1500],
  ['blue-album-in-hands-on-light-blue-background-2026-09-25-02-19-23-utc.jpg', 'servicos/whitelabel.webp', 1200, 900],
  ['vintage-camera-and-books-with-blank-frame-mockup-2026-09-24-09-42-47-utc.jpg', 'servicos/estudio.webp', 1200, 900],
  ['black-book-and-scissors-on-white-background-2026-09-23-05-59-23-utc.jpg', 'albuns/20x20.webp', 960, 540],
  ['white-book-with-latte-art-and-yellow-flowers-2026-09-23-06-29-14-utc.jpg', 'albuns/25x25.webp', 960, 540],
  ['minimalist-black-book-on-grey-marble-background-2026-09-25-01-06-31-utc.jpg', 'albuns/30x30.webp', 960, 540],
  ['family-album-with-warm-memories-on-display-2026-09-24-08-03-04-utc.jpg', 'albuns/30x40.webp', 960, 540],
  ['open-book-with-flowers-on-white-satin-2026-09-24-10-30-06-utc.jpg', 'cta/criar-album.webp', 1600, 900],
  ['open-photo-album-with-couple-photos-and-gold-ribbo-2026-10-16-19-20-38-utc.jpg', 'cta/precos.webp', 1600, 900],
]

const filtro = process.argv[2]
const MANIFESTO = path.join(RAIZ, 'src', 'lib', 'imagens-locais.json')
// Esforço máximo do encoder: mesmo visual em qualidade 80, arquivo menor.
const WEBP = { quality: 80, effort: 6, smartSubsample: true }
let total = 0
const manifesto = JSON.parse(await readFile(MANIFESTO, 'utf8').catch(() => '{}'))

async function gerar(original, saida, largura, altura, posicao) {
  await sharp(path.join(ORIGEM, original))
    .rotate()
    .resize(largura, altura, { fit: 'cover', position: posicao })
    .webp(WEBP)
    .toFile(saida)
  const { size } = await stat(saida)
  total += size
  return size
}

for (const [original, destino, largura, altura, posicao = 'centre'] of IMAGENS) {
  if (filtro && !destino.includes(filtro)) continue
  const saida = path.join(DESTINO, destino)
  await mkdir(path.dirname(saida), { recursive: true })
  const kb = (await gerar(original, saida, largura, altura, posicao)) / 1024
  // Variante para celular (metade da largura): o <img> escolhe pelo srcSet.
  const larguraSm = Math.round(largura / 2)
  const alturaSm = Math.round(altura / 2)
  const kbSm = (await gerar(original, saida.replace(/\.webp$/, '-sm.webp'), larguraSm, alturaSm, posicao)) / 1024
  manifesto[`/images/${destino}`] = { largura, altura, larguraSm }
  console.log(
    `${destino.padEnd(32)} ${`${largura}×${altura}`.padEnd(10)} ${kb.toFixed(0).padStart(4)} KB   -sm ${`${larguraSm}w`.padEnd(5)} ${kbSm.toFixed(0).padStart(4)} KB`,
  )
}

const ordenado = Object.fromEntries(Object.entries(manifesto).sort(([a], [b]) => a.localeCompare(b)))
await writeFile(MANIFESTO, `${JSON.stringify(ordenado, null, 2)}\n`)
console.log(`\nTotal gerado: ${(total / 1024 / 1024).toFixed(2)} MB · manifesto: src/lib/imagens-locais.json`)
