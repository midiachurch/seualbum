import { describe, expect, it } from 'vitest'
import { montarPdf } from '@/lib/album/pdf'

/** JPEG mínimo (cabeçalho SOI/EOI) — o PDF só embute os bytes. */
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])

describe('PDF', () => {
  const pdf = montarPdf(
    [
      { jpeg, larguraPx: 7158, alturaPx: 3614, larguraMm: 606, alturaMm: 306 },
      { jpeg, larguraPx: 7158, alturaPx: 3614, larguraMm: 606, alturaMm: 306 },
    ],
    'Álbum (teste) \\ com caracteres',
  )
  const texto = new TextDecoder('latin1').decode(pdf)

  it('cabeçalho e fim', () => {
    expect(texto.startsWith('%PDF-1.4')).toBe(true)
    expect(texto.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('2 páginas no tamanho real (606 mm = 1717.8 pt)', () => {
    expect(texto).toContain('/Count 2')
    expect(texto.match(/\/MediaBox \[0 0 1717\.80 867\.40\]/g)).toHaveLength(2)
  })

  it('tabela xref aponta para cada objeto', () => {
    const inicio = Number(/startxref\n(\d+)/.exec(texto)![1])
    expect(texto.slice(inicio, inicio + 4)).toBe('xref')
    const offsets = [...texto.matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]))
    expect(offsets).toHaveLength(9)
    offsets.forEach((o, i) => expect(texto.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`))
  })

  it('título com parênteses/barra não quebra a sintaxe', () => expect(texto).toMatch(/\/Title \(lbum teste  com caracteres\)|\/Title \(\?lbum teste  com caracteres\)/))
})
