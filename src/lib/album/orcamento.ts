import { LIMITES, type DocumentoAlbum } from '@/lib/album/documento'

/**
 * Orçamento de desempenho por documento de álbum (D04).
 *
 * `recomendado` = acima disso o editor avisa que pode ficar pesado;
 * `limite` = teto duro (CHECK do banco, 0027, ou LIMITES do documento).
 * Os valores vêm da medição em `orcamento.test.ts` (números em
 * docs/operacao-digital/modulos/DESIGN-SELECAO.md): um álbum de 200 lâminas e
 * 1000 fotos tem ~400 KB de JSON e abre (parse + normalização + pré-checagem)
 * em ~2 ms de CPU — o gargalo real é o canvas e as imagens, não o documento.
 */
export const ORCAMENTO = {
  laminas: { recomendado: 80, limite: LIMITES.laminas },
  /** Quadros de foto no documento todo. */
  quadros: { recomendado: 500, limite: LIMITES.laminas * LIMITES.quadrosPorLamina },
  /** Fotos distintas citadas (e fotos de uma seleção que vira álbum). */
  fotos: { recomendado: 600, limite: 1000 },
  /** Bytes do JSON do documento; o limite é o CHECK `octet_length(documento::text) < 2000000`. */
  bytes: { recomendado: 600_000, limite: 2_000_000 },
  /** Milissegundos de CPU (Node/V8) para abrir: JSON.parse + normalizarDocumento + verificarAlbum. */
  aberturaMs: { alvo: 50, falha: 100 },
  /** Auto-montagem (preencherAutomaticamente) de 1000 fotos / 200 lâminas, uma execução fria. */
  montagemMs: { alvo: 1000, falha: 2000 },
} as const

export type NivelOrcamento = 'ok' | 'aviso' | 'excedido'
export type ItemOrcamento = { metrica: 'laminas' | 'quadros' | 'fotos' | 'bytes'; valor: number; recomendado: number; limite: number; nivel: NivelOrcamento }
export type AvaliacaoOrcamento = { nivel: NivelOrcamento; itens: ItemOrcamento[] }

const PIOR: Record<NivelOrcamento, number> = { ok: 0, aviso: 1, excedido: 2 }

function nivelDe(valor: number, m: { recomendado: number; limite: number }): NivelOrcamento {
  return valor > m.limite ? 'excedido' : valor > m.recomendado ? 'aviso' : 'ok'
}

export function medirDocumento(doc: DocumentoAlbum) {
  const fotos = new Set<string>()
  let quadros = 0
  for (const l of doc.laminas) {
    quadros += l.quadros.length
    for (const q of l.quadros) if (q.fotoId) fotos.add(q.fotoId)
    if (l.fundoImagem) fotos.add(l.fundoImagem.fotoId)
  }
  return { laminas: doc.laminas.length, quadros, fotos: fotos.size, bytes: new TextEncoder().encode(JSON.stringify(doc)).length }
}

/** Compara o documento com o orçamento; `excedido` = o banco recusaria ou o editor trunca. */
export function avaliarOrcamento(doc: DocumentoAlbum): AvaliacaoOrcamento {
  const m = medirDocumento(doc)
  const itens: ItemOrcamento[] = (['laminas', 'quadros', 'fotos', 'bytes'] as const).map((metrica) => ({
    metrica,
    valor: m[metrica],
    recomendado: ORCAMENTO[metrica].recomendado,
    limite: ORCAMENTO[metrica].limite,
    nivel: nivelDe(m[metrica], ORCAMENTO[metrica]),
  }))
  return { nivel: itens.reduce<NivelOrcamento>((p, i) => (PIOR[i.nivel] > PIOR[p] ? i.nivel : p), 'ok'), itens }
}

/** Aviso para quem vai criar um álbum a partir de uma seleção grande; nulo dentro do recomendado. */
export function avisoDeOrcamentoDaSelecao(totalFotos: number): string | null {
  if (totalFotos > ORCAMENTO.fotos.limite) return `Seleção acima de ${ORCAMENTO.fotos.limite} fotos: não cabe em um álbum.`
  if (totalFotos > ORCAMENTO.fotos.recomendado) {
    return `Seleção grande (${totalFotos} fotos, recomendado até ${ORCAMENTO.fotos.recomendado}): o editor pode ficar mais lento. Considere dividir em dois álbuns.`
  }
  return null
}
