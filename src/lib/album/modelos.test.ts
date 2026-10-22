import { describe, expect, it } from 'vitest'
import { geometria, type FotoEditor, type Geometria } from '@/lib/album/documento'
import {
  contagensPorMomento,
  documentoDoModelo,
  ESTILOS,
  GRADES_POR_PAGINA,
  gradesDePagina,
  layoutsVazios,
  MODELOS_DE_ALBUM,
  ordenarCronologicamente,
  preencherAutomaticamente,
  preencherQuadrosVazios,
  temQuadrosVazios,
  tipoDaComposicao,
  variantesDeLayout,
} from '@/lib/album/modelos'

const FORMATOS: [string, 'quadrado' | 'horizontal' | 'vertical'][] = [
  ['20x20', 'quadrado'],
  ['25x25', 'quadrado'],
  ['30x30', 'quadrado'],
  ['20x30', 'vertical'],
  ['20x30', 'horizontal'],
  ['30x40', 'vertical'],
  ['30x40', 'horizontal'],
  ['15x21', 'vertical'],
]
const geo = (f: string, o: 'quadrado' | 'horizontal' | 'vertical') => geometria({ formato: f, orientacao: o, sangriaMm: 3, margemSeguraMm: 5 })!

/** Mistura de proporções: horizontal, vertical, quadrada, panorâmica e sem dimensão conhecida. */
function fotos(n: number, tipo: 'mista' | 'vertical' | 'panoramica' | 'sem-dimensao' = 'mista'): FotoEditor[] {
  const dims = (i: number): [number | null, number | null] => {
    if (tipo === 'vertical') return [4000, 6000]
    if (tipo === 'panoramica') return [9000, 3000]
    if (tipo === 'sem-dimensao') return [null, null]
    return ([[6000, 4000], [4000, 6000], [4000, 4000], [9000, 3000], [null, null]] as [number | null, number | null][])[i % 5]
  }
  return Array.from({ length: n }, (_, i) => ({ id: `f${i}`, url: '', nome: `f${i}`, largura: dims(i)[0], altura: dims(i)[1] }))
}

function quadrosDentro(g: Geometria, qs: { x: number; y: number; w: number; h: number }[]) {
  const s = g.sangria + 0.01
  return qs.every((q) => [q.x, q.y, q.w, q.h].every(Number.isFinite) && q.w > 0 && q.h > 0 && q.x >= -s && q.y >= -s && q.x + q.w <= g.laminaW + s && q.y + q.h <= g.laminaH + s)
}

describe('Smart Layout — todos os formatos × 1 a 16 fotos × tipos de foto', () => {
  for (const [f, o] of FORMATOS) {
    for (const tipo of ['mista', 'vertical', 'panoramica', 'sem-dimensao'] as const) {
      it(`${f} ${o} · ${tipo}`, () => {
        const g = geo(f, o)
        for (let n = 1; n <= 16; n++) {
          const fs = fotos(n, tipo)
          const vs = variantesDeLayout(fs, g)
          expect(vs.length, `${n} fotos`).toBeGreaterThan(0)
          for (const v of vs) {
            expect(v.quadros).toHaveLength(n)
            const ids = v.quadros.map((q) => q.fotoId)
            expect(new Set(ids).size, 'cada foto uma vez').toBe(n)
            expect(ids.every((id) => fs.some((x) => x.id === id))).toBe(true)
            expect(quadrosDentro(g, v.quadros), 'quadros dentro da lâmina + sangria').toBe(true)
            expect(Number.isFinite(v.erro)).toBe(true)
            expect(tipoDaComposicao(v)).toBeTruthy()
          }
        }
      })
    }
  }

  it('0 ou mais de 16 fotos: sem sugestões (não quebra)', () => {
    const g = geo('30x30', 'quadrado')
    expect(variantesDeLayout([], g)).toEqual([])
    expect(variantesDeLayout(fotos(17), g)).toEqual([])
  })

  it('estilos diferentes também produzem sugestões válidas', () => {
    const g = geo('30x30', 'quadrado')
    for (const e of ESTILOS) for (let n = 1; n <= 8; n++) expect(variantesDeLayout(fotos(n), g, 5, e).length).toBeGreaterThan(0)
  })

  it('foto principal fica com o maior quadro', () => {
    const g = geo('30x30', 'quadrado')
    const fs = fotos(5).map((f, i) => (i === 3 ? { ...f, prioridade: 'principal' as const } : f))
    for (const v of variantesDeLayout(fs, g)) {
      const maior = [...v.quadros].sort((a, b) => b.w * b.h - a.w * a.h)[0]
      expect(maior.fotoId).toBe('f3')
    }
  })

  it('layouts vazios de 1 a 8 quadros', () => {
    const g = geo('30x40', 'horizontal')
    for (let n = 1; n <= 8; n++) {
      const [v] = layoutsVazios(n, g)
      expect(v.quadros).toHaveLength(n)
      expect(v.quadros.every((q) => q.fotoId === null)).toBe(true)
    }
  })
})

describe('Preenchimento automático — cenários de borda', () => {
  const g = geo('30x30', 'quadrado')

  it('nenhuma foto: lâminas vazias, sem quebrar', () => {
    const d = preencherAutomaticamente([], 10, g, false)
    expect(d.laminas).toHaveLength(10)
    expect(d.laminas.every((l) => l.quadros.length === 0)).toBe(true)
  })

  it('1 foto em 30 lâminas: usa a foto uma vez e completa com lâminas vazias', () => {
    const d = preencherAutomaticamente(fotos(1), 30, g, false)
    expect(d.laminas).toHaveLength(30)
    expect(d.laminas.flatMap((l) => l.quadros)).toHaveLength(1)
  })

  it('120 fotos em 30 lâminas: usa todas, sem repetir, no máximo 16 por lâmina', () => {
    const d = preencherAutomaticamente(fotos(120), 30, g, true)
    const ids = d.laminas.flatMap((l) => l.quadros.map((q) => q.fotoId))
    expect(d.laminas).toHaveLength(31)
    expect(d.primeiraEhCapa).toBe(true)
    expect(ids).toHaveLength(120)
    expect(new Set(ids).size).toBe(120)
    expect(Math.max(...d.laminas.map((l) => l.quadros.length))).toBeLessThanOrEqual(16)
  })

  it('500 fotos em 10 lâminas: limita a 16 por lâmina sem travar', () => {
    const d = preencherAutomaticamente(fotos(500), 10, g, false)
    expect(Math.max(...d.laminas.map((l) => l.quadros.length))).toBeLessThanOrEqual(16)
  })

  it('cada estilo distribui todas as fotos', () => {
    for (const e of ESTILOS) {
      const d = preencherAutomaticamente(fotos(60), 20, g, false, e)
      expect(d.laminas.flatMap((l) => l.quadros)).toHaveLength(60)
    }
  })
})

describe('Modelos de álbum — todos os modelos × formatos', () => {
  it.each(MODELOS_DE_ALBUM.map((m) => [m.id]))('%s', (id) => {
    const m = MODELOS_DE_ALBUM.find((x) => x.id === id)!
    for (const [f, o] of FORMATOS) {
      const g = geo(f, o)
      for (const n of [1, 2, 3, m.laminas]) {
        const d = documentoDoModelo(m, n, g, 'Ana & João')
        expect(d.laminas.length).toBe(n + (m.capa ? 1 : 0))
        for (const l of d.laminas) expect(quadrosDentro(g, l.quadros)).toBe(true)
      }
    }
  })

  it('preencher os quadros vazios do modelo: com fotos de sobra, não sobra vazio', () => {
    const g = geo('30x30', 'quadrado')
    const d = documentoDoModelo(MODELOS_DE_ALBUM[0], 10, g)
    const cheio = preencherQuadrosVazios(d, fotos(200))
    expect(temQuadrosVazios(cheio)).toBe(false)
  })

  it('preencher com poucas fotos: preenche o que dá e mantém o resto vazio', () => {
    const g = geo('30x30', 'quadrado')
    const d = documentoDoModelo(MODELOS_DE_ALBUM[0], 10, g)
    const r = preencherQuadrosVazios(d, fotos(3))
    expect(r.laminas.flatMap((l) => l.quadros).filter((q) => q.fotoId)).toHaveLength(3)
  })
})

describe('Grades de página — cada uma é válida', () => {
  for (let n = 1; n <= 8; n++) {
    it(`${n} foto(s): ${GRADES_POR_PAGINA[n]} grades, células dentro da página e sem sobreposição`, () => {
      const grades = gradesDePagina(n)
      expect(grades.length).toBeGreaterThanOrEqual(4)
      for (const g of grades) {
        expect(g).toHaveLength(n)
        for (const [x, y, w, h] of g) {
          expect(x).toBeGreaterThanOrEqual(-1e-9)
          expect(y).toBeGreaterThanOrEqual(-1e-9)
          expect(x + w).toBeLessThanOrEqual(1 + 1e-9)
          expect(y + h).toBeLessThanOrEqual(1 + 1e-9)
          expect(w > 0 && h > 0).toBe(true)
        }
        for (let i = 0; i < g.length; i++)
          for (let j = i + 1; j < g.length; j++) {
            const [ax, ay, aw, ah] = g[i]
            const [bx, by, bw, bh] = g[j]
            const sobrepoe = Math.min(ax + aw, bx + bw) - Math.max(ax, bx) > 1e-6 && Math.min(ay + ah, by + bh) - Math.max(ay, by) > 1e-6
            expect(sobrepoe, `grade de ${n}: células ${i} e ${j} se sobrepõem`).toBe(false)
          }
      }
    })
  }

  it('de 8 a 16 fotos há pelo menos 10 composições por quantidade', () => {
    const g = geo('30x30', 'quadrado')
    for (let n = 8; n <= 16; n++) expect(variantesDeLayout(fotos(n), g, 10_000).length, `${n} fotos`).toBeGreaterThanOrEqual(10)
  })
})

describe('Montagem automática — agrupamento, reutilização e ordem', () => {
  const g = geo('30x30', 'quadrado')
  const comHora = (n: number, inicio: string, cena: string) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${cena}${i}`,
      url: '',
      nome: `${cena}${i}`,
      largura: 6000,
      altura: 4000,
      grupo: cena,
      capturadaEm: new Date(Date.parse(inicio) + i * 60_000).toISOString().slice(0, 19),
    }))

  it('agrupar por momento: nenhuma lâmina mistura making of com festa', () => {
    const lista = [...comHora(12, '2026-10-02T09:00:00Z', 'making'), ...comHora(12, '2026-10-02T15:00:00Z', 'festa')]
    const d = preencherAutomaticamente(lista, 6, g, false, ESTILOS[0], { agrupar: 'captura' })
    for (const l of d.laminas) {
      const cenas = new Set(l.quadros.map((q) => q.fotoId!.replace(/\d+$/, '')))
      expect(cenas.size).toBeLessThanOrEqual(1)
    }
    expect(d.laminas.flatMap((l) => l.quadros)).toHaveLength(24)
  })

  it('agrupar por cor: P&B separado das coloridas', () => {
    const lista = fotos20misto()
    const d = preencherAutomaticamente(lista, 6, g, false, ESTILOS[0], { agrupar: 'cor' })
    for (const l of d.laminas) {
      const tipos = new Set(l.quadros.map((q) => lista.find((f) => f.id === q.fotoId)!.monocromatica))
      expect(tipos.size).toBeLessThanOrEqual(1)
    }
  })

  it('mais grupos que lâminas: junta grupos e usa todas as fotos', () => {
    const lista = Array.from({ length: 10 }, (_, k) => comHora(2, `2026-10-02T${String(8 + k).padStart(2, '0')}:00:00Z`, `c${k}`)).flat()
    const d = preencherAutomaticamente(lista, 3, g, false, ESTILOS[0], { agrupar: 'captura' })
    expect(d.laminas.flatMap((l) => l.quadros)).toHaveLength(20)
  })

  it('reutilização alta repete mais templates que a baixa', () => {
    const lista = fotos(80)
    const familias = (r: 'baixa' | 'alta') => {
      const d = preencherAutomaticamente(lista, 20, g, false, ESTILOS[0], { reutilizacao: r })
      return new Set(d.laminas.map((l) => l.quadros.map((q) => `${Math.round(q.x)}:${Math.round(q.y)}:${Math.round(q.w)}`).sort().join('|'))).size
    }
    expect(familias('alta')).toBeLessThanOrEqual(familias('baixa'))
  })

  it('respeitar a ordem: as fotos entram na sequência dada', () => {
    const fs = fotos(9)
    const d = preencherAutomaticamente(fs, 3, g, false, ESTILOS[0], { respeitarOrdem: true })
    const usadas = d.laminas.flatMap((l) => l.quadros.map((q) => q.fotoId))
    expect(new Set(usadas)).toEqual(new Set(fs.map((f) => f.id)))
    // a 1ª lâmina contém as primeiras fotos
    const primeira = d.laminas[0].quadros.map((q) => q.fotoId)
    expect(primeira).toContain('f0')
  })

  it('Smart Layout respeitando ordem: 1ª foto no 1º quadro de leitura', () => {
    const fs = fotos(4)
    for (const v of variantesDeLayout(fs, g, 5, undefined, { respeitarOrdem: true })) {
      const primeiro = [...v.quadros].sort((a, b) => (a.x + a.w / 2 < g.paginaW ? 0 : 1) - (b.x + b.w / 2 < g.paginaW ? 0 : 1) || a.y - b.y || a.x - b.x)[0]
      expect(primeiro.fotoId).toBe('f0')
    }
  })
})

describe('Montagem automática cronológica — linha do tempo, momentos e favoritas', () => {
  const g = geo('30x30', 'quadrado')
  const T0 = Date.parse('2026-10-02T14:00:00Z')
  /** Foto de câmera: nome sequencial, horário em segundos a partir de T0 (null = sem EXIF), horizontal ou vertical. */
  const foto = (n: number, seg: number | null, extra: Partial<FotoEditor> = {}): FotoEditor => ({
    id: `IMG_${String(n).padStart(4, '0')}`,
    url: '',
    nome: `IMG_${String(n).padStart(4, '0')}.jpg`,
    largura: n % 3 === 1 ? 4000 : 6000,
    altura: n % 3 === 1 ? 6000 : 4000,
    capturadaEm: seg === null ? null : new Date(T0 + seg * 1000).toISOString(),
    ...extra,
  })
  const idsPorLamina = (d: { laminas: { quadros: { fotoId: string | null }[] }[] }) => d.laminas.map((l) => l.quadros.map((q) => q.fotoId!))
  const embaralhar = <T,>(l: T[]) => l.map((x, i) => [x, (i * 7919) % 101] as const).sort((a, b) => a[1] - b[1]).map(([x]) => x)

  it('ordem só pela captura: favorita e obrigatória não furam a fila', () => {
    const lista = Array.from({ length: 8 }, (_, i) => foto(i, i * 600, i === 6 ? { favorita: true } : i === 7 ? { obrigatoria: true } : {}))
    expect(ordenarCronologicamente(embaralhar(lista)).map((f) => f.id)).toEqual(lista.map((f) => f.id))
    const d = preencherAutomaticamente(embaralhar(lista), 2, g, false, ESTILOS[0], { agrupar: 'captura', cronologico: true })
    const [primeira, segunda] = idsPorLamina(d)
    const pos = (id: string) => lista.findIndex((f) => f.id === id)
    expect(Math.max(...primeira.map(pos))).toBeLessThan(Math.min(...segunda.map(pos)))
    expect(primeira).not.toContain('IMG_0006')
    // Sem o modo cronológico, a ordem editorial antiga ainda põe obrigatória e favorita na abertura.
    const antigo = idsPorLamina(preencherAutomaticamente(embaralhar(lista), 2, g, false, ESTILOS[0], { agrupar: 'captura' }))
    expect(antigo[0]).toEqual(expect.arrayContaining(['IMG_0006', 'IMG_0007']))
  })

  it('rajada de segundos não se divide entre lâminas quando há um intervalo grande perto', () => {
    // 0–30 min a cada 10 min; rajada IMG_0004–0006 em 20 s; depois a cada 10 min.
    const segundos = [0, 600, 1200, 1800, 1860, 1870, 1880, 2480, 3080, 3680]
    const lista = segundos.map((s, i) => foto(i, s))
    // Clássico, 2 lâminas: o ritmo pede [6, 4] — cortaria a rajada entre 0005 e 0006.
    expect(contagensPorMomento(lista, [6, 4])).toEqual([7, 3])
    const d = preencherAutomaticamente(lista, 2, g, false, ESTILOS[0], { agrupar: 'captura', cronologico: true })
    const [primeira, segunda] = idsPorLamina(d)
    expect(primeira).toEqual(expect.arrayContaining(['IMG_0004', 'IMG_0005', 'IMG_0006']))
    expect(segunda).toHaveLength(3)
    // Modo antigo: fatia fixa no ritmo, a rajada se parte.
    const antigo = idsPorLamina(preencherAutomaticamente(lista, 2, g, false, ESTILOS[0], { agrupar: 'captura' }))
    expect(antigo.map((l) => l.length)).toEqual([6, 4])
  })

  it('cortes ficam dentro de ±1 do ritmo, entre 1 e 16, e somam o total', () => {
    const lista = Array.from({ length: 40 }, (_, i) => foto(i, i * 30 + (i % 5 === 0 ? 900 * i : 0)))
    const alvo = [3, 2, 4, 2, 3, 3, 2, 4, 2, 3, 3, 2, 4, 3]
    const r = contagensPorMomento(lista, alvo)
    expect(r.reduce((a, b) => a + b, 0)).toBe(40)
    r.forEach((c, i) => {
      expect(Math.abs(c - alvo[i])).toBeLessThanOrEqual(1)
      expect(c).toBeGreaterThanOrEqual(1)
    })
  })

  it('lâmina com favorita fica com uma foto a menos e a favorita no maior quadro', () => {
    // Intervalos iguais: só a favorita decide. Clássico, 6 fotos em 2 lâminas → ritmo [4, 2].
    const lista = Array.from({ length: 6 }, (_, i) => foto(i, i * 120, i === 1 ? { favorita: true } : {}))
    expect(contagensPorMomento(lista, [4, 2])).toEqual([3, 3])
    const d = preencherAutomaticamente(lista, 2, g, false, ESTILOS[0], { agrupar: 'captura', cronologico: true })
    expect(idsPorLamina(d).map((l) => l.length)).toEqual([3, 3])
    const q = d.laminas[0].quadros
    const maior = Math.max(...q.map((x) => x.w * x.h))
    const daFavorita = q.find((x) => x.fotoId === 'IMG_0001')!
    expect(daFavorita.w * daFavorita.h).toBeGreaterThanOrEqual(maior * 0.99)
  })

  it('álbum inteiro: toda lâmina com favorita a põe no maior quadro, sem tirar ninguém da linha do tempo', () => {
    const lista = Array.from({ length: 60 }, (_, i) => foto(i, i * 45 + Math.floor(i / 6) * 1200, i % 7 === 3 ? { favorita: true } : {}))
    for (const estilo of ESTILOS) {
      const d = preencherAutomaticamente(embaralhar(lista), 15, g, false, estilo, { agrupar: 'captura', cronologico: true })
      const ordem = idsPorLamina(d).map((ids) => ids.map((id) => lista.findIndex((f) => f.id === id)))
      expect(ordem.flat().sort((a, b) => a - b)).toEqual(lista.map((_, i) => i))
      for (let i = 1; i < ordem.length; i++) if (ordem[i].length && ordem[i - 1].length) expect(Math.min(...ordem[i])).toBeGreaterThan(Math.max(...ordem[i - 1]))
      for (const l of d.laminas) {
        if (!l.quadros.some((q) => lista.find((f) => f.id === q.fotoId)?.favorita)) continue
        const maior = Math.max(...l.quadros.map((q) => q.w * q.h))
        const emDestaque = l.quadros.some((q) => lista.find((f) => f.id === q.fotoId)?.favorita && q.w * q.h >= maior * 0.99)
        expect(emDestaque, `${estilo.id}: favorita no maior quadro`).toBe(true)
      }
    }
  })

  it('fotos sem data ficam logo depois da vizinha de nome datada (as primeiras abrem o álbum)', () => {
    const lista = [
      foto(0, null), // antes de qualquer datada: abre
      foto(1, 0),
      foto(2, 300),
      foto(3, null), // segue a 0002
      foto(4, 900),
      foto(5, 600), // tirada antes da 0004: passa na frente
      foto(6, null), // segue a 0005 (vizinha de nome), mesmo ela tendo mudado de lugar
    ]
    expect(ordenarCronologicamente(embaralhar(lista)).map((f) => f.id)).toEqual(['IMG_0000', 'IMG_0001', 'IMG_0002', 'IMG_0003', 'IMG_0005', 'IMG_0006', 'IMG_0004'])
    // Nenhuma data: fica a ordem do nome.
    const semData = [foto(10, null), foto(2, null), foto(1, null)]
    expect(ordenarCronologicamente(semData).map((f) => f.id)).toEqual(['IMG_0001', 'IMG_0002', 'IMG_0010'])
  })

  it('respeitar a ordem vence o cronológico', () => {
    const lista = [foto(2, 600), foto(1, 0), foto(3, 1200), foto(0, 1800)]
    const d = preencherAutomaticamente(lista, 1, g, false, ESTILOS[0], { cronologico: true, respeitarOrdem: true })
    const lidos = [...d.laminas[0].quadros].sort((a, b) => (a.x + a.w / 2 < g.paginaW ? 0 : 1) - (b.x + b.w / 2 < g.paginaW ? 0 : 1) || a.y - b.y || a.x - b.x)
    expect(lidos[0].fotoId).toBe('IMG_0002')
  })

  it('cronologico: false é exatamente o modo antigo', () => {
    const lista = Array.from({ length: 30 }, (_, i) => foto(i, i * 200, i % 4 === 0 ? { favorita: true } : {}))
    const a = idsPorLamina(preencherAutomaticamente(lista, 8, g, false, ESTILOS[1], { agrupar: 'captura' }))
    const b = idsPorLamina(preencherAutomaticamente(lista, 8, g, false, ESTILOS[1], { agrupar: 'captura', cronologico: false }))
    expect(b).toEqual(a)
  })
})

function fotos20misto(): FotoEditor[] {
  return Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, url: '', nome: `m${i}`, largura: 6000, altura: 4000, monocromatica: i % 3 === 0 }))
}
