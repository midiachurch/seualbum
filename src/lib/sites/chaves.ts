import { ehUuid, nomeSeguro } from '@/lib/r2/chaves'

/**
 * Mídia do site no bucket PÚBLICO do R2: sites/{organizacaoId}/{idArquivo}-{nome}.
 * A pasta é sempre a da organização do estúdio logado — o servidor decide, e o
 * banco (site_midias, 0070) recusa qualquer chave fora dela. Original privado
 * (pedidos/, projetos/, albuns/) nunca é copiado para cá implicitamente.
 */
export const PREFIXO_SITES = 'sites'
export const MIMES_MIDIA_SITE = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const TAMANHO_MAXIMO_MIDIA_SITE = 10 * 1024 * 1024

export function chaveMidiaSite(p: { organizacaoId: string; idArquivo: string; nome: string }) {
  return `${PREFIXO_SITES}/${p.organizacaoId}/${p.idArquivo}-${nomeSeguro(p.nome)}`
}

/** A chave é de mídia DESTA organização? */
export function chaveEhMidiaDaOrganizacao(key: unknown, organizacaoId: string): key is string {
  if (typeof key !== 'string' || key.includes('..') || !ehUuid(organizacaoId)) return false
  const pasta = `${PREFIXO_SITES}/${organizacaoId}/`
  return key.startsWith(pasta) && /^[0-9a-f-]{36}-[a-zA-Z0-9._-]{1,80}$/i.test(key.slice(pasta.length))
}

export type PedidoMidiaSite = { organizacaoId: string; idArquivo: string; nome: string; tipo: string; tamanho: number }

export function validarPedidoMidiaSite(corpo: unknown): { ok: true; dados: PedidoMidiaSite } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>
  if (!ehUuid(c.organizacaoId)) return { ok: false, erro: 'Estúdio inválido.' }
  if (!ehUuid(c.idArquivo)) return { ok: false, erro: 'Arquivo inválido.' }
  if (typeof c.nome !== 'string' || c.nome.trim() === '' || c.nome.length > 255) return { ok: false, erro: 'Nome de arquivo inválido.' }
  if (typeof c.tipo !== 'string' || !MIMES_MIDIA_SITE.has(c.tipo)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }
  if (typeof c.tamanho !== 'number' || !Number.isInteger(c.tamanho) || c.tamanho <= 0) return { ok: false, erro: 'Tamanho de arquivo inválido.' }
  if (c.tamanho > TAMANHO_MAXIMO_MIDIA_SITE) return { ok: false, erro: 'Imagem maior que 10 MB.' }
  return { ok: true, dados: { organizacaoId: c.organizacaoId, idArquivo: c.idArquivo, nome: c.nome, tipo: c.tipo, tamanho: c.tamanho } }
}
