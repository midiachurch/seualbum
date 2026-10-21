/**
 * Regras do reconhecimento facial (migration 0042) sem dependência de AWS —
 * usadas pelas rotas, pelo Cron e pelos testes.
 */

/** Fotos de multidão sujam o índice: o Rekognition guarda só os 15 maiores rostos. */
export const MAX_ROSTOS_POR_FOTO = 15

/** Retenção do índice (LGPD): a coleção some 60 dias depois da ativação. */
export const DIAS_RETENCAO = 60

/** Similaridade mínima (0–100) para uma foto entrar no resultado da selfie. */
export const LIMIAR_SIMILARIDADE = 85

/** Lado maior da cópia que vai para o Rekognition (o original no R2 não muda). */
export const LADO_MAXIMO_ANALISE = 1920

/** Originais acima disto não são baixados do R2 para indexar. */
export const TAMANHO_MAXIMO_ORIGINAL = 80 * 1024 * 1024

/** A selfie chega já reduzida pelo navegador; o corpo da função da Vercel aceita ~4,5 MB. */
export const TAMANHO_MAXIMO_SELFIE = 4 * 1024 * 1024
export const MIMES_SELFIE = new Set(['image/jpeg', 'image/png'])

/** Formatos que a cópia de análise consegue ler (HEIC/HEIF pelo libheif, ver `indexacao.ts`). */
export const EXTENSOES_INDEXAVEIS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'])

export const EVENTOS_ANALITICOS = ['facial_search_initiated', 'facial_search_success', 'checkout_from_ai_gallery'] as const
export type EventoAnalitico = (typeof EVENTOS_ANALITICOS)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Prefixo das coleções deste banco: `seualbum-{ref do Supabase}-`. Com o ref,
 * dois ambientes na mesma conta AWS (produção e um Supabase de teste) nunca
 * apagam as coleções um do outro na varredura do Cron.
 */
export function prefixoColecoes(supabaseUrl: string | undefined): string {
  let ref = 'local'
  try {
    ref = new URL(supabaseUrl ?? '').hostname.split('.')[0] || 'local'
  } catch {}
  return `seualbum-${ref.replace(/[^A-Za-z0-9_.-]/g, '')}-`
}

export function nomeDaColecao(prefixo: string, projetoId: string): string {
  return `${prefixo}${projetoId}`
}

/** Projeto da coleção, ou `null` se ela não é deste ambiente. */
export function projetoDaColecao(prefixo: string, colecao: string): string | null {
  if (!colecao.startsWith(prefixo)) return null
  const id = colecao.slice(prefixo.length)
  return UUID.test(id) ? id.toLowerCase() : null
}

const extensao = (key: string) => key.split('.').pop()?.toLowerCase() ?? ''

export function extensaoIndexavel(key: string): boolean {
  return EXTENSOES_INDEXAVEIS.has(extensao(key))
}

export function ehHeic(key: string): boolean {
  return extensao(key) === 'heic' || extensao(key) === 'heif'
}

export function ehEventoAnalitico(valor: unknown): valor is EventoAnalitico {
  return typeof valor === 'string' && (EVENTOS_ANALITICOS as readonly string[]).includes(valor)
}

export type ErroSelfie = 'sem_rosto' | 'formato' | 'indisponivel'

/**
 * Traduz o erro do SearchFacesByImage. `InvalidParameterException` é o que o
 * Rekognition devolve quando não acha rosto na selfie (borrada, escura, de lado).
 * Coleção inexistente não é erro: o projeto só não tem rostos ainda.
 */
export function classificarErroBusca(nome: string | undefined): ErroSelfie | 'sem_colecao' {
  switch (nome) {
    case 'InvalidParameterException':
      return 'sem_rosto'
    case 'InvalidImageFormatException':
    case 'ImageTooLargeException':
      return 'formato'
    case 'ResourceNotFoundException':
      return 'sem_colecao'
    default:
      return 'indisponivel'
  }
}

/** Fotos únicas na ordem da melhor similaridade, só acima do limiar. */
export function fotosDosRostos(
  encontrados: { faceId: string; similaridade: number }[],
  fotoDoRosto: Map<string, string>,
  limiar = LIMIAR_SIMILARIDADE,
): string[] {
  const melhor = new Map<string, number>()
  for (const { faceId, similaridade } of encontrados) {
    const foto = fotoDoRosto.get(faceId)
    if (!foto || similaridade < limiar) continue
    melhor.set(foto, Math.max(melhor.get(foto) ?? 0, similaridade))
  }
  return [...melhor.entries()].sort((a, b) => b[1] - a[1]).map(([foto]) => foto)
}
