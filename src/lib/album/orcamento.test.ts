import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { documentoVazio, geometria, normalizarDocumento, type DocumentoAlbum, type FotoEditor } from '@/lib/album/documento'
import { preencherAutomaticamente } from '@/lib/album/modelos'
import { avaliarOrcamento, avisoDeOrcamentoDaSelecao, medirDocumento, ORCAMENTO } from '@/lib/album/orcamento'
import { montarPdf } from '@/lib/album/pdf'
import { documentoInicial } from '@/lib/album/preparar-projeto'
import { verificarAlbum } from '@/lib/album/verificacao'

/**
 * D04: orçamento por documento, medido (não estimado), e verificação regressiva
 * do que alimenta a exportação (documento serializável e reproduzível, pré-checagem
 * estável, PDF determinístico). Os números impressos como `MEDIDA` vão para
 * docs/operacao-digital/modulos/DESIGN-SELECAO.md.
 */

const g = geometria({ formato: '30x30', orientacao: 'quadrado', sangriaMm: 3, margemSeguraMm: 5 })!

function fotos(n: number): FotoEditor[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    url: '',
    nome: `IMG_${i}.jpg`,
    largura: i % 3 === 0 ? 4000 : 6000,
    altura: i % 3 === 0 ? 6000 : 4000,
    capturadaEm: new Date(1_700_000_000_000 + i * 60_000).toISOString(),
  }))
}

const media = (f: () => void, repeticoes = 5) => {
  f() // aquece o JIT: o que importa é o custo de abrir o documento, não da primeira compilação
  const t = performance.now()
  for (let i = 0; i < repeticoes; i++) f()
  return (performance.now() - t) / repeticoes
}

const dimensoesDe = (lista: FotoEditor[]) => new Map(lista.map((f) => [f.id, { largura: f.largura, altura: f.altura }]))

/** Sem os ids aleatórios dos elementos: o que sobra é o documento. */
function semIds(doc: DocumentoAlbum) {
  return JSON.parse(JSON.stringify(doc, (k, v) => (k === 'id' ? undefined : v)))
}

describe('orçamento por documento — medido', () => {
  // [lâminas pedidas (a capa soma 1), fotos]: de um casamento comum ao teto de 200 lâminas / 1000 fotos.
  it.each([
    [30, 150],
    [60, 300],
    [100, 600],
    [199, 1000],
  ])('%i lâminas e %i fotos abrem dentro do orçamento', (laminas, quantidade) => {
    const lista = fotos(quantidade)
    const t0 = performance.now()
    const doc = preencherAutomaticamente(lista, laminas, g, true)
    const montagemMs = performance.now() - t0
    const json = JSON.stringify(doc)
    const dims = dimensoesDe(lista)
    const aberturaMs = media(() => {
      const aberto = normalizarDocumento(JSON.parse(json))
      verificarAlbum(aberto, g, dims)
    })
    const m = medirDocumento(doc)
    console.log(`MEDIDA laminas=${m.laminas} quadros=${m.quadros} fotos=${m.fotos} json=${m.bytes}B abertura=${aberturaMs.toFixed(2)}ms montagem=${montagemMs.toFixed(0)}ms`)

    expect(m.laminas).toBeLessThanOrEqual(ORCAMENTO.laminas.limite)
    expect(m.bytes).toBeLessThan(ORCAMENTO.bytes.limite)
    expect(aberturaMs).toBeLessThan(ORCAMENTO.aberturaMs.falha)
    expect(montagemMs).toBeLessThan(ORCAMENTO.montagemMs.falha)
    // Mesmo no teto o documento cabe com folga no CHECK do banco (25% do limite).
    expect(m.bytes / ORCAMENTO.bytes.limite).toBeLessThan(0.25)
  })

  it('classifica ok / aviso / excedido pelas métricas do documento', () => {
    expect(avaliarOrcamento(documentoVazio(10)).nivel).toBe('ok')
    expect(avaliarOrcamento(documentoVazio(ORCAMENTO.laminas.recomendado + 1)).itens.find((i) => i.metrica === 'laminas')?.nivel).toBe('aviso')
    const muitas = { ...documentoVazio(1), laminas: Array.from({ length: ORCAMENTO.laminas.limite + 1 }, () => documentoVazio(1).laminas[0]) }
    expect(avaliarOrcamento(muitas).nivel).toBe('excedido')
  })

  it('aviso da seleção: nenhum até o recomendado, aviso depois, recusa acima do teto', () => {
    expect(avisoDeOrcamentoDaSelecao(ORCAMENTO.fotos.recomendado)).toBeNull()
    expect(avisoDeOrcamentoDaSelecao(ORCAMENTO.fotos.recomendado + 1)).toMatch(/pode ficar mais lento/)
    expect(avisoDeOrcamentoDaSelecao(ORCAMENTO.fotos.limite + 1)).toMatch(/não cabe/)
  })

  it('o teto de fotos do orçamento é o mesmo da seleção entregue (1000) e das lâminas do documento (200)', () => {
    expect(ORCAMENTO.fotos.limite).toBe(1000)
    expect(ORCAMENTO.laminas.limite).toBe(200)
  })
})

describe('exportação regressiva', () => {
  const lista = fotos(300)
  const doc = preencherAutomaticamente(lista, 60, g, true)
  const dims = dimensoesDe(lista)

  it('o documento sobrevive a salvar e reabrir sem mudar nada (o que o JPG/ZIP lê)', () => {
    const reaberto = normalizarDocumento(JSON.parse(JSON.stringify(doc)))
    expect(reaberto).toEqual(doc)
    expect(normalizarDocumento(reaberto)).toEqual(reaberto)
  })

  it('a pré-checagem dá o mesmo resultado antes e depois de salvar (só a capa vazia da montagem automática é erro)', () => {
    const antes = verificarAlbum(doc, g, dims)
    const depois = verificarAlbum(normalizarDocumento(JSON.parse(JSON.stringify(doc))), g, dims)
    expect(depois).toEqual(antes)
    expect(antes.filter((p) => p.nivel === 'erro').map((p) => [p.laminaIndice, p.mensagem])).toEqual([[0, 'Lâmina sem conteúdo.']])
  })

  it('o documento inicial criado pelo banco (0090) normaliza para o mesmo documento do editor', () => {
    const doBanco = {
      versao: 1,
      primeiraEhCapa: false,
      laminas: [{ id: 'l1', fundo: '#ffffff', fundoGradiente: null, textura: null, fundoImagem: null, quadros: [], textos: [], formas: [] }],
    }
    expect(semIds(normalizarDocumento(doBanco))).toEqual(semIds(documentoInicial()))
    expect(normalizarDocumento(doBanco).laminas).toHaveLength(1)
  })

  it('PDF de 100 lâminas é determinístico, tem 100 páginas e xref íntegra', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])
    const paginas = Array.from({ length: 100 }, () => ({ jpeg, larguraPx: 7158, alturaPx: 3614, larguraMm: 606, alturaMm: 306 }))
    const a = montarPdf(paginas, 'Álbum')
    const b = montarPdf(paginas, 'Álbum')
    const hash = (x: Uint8Array) => createHash('sha256').update(x).digest('hex')
    expect(hash(a)).toBe(hash(b))
    const texto = new TextDecoder('latin1').decode(a)
    expect(texto).toContain('/Count 100')
    const inicio = Number(/startxref\n(\d+)/.exec(texto)![1])
    expect(texto.slice(inicio, inicio + 4)).toBe('xref')
    const offsets = [...texto.matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]))
    expect(offsets).toHaveLength(3 + 100 * 3)
    offsets.forEach((o, i) => expect(texto.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`))
    console.log(`MEDIDA pdf100=${a.length}B`)
  })
})
