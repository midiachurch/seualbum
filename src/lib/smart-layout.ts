import type { Photo, SmartLayoutPagina } from '@/types/platform'

/**
 * Pré-diagramação automática ("Smart Layout") — um algoritmo determinístico
 * que organiza as fotos do cliente em páginas antes mesmo de existir uma IA
 * real por trás disso. A equipe de design troca "montar do zero" por
 * "revisar e ajustar um rascunho pronto".
 *
 * Regra: fotos favoritas/obrigatórias primeiro (prioridade editorial), o
 * resto ordenado por nome (proxy de ordem cronológica — os arquivos do
 * cliente costumam vir numerados/datados pelo nome). Cada página recebe de 2
 * a 4 fotos, alternando a densidade para o álbum não ficar visualmente
 * repetitivo, e nunca ultrapassa o limite de páginas contratado.
 */
export function generateSmartLayout(fotos: Photo[], paginasContratadas: number): SmartLayoutPagina[] {
  if (fotos.length === 0 || paginasContratadas <= 0) return []

  const ordenadas = [...fotos].sort((a, b) => {
    const prioridadeA = a.obrigatoria ? 0 : a.favorita ? 1 : 2
    const prioridadeB = b.obrigatoria ? 0 : b.favorita ? 1 : 2
    if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB
    // Com EXIF (migration 0025), a ordem cronológica real vence o nome do arquivo.
    if (a.capturadaEm && b.capturadaEm && a.capturadaEm !== b.capturadaEm) return a.capturadaEm < b.capturadaEm ? -1 : 1
    if (a.capturadaEm && !b.capturadaEm) return -1
    if (!a.capturadaEm && b.capturadaEm) return 1
    return a.grupo.localeCompare(b.grupo) || a.id.localeCompare(b.id)
  })

  // Densidade alternando 3-2-4 por página — evita um álbum monótono onde
  // toda lâmina tem o mesmo número de fotos.
  const DENSIDADES = [3, 2, 4]
  const paginas: SmartLayoutPagina[] = []
  let cursor = 0
  let densidadeIdx = 0

  while (cursor < ordenadas.length && paginas.length < paginasContratadas) {
    const restamPaginas = paginasContratadas - paginas.length
    const restamFotos = ordenadas.length - cursor
    // Na reta final, redistribui o restante pra não sobrar uma última página
    // capenga com 1 foto só.
    const tamanho = restamFotos <= restamPaginas * 4 ? Math.max(2, Math.ceil(restamFotos / restamPaginas)) : DENSIDADES[densidadeIdx % DENSIDADES.length]

    const fatia = ordenadas.slice(cursor, cursor + tamanho)
    paginas.push({ numero: paginas.length + 1, fotoIds: fatia.map((f) => f.id) })
    cursor += fatia.length
    densidadeIdx += 1
  }

  return paginas
}
