import { chaveNoFormatoDoApp, PREFIXOS_DO_APP } from './chaves'
import type { Alvo } from './cliente'

/**
 * Varredura de órfãos do R2 (chamada pelo Cron em /api/cron/limpar-fotos-r2).
 *
 * Apaga um objeto só quando TUDO isto vale:
 *   - está num prefixo que o app grava (`PREFIXOS_DO_APP`) e tem o formato
 *     de chave do app (`chaveNoFormatoDoApp`);
 *   - foi gravado há mais de `janelaDias` (envio em andamento, reserva de 24h
 *     ou confirmação atrasada nunca é tocada);
 *   - o banco diz que nenhuma coluna o cita (`r2_chaves_sem_referencia`,
 *     migration 0040: fotos, versoes_laminas, media_assets, logos, JSON do
 *     editor, pedidos_fotos_r2, reservas…, nem a pasta acima dele).
 * Na dúvida, fica: data ausente, formato estranho, erro do banco → não apaga.
 *
 * Sem SDK nem banco aqui dentro (tudo injetado), para poder ser testado.
 */

export type ObjetoListado = { key: string; gravadoEm: Date | null }

export type DependenciasVarredura = {
  listar: (prefixo: string, alvo: Alvo, continuacao: string | null) => Promise<{ objetos: ObjetoListado[]; proximo: string | null }>
  /** Das chaves dadas, as que nada no banco cita. Lança se a consulta falhar. */
  semReferencia: (keys: string[]) => Promise<string[]>
  remover: (keys: string[], alvo: Alvo) => Promise<void>
}

export type OpcoesVarredura = {
  alvos: Alvo[]
  agora: Date
  janelaDias?: number
  /** Páginas de 1000 objetos lidas por prefixo em cada execução. */
  maxPaginas?: number
  /** Chaves por consulta ao banco (cada consulta lê todas as colunas de texto uma vez). */
  lote?: number
  dryRun?: boolean
}

export const JANELA_ORFAOS_DIAS = 7
const MAX_PAGINAS = 20
const LOTE_CONSULTA = 5000

export type ResultadoVarredura = { examinadas: number; candidatas: number; orfas: number; apagadas: number }

export async function varrerOrfaos(deps: DependenciasVarredura, opcoes: OpcoesVarredura): Promise<ResultadoVarredura> {
  const janelaMs = (opcoes.janelaDias ?? JANELA_ORFAOS_DIAS) * 24 * 60 * 60 * 1000
  const limite = opcoes.agora.getTime() - janelaMs
  const maxPaginas = opcoes.maxPaginas ?? MAX_PAGINAS
  const lote = opcoes.lote ?? LOTE_CONSULTA
  const total: ResultadoVarredura = { examinadas: 0, candidatas: 0, orfas: 0, apagadas: 0 }

  for (const alvo of opcoes.alvos) {
    const candidatas: string[] = []
    for (const prefixo of PREFIXOS_DO_APP[alvo]) {
      let continuacao: string | null = null
      for (let pagina = 0; pagina < maxPaginas; pagina++) {
        const { objetos, proximo } = await deps.listar(prefixo, alvo, continuacao)
        total.examinadas += objetos.length
        for (const o of objetos) {
          if (!o.key.startsWith(prefixo) || !chaveNoFormatoDoApp(o.key)) continue
          if (!o.gravadoEm || Number.isNaN(o.gravadoEm.getTime()) || o.gravadoEm.getTime() >= limite) continue
          candidatas.push(o.key)
        }
        if (!proximo) break
        continuacao = proximo
      }
    }
    total.candidatas += candidatas.length

    for (let i = 0; i < candidatas.length; i += lote) {
      const fatia = candidatas.slice(i, i + lote)
      const pedidas = new Set(fatia)
      // Só apaga o que foi perguntado: uma resposta estranha do banco não vira remoção.
      const orfas = [...new Set(await deps.semReferencia(fatia))].filter((k) => pedidas.has(k))
      total.orfas += orfas.length
      if (opcoes.dryRun || orfas.length === 0) continue
      await deps.remover(orfas, alvo)
      total.apagadas += orfas.length
    }
  }
  return total
}
