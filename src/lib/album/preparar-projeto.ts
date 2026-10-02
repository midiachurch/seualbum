import { LIMITES } from '@/lib/album/documento'
import { laminaEmCm, normalizarFormato, normalizarOrientacao } from '@/lib/resolucao'
import type { AlbumOrientationValue } from '@/types/platform'

/**
 * Decide, sem banco, com que dados abrir o editor de um projeto — e nunca
 * trava por um dado torto que dá para consertar. O formato vem, nesta ordem:
 * do `album_config` do projeto, do produto vinculado, ou da escolha feita na
 * tela; só pergunta quando nenhum deles serve. Nome, tipo e número de
 * lâminas são ajustados aos limites do banco (0027) em vez de dar erro.
 */

export type EntradaDoProjeto = {
  nome: unknown
  numero: unknown
  albumConfig: unknown
  produtoFormato?: unknown
  laminasInclusas: unknown
}

export type DadosDoLayout = {
  nome: string
  tipo: string | null
  formato: string
  orientacao: AlbumOrientationValue
  laminas: number
  /** De onde veio o formato — "escolha" e "produto" também são gravados no projeto. */
  origemFormato: 'projeto' | 'produto' | 'escolha'
}

export type Preparo = { ok: true; dados: DadosDoLayout } | { ok: false; precisaFormato: true; erro: string; sugestao: string }

const FORMATO_SUGERIDO = '30x30'

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** Nome dentro de 2–120 caracteres; sem nome útil, "Projeto #1041". */
export function nomeDoLayout(nome: unknown, numero: unknown) {
  const limpo = String(nome ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (limpo.length >= 2) return limpo.slice(0, 120)
  const n = Number(numero)
  return Number.isFinite(n) && n > 0 ? `Projeto #${n}` : 'Álbum sem nome'
}

/** Lâminas iniciais entre 1 e o limite do documento; aceita número em texto. */
export function laminasIniciais(v: unknown) {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, LIMITES.laminas)
}

export function prepararLayoutDoProjeto(
  p: EntradaDoProjeto,
  escolha?: { formato: unknown; orientacao: unknown },
): Preparo {
  const cfg = objeto(p.albumConfig)
  const candidatos: { formato: string; orientacao: unknown; origem: DadosDoLayout['origemFormato'] }[] = [
    { formato: normalizarFormato(cfg.formato), orientacao: cfg.orientacao, origem: 'projeto' },
    { formato: normalizarFormato(p.produtoFormato), orientacao: cfg.orientacao, origem: 'produto' },
  ]
  if (escolha) candidatos.push({ formato: normalizarFormato(escolha.formato), orientacao: escolha.orientacao, origem: 'escolha' })

  const usado = candidatos.find((c) => c.formato && laminaEmCm({ formato: c.formato, orientacao: normalizarOrientacao(c.orientacao, c.formato) }))
  if (!usado) {
    return {
      ok: false,
      precisaFormato: true,
      erro: escolha ? 'Formato inválido: use largura x altura em cm, de 5 a 100 (ex.: 30x30).' : 'Este projeto ainda não tem o formato do álbum.',
      sugestao: normalizarFormato(p.produtoFormato) || FORMATO_SUGERIDO,
    }
  }

  const tipo = typeof cfg.tipo === 'string' && cfg.tipo.trim() ? cfg.tipo.trim().slice(0, 40) : null
  return {
    ok: true,
    dados: {
      nome: nomeDoLayout(p.nome, p.numero),
      tipo,
      formato: usado.formato,
      orientacao: normalizarOrientacao(usado.orientacao, usado.formato),
      laminas: laminasIniciais(p.laminasInclusas),
      origemFormato: usado.origem,
    },
  }
}
