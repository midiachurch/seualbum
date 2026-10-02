/**
 * PDF mínimo com uma página por lâmina, cada uma com um JPG embutido
 * (DCTDecode) no tamanho real em mm — sem bibliotecas. Cor em sRGB: a
 * conversão para o perfil da gráfica (CMYK) fica com a produção.
 */
export type PaginaPdf = { jpeg: Uint8Array; larguraPx: number; alturaPx: number; larguraMm: number; alturaMm: number }

const PT_POR_MM = 72 / 25.4

export function montarPdf(paginas: PaginaPdf[], titulo: string): Uint8Array {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = []
  const offsets: number[] = []
  let tamanho = 0
  const escrever = (b: Uint8Array | string) => {
    const bytes = typeof b === 'string' ? enc.encode(b) : b
    partes.push(bytes)
    tamanho += bytes.length
  }
  const objeto = (n: number) => {
    offsets[n] = tamanho
    escrever(`${n} 0 obj\n`)
  }

  // 1 = catálogo, 2 = páginas, 3 = info; cada lâmina usa 3 objetos (página, imagem, conteúdo).
  const idsPagina = paginas.map((_, i) => 4 + i * 3)
  escrever('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  objeto(1)
  escrever('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objeto(2)
  escrever(`<< /Type /Pages /Kids [${idsPagina.map((id) => `${id} 0 R`).join(' ')}] /Count ${paginas.length} >>\nendobj\n`)
  objeto(3)
  const tituloSeguro = titulo.replace(/[()\\]/g, '').replace(/[^\x20-\x7E]/g, '?')
  escrever(`<< /Title (${tituloSeguro}) /Producer (SeuAlbum Smart Album) >>\nendobj\n`)

  paginas.forEach((p, i) => {
    const idPag = idsPagina[i]
    const idImg = idPag + 1
    const idCont = idPag + 2
    const w = (p.larguraMm * PT_POR_MM).toFixed(2)
    const h = (p.alturaMm * PT_POR_MM).toFixed(2)
    objeto(idPag)
    escrever(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /TrimBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${idImg} 0 R >> >> /Contents ${idCont} 0 R >>\nendobj\n`,
    )
    objeto(idImg)
    escrever(
      `<< /Type /XObject /Subtype /Image /Width ${p.larguraPx} /Height ${p.alturaPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
    )
    escrever(p.jpeg)
    escrever('\nendstream\nendobj\n')
    const conteudo = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`
    objeto(idCont)
    escrever(`<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream\nendobj\n`)
  })

  const inicioXref = tamanho
  const total = 4 + paginas.length * 3
  escrever(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let n = 1; n < total; n++) escrever(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  escrever(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`)

  const saida = new Uint8Array(tamanho)
  let pos = 0
  for (const b of partes) {
    saida.set(b, pos)
    pos += b.length
  }
  return saida
}
