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
