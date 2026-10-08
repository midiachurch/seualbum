/**
 * Monta as lâminas de uma nova versão da prova (migration 0032).
 *
 * Versão completa: todas as lâminas são novas (`alterada = true`).
 * Versão parcial: parte da versão-base e só troca o que o designer mexeu —
 *   - `substituir`: a lâmina de ordem N ganha um arquivo novo (mesma posição);
 *   - `remover`: a lâmina de ordem N sai;
 *   - `adicionar`: lâminas novas entram no fim, na ordem dada.
 * As demais são herdadas: mesma imagem (bucket + chave), `alterada = false`,
 * `origem_lamina_id` = a lâmina da base. A ordem final é renumerada de 1 a N.
 *
 * Função pura: quem chama confere antes que os arquivos novos existem.
 */

export const MAX_LAMINAS = 300

export type BucketLamina = 'projetos_fotos' | 'r2'

export type ArquivoNovo = { storagePath: string; largura: number | null; altura: number | null }

export type LaminaBase = {
  id: string
  ordem: number
  bucket: BucketLamina
  storage_path: string
  largura: number | null
  altura: number | null
  eh_capa: boolean
}

export type MudancasParciais = {
  substituir: (ArquivoNovo & { ordem: number })[]
  remover: number[]
  adicionar: ArquivoNovo[]
}

export type LaminaComposta = {
  ordem: number
  bucket: BucketLamina
  storage_path: string
  largura: number | null
  altura: number | null
  eh_capa: boolean
  alterada: boolean
  origem_lamina_id: string | null
}

type Resultado = { ok: true; laminas: LaminaComposta[] } | { ok: false; erro: string }

const BUCKET_NOVO: BucketLamina = 'r2'

const dimensaoOk = (v: number | null) => v === null || (Number.isInteger(v) && v > 0 && v < 100_000)

function arquivoOk(a: ArquivoNovo) {
  return typeof a?.storagePath === 'string' && a.storagePath.length > 0 && dimensaoOk(a.largura) && dimensaoOk(a.altura)
}

/** Versão completa: lâminas em ordem 1..N, todas novas. */
export function comporVersaoCompleta(laminas: (ArquivoNovo & { ordem: number })[], primeiraEhCapa: boolean): Resultado {
  if (!Array.isArray(laminas) || laminas.length === 0) return { ok: false, erro: 'Envie pelo menos uma lâmina.' }
  if (laminas.length > MAX_LAMINAS) return { ok: false, erro: `No máximo ${MAX_LAMINAS} lâminas por versão.` }
  const ordens = laminas.map((l) => l.ordem).sort((a, b) => a - b)
  if (ordens.some((o, i) => o !== i + 1)) return { ok: false, erro: 'Ordem das lâminas inválida.' }
  if (!laminas.every(arquivoOk)) return { ok: false, erro: 'Dimensões de lâmina inválidas.' }
  return {
    ok: true,
    laminas: [...laminas]
      .sort((a, b) => a.ordem - b.ordem)
      .map((l) => ({
        ordem: l.ordem,
        bucket: BUCKET_NOVO,
        storage_path: l.storagePath,
        largura: l.largura,
        altura: l.altura,
        eh_capa: primeiraEhCapa && l.ordem === 1,
        alterada: true,
        origem_lamina_id: null,
      })),
  }
}

export function comporVersaoParcial(base: LaminaBase[], mudancas: MudancasParciais): Resultado {
  if (base.length === 0) return { ok: false, erro: 'A versão-base não tem lâminas.' }
  const substituir = mudancas.substituir ?? []
  const remover = mudancas.remover ?? []
  const adicionar = mudancas.adicionar ?? []
  if (substituir.length + remover.length + adicionar.length === 0) {
    return { ok: false, erro: 'Nenhuma lâmina foi alterada.' }
  }

  const porOrdem = new Map(base.map((l) => [l.ordem, l]))
  const trocas = new Map<number, ArquivoNovo>()
  for (const s of substituir) {
    if (!porOrdem.has(s.ordem)) return { ok: false, erro: `A lâmina ${s.ordem} não existe na versão-base.` }
    if (trocas.has(s.ordem)) return { ok: false, erro: `A lâmina ${s.ordem} foi substituída duas vezes.` }
    if (!arquivoOk(s)) return { ok: false, erro: 'Dimensões de lâmina inválidas.' }
    trocas.set(s.ordem, s)
  }
  const removidas = new Set<number>()
  for (const o of remover) {
    if (!porOrdem.has(o)) return { ok: false, erro: `A lâmina ${o} não existe na versão-base.` }
    if (trocas.has(o)) return { ok: false, erro: `A lâmina ${o} não pode ser substituída e removida ao mesmo tempo.` }
    removidas.add(o)
  }
  if (!adicionar.every(arquivoOk)) return { ok: false, erro: 'Dimensões de lâmina inválidas.' }

  const laminas: Omit<LaminaComposta, 'ordem'>[] = []
  for (const l of [...base].sort((a, b) => a.ordem - b.ordem)) {
    if (removidas.has(l.ordem)) continue
    const nova = trocas.get(l.ordem)
    laminas.push(
      nova
        ? {
            bucket: BUCKET_NOVO,
            storage_path: nova.storagePath,
            largura: nova.largura,
            altura: nova.altura,
            eh_capa: l.eh_capa,
            alterada: true,
            origem_lamina_id: l.id,
          }
        : {
            bucket: l.bucket,
            storage_path: l.storage_path,
            largura: l.largura,
            altura: l.altura,
            eh_capa: l.eh_capa,
            alterada: false,
            origem_lamina_id: l.id,
          },
    )
  }
  for (const a of adicionar) {
    laminas.push({ bucket: BUCKET_NOVO, storage_path: a.storagePath, largura: a.largura, altura: a.altura, eh_capa: false, alterada: true, origem_lamina_id: null })
  }

  if (laminas.length === 0) return { ok: false, erro: 'A versão ficaria sem nenhuma lâmina.' }
  if (laminas.length > MAX_LAMINAS) return { ok: false, erro: `No máximo ${MAX_LAMINAS} lâminas por versão.` }
  // Capa só na primeira posição: se a capa saiu, ninguém herda a marca.
  return { ok: true, laminas: laminas.map((l, i) => ({ ...l, eh_capa: l.eh_capa && i === 0, ordem: i + 1 })) }
}

/** Chaves dos arquivos novos (as que precisam ser conferidas no R2). */
export function arquivosNovos(laminas: LaminaComposta[]) {
  return laminas.filter((l) => l.alterada).map((l) => l.storage_path)
}
