/**
 * Regras puras das fotos do pedido no Cloudflare R2: formato da chave e
 * validação do que o navegador pede para enviar. Sem SDK nem `server-only`,
 * para poder ser testado e reaproveitado.
 *
 * Chave: pedidos/{userId}/{chaveIdempotencia}/{idArquivo}-{nome}
 * — a mesma pasta do bucket `pedidos_fotos` (migration 0011), com o prefixo
 * `pedidos/` para dividir o bucket do R2 com outros tipos de arquivo.
 */

export const PREFIXO_PEDIDOS = 'pedidos'
/** Valor de `fotos.bucket` / `versoes_laminas.bucket` quando o arquivo está no R2. */
export const BUCKET_R2 = 'r2'
export const TAMANHO_MAXIMO_FOTO_R2 = 50 * 1024 * 1024 // mesmo limite do bucket do Supabase

export const MIMES_FOTO_PEDIDO = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID_RE.test(valor)
}

/** Chaves sem acento nem símbolos: seguras em URL assinada e em qualquer SO no download. */
export function nomeSeguro(nome: string) {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(-80) || 'foto'
  )
}

export function pastaPedidoR2(userId: string, chave: string) {
  return `${PREFIXO_PEDIDOS}/${userId}/${chave}`
}

export function chaveFotoPedido(p: { userId: string; chave: string; idArquivo: string; nome: string }) {
  return `${pastaPedidoR2(p.userId, p.chave)}/${p.idArquivo}-${nomeSeguro(p.nome)}`
}

/**
 * Lê uma chave de foto de pedido e confere se é do usuário. `null` = chave
 * malformada ou de outra pessoa (nunca assinar/registrar nesse caso).
 */
export function lerChaveFotoPedido(key: unknown, userId: string): { chave: string } | null {
  if (typeof key !== 'string' || key.includes('..')) return null
  const partes = key.split('/')
  if (partes.length !== 4) return null
  const [prefixo, dono, chave, arquivo] = partes
  if (prefixo !== PREFIXO_PEDIDOS || dono !== userId || !ehUuid(chave)) return null
  if (!/^[0-9a-f-]{36}-[a-zA-Z0-9._-]{1,80}$/i.test(arquivo)) return null
  return { chave }
}

export type PedidoDeEnvio = { chave: string; idArquivo: string; nome: string; tipo: string; tamanho: number }

/** Valida o corpo de POST /api/uploads/pedido-foto. */
export function validarPedidoDeEnvio(corpo: unknown): { ok: true; dados: PedidoDeEnvio } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>
  if (!ehUuid(c.chave)) return { ok: false, erro: 'Rascunho inválido.' }
  if (!ehUuid(c.idArquivo)) return { ok: false, erro: 'Arquivo inválido.' }
  if (typeof c.nome !== 'string' || c.nome.trim() === '' || c.nome.length > 255) {
    return { ok: false, erro: 'Nome de arquivo inválido.' }
  }
  if (typeof c.tipo !== 'string' || !MIMES_FOTO_PEDIDO.has(c.tipo)) {
    return { ok: false, erro: 'Formato não aceito. Use JPG, PNG, HEIC ou WebP.' }
  }
  if (typeof c.tamanho !== 'number' || !Number.isInteger(c.tamanho) || c.tamanho <= 0) {
    return { ok: false, erro: 'Tamanho de arquivo inválido.' }
  }
  if (c.tamanho > TAMANHO_MAXIMO_FOTO_R2) return { ok: false, erro: 'Maior que 50 MB. Envie esta pelo link externo.' }
  return { ok: true, dados: { chave: c.chave, idArquivo: c.idArquivo, nome: c.nome, tipo: c.tipo, tamanho: c.tamanho } }
}

/**
 * EXIF de captura enviado na confirmação, no formato das colunas de
 * `pedidos_fotos_r2` (0031). Qualquer coisa fora do formato vira `null` —
 * o mesmo critério de `_captura_ou_nulo` no banco.
 */
export function lerExifConfirmacao(corpo: unknown): { capturada_em: string | null; camera: string | null } {
  const c = (corpo ?? {}) as Record<string, unknown>
  const captura =
    typeof c.capturadaEm === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(c.capturadaEm)
      ? c.capturadaEm
      : null
  const camera = typeof c.camera === 'string' && c.camera.trim() ? c.camera.trim().slice(0, 80) : null
  return { capturada_em: captura, camera }
}

/* --------------------------------- lâminas -------------------------------- */

// Chave: projetos/{projetoId}/versoes/{lote}/{idArquivo}-{nome} — o `lote` é
// fixo por tentativa de envio de uma versão (reenviar reaproveita o que subiu).
export const PREFIXO_PROJETOS = 'projetos'
export const TAMANHO_MAXIMO_LAMINA_R2 = 50 * 1024 * 1024
// A prova e a gráfica trabalham com JPG por lâmina.
export const MIMES_LAMINA = new Set(['image/jpeg'])

export function pastaLoteLaminas(projetoId: string, lote: string) {
  return `${PREFIXO_PROJETOS}/${projetoId}/versoes/${lote}`
}

export function chaveLamina(p: { projetoId: string; lote: string; idArquivo: string; nome: string }) {
  return `${pastaLoteLaminas(p.projetoId, p.lote)}/${p.idArquivo}-${nomeSeguro(p.nome)}`
}

/** A chave é uma lâmina DESTE projeto e DESTE lote? (nunca registrar arquivo de outra pasta) */
export function chaveEhDoLote(key: unknown, projetoId: string, lote: string): key is string {
  if (typeof key !== 'string' || key.includes('..')) return false
  const pasta = `${pastaLoteLaminas(projetoId, lote)}/`
  if (!key.startsWith(pasta)) return false
  return /^[0-9a-f-]{36}-[a-zA-Z0-9._-]{1,80}$/i.test(key.slice(pasta.length))
}

export type PedidoDeEnvioLamina = { projetoId: string; lote: string; idArquivo: string; nome: string; tipo: string; tamanho: number }

/** Valida o corpo de POST /api/uploads/lamina. */
export function validarEnvioLamina(corpo: unknown): { ok: true; dados: PedidoDeEnvioLamina } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>
  if (!ehUuid(c.projetoId) || !ehUuid(c.lote)) return { ok: false, erro: 'Envio inválido.' }
  if (!ehUuid(c.idArquivo)) return { ok: false, erro: 'Arquivo inválido.' }
  if (typeof c.nome !== 'string' || c.nome.trim() === '' || c.nome.length > 255) return { ok: false, erro: 'Nome de arquivo inválido.' }
  if (typeof c.tipo !== 'string' || !MIMES_LAMINA.has(c.tipo)) return { ok: false, erro: 'As lâminas precisam ser JPG.' }
  if (typeof c.tamanho !== 'number' || !Number.isInteger(c.tamanho) || c.tamanho <= 0) return { ok: false, erro: 'Tamanho de arquivo inválido.' }
  if (c.tamanho > TAMANHO_MAXIMO_LAMINA_R2) return { ok: false, erro: 'Lâmina maior que 50 MB.' }
  return { ok: true, dados: { projetoId: c.projetoId, lote: c.lote, idArquivo: c.idArquivo, nome: c.nome, tipo: c.tipo, tamanho: c.tamanho } }
}
