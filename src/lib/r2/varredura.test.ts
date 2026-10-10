import { describe, expect, it, vi } from 'vitest'
import { varrerOrfaos, type DependenciasVarredura, type ObjetoListado } from './varredura'

/**
 * Varredura de órfãos do R2 (migration 0040) com o bucket e o banco
 * simulados: só sai do R2 o que é do app, velho e que o banco diz que ninguém
 * cita. Na dúvida, fica.
 */

const AGORA = new Date('2026-10-09T12:00:00Z')
const dias = (n: number) => new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000)
const P = '11111111-1111-4111-8111-111111111111'

function cenario(bucket: Partial<Record<'privado' | 'publico', ObjetoListado[]>>, semReferencia: (keys: string[]) => string[]) {
  const removidas: { keys: string[]; alvo: string }[] = []
  const perguntas: string[][] = []
  const deps: DependenciasVarredura = {
    listar: vi.fn<DependenciasVarredura['listar']>(async (prefixo, alvo) => ({ objetos: (bucket[alvo] ?? []).filter((o) => o.key.startsWith(prefixo)), proximo: null })),
    semReferencia: vi.fn<DependenciasVarredura['semReferencia']>(async (keys) => (perguntas.push(keys), semReferencia(keys))),
    remover: vi.fn<DependenciasVarredura['remover']>(async (keys, alvo) => void removidas.push({ keys, alvo })),
  }
  return { deps, removidas, perguntas }
}

describe('varrerOrfaos', () => {
  it('apaga só o que é velho, do app e sem referência', async () => {
    const orfa = `projetos/${P}/fotos/${P}-apagada.jpg`
    const citada = `projetos/${P}/fotos/${P}-em-uso.jpg`
    const { deps, removidas, perguntas } = cenario(
      {
        privado: [
          { key: orfa, gravadoEm: dias(30) },
          { key: citada, gravadoEm: dias(30) },
          { key: `projetos/${P}/fotos/${P}-nova.jpg`, gravadoEm: dias(1) }, // envio recente
          { key: `projetos/${P}/fotos/sem-data.jpg`, gravadoEm: null },
          { key: `projetos/${P}/fotos/com espaço.jpg`, gravadoEm: dias(30) }, // formato estranho
        ],
      },
      (keys) => keys.filter((k) => k !== citada),
    )
    const r = await varrerOrfaos(deps, { alvos: ['privado'], agora: AGORA })
    expect(perguntas).toEqual([[orfa, citada]])
    expect(removidas).toEqual([{ keys: [orfa], alvo: 'privado' }])
    expect(r).toEqual({ examinadas: 5, candidatas: 2, orfas: 1, apagadas: 1 })
  })

  it('só lista os prefixos do app em cada bucket', async () => {
    const { deps } = cenario({}, () => [])
    await varrerOrfaos(deps, { alvos: ['privado', 'publico'], agora: AGORA })
    const listados = vi.mocked(deps.listar).mock.calls.map(([prefixo, alvo]) => `${alvo}:${prefixo}`)
    expect(listados).toEqual(['privado:pedidos/', 'privado:projetos/', 'privado:albuns/', 'publico:vitrine/', 'publico:logos/'])
  })

  it('nunca apaga uma chave que não foi perguntada ao banco', async () => {
    const orfa = `albuns/${P}/${P}-a.jpg`
    const { deps, removidas } = cenario({ privado: [{ key: orfa, gravadoEm: dias(30) }] }, () => [orfa, `projetos/${P}/fotos/${P}-outra.jpg`])
    await varrerOrfaos(deps, { alvos: ['privado'], agora: AGORA })
    expect(removidas).toEqual([{ keys: [orfa], alvo: 'privado' }])
  })

  it('dry run: conta, não apaga', async () => {
    const orfa = `vitrine/${P}-banner.webp`
    const { deps, removidas } = cenario({ publico: [{ key: orfa, gravadoEm: dias(30) }] }, (keys) => keys)
    const r = await varrerOrfaos(deps, { alvos: ['publico'], agora: AGORA, dryRun: true })
    expect(r).toEqual({ examinadas: 1, candidatas: 1, orfas: 1, apagadas: 0 })
    expect(removidas).toEqual([])
  })

  it('erro do banco interrompe sem apagar nada', async () => {
    const { deps, removidas } = cenario({ privado: [{ key: `pedidos/${P}/${P}/${P}-a.jpg`, gravadoEm: dias(30) }] }, () => {
      throw new Error('timeout')
    })
    await expect(varrerOrfaos(deps, { alvos: ['privado'], agora: AGORA })).rejects.toThrow('timeout')
    expect(removidas).toEqual([])
  })

  it('pergunta ao banco em lotes e respeita o limite de páginas', async () => {
    const keys = Array.from({ length: 5 }, (_, i) => `projetos/${P}/fotos/${P}-${i}.jpg`)
    const { deps, perguntas } = cenario({ privado: keys.map((key) => ({ key, gravadoEm: dias(30) })) }, () => [])
    await varrerOrfaos(deps, { alvos: ['privado'], agora: AGORA, lote: 2 })
    expect(perguntas.map((p) => p.length)).toEqual([2, 2, 1])

    let paginas = 0
    const infinito: DependenciasVarredura = {
      listar: async () => (paginas++, { objetos: [], proximo: 'mais' }),
      semReferencia: async () => [],
      remover: async () => {},
    }
    await varrerOrfaos(infinito, { alvos: ['privado'], agora: AGORA, maxPaginas: 3 })
    expect(paginas).toBe(9) // 3 prefixos × 3 páginas
  })
})
