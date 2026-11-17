export type EntregaSelecao = { id: string; revisao: number; total: number }
export type FotoSelecionada = { foto_id: string; bucket: string; storage_path: string; nome_original: string | null }
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function entradaValida(projetoId: string, fotoIds: string[], revisao: number, chave: string) {
  return typeof projetoId === 'string' && UUID.test(projetoId) && typeof chave === 'string' && UUID.test(chave)
    && Number.isSafeInteger(revisao) && revisao >= 0 && Array.isArray(fotoIds) && fotoIds.length > 0 && fotoIds.length <= 1000
    && fotoIds.every((id) => typeof id === 'string' && UUID.test(id)) && new Set(fotoIds).size === fotoIds.length
}
export function entregaValida(value: unknown): value is EntregaSelecao {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<EntregaSelecao>
  return typeof v.id === 'string' && UUID.test(v.id) && Number.isSafeInteger(v.revisao) && v.revisao! > 0 && Number.isSafeInteger(v.total) && v.total! > 0
}
/** CSV mantém nomes originais desconhecidos vazios e neutraliza fórmulas ao abrir em planilhas. */
export function manifestoCsv(fotos: FotoSelecionada[]) {
  const cell = (s: string) => `"${(/^[=+@\-\t\r\n]/.test(s) ? "'" : '') + s.replaceAll('"', '""')}"`
  return ['foto_id,nome_original,bucket,storage_path', ...fotos.map((foto) => [foto.foto_id,foto.nome_original ?? '',foto.bucket,foto.storage_path].map(cell).join(','))].join('\r\n')
}
