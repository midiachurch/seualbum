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

/* ---------------------------- fotos do projeto ---------------------------- */

// Chave: projetos/{projetoId}/fotos/{idArquivo}-{nome} — ao lado das lâminas
// (`projetos/{projetoId}/versoes/…`). Substitui o bucket `projetos_fotos`
// (que aceitava até 300 MB por arquivo).
export const TAMANHO_MAXIMO_FOTO_PROJETO_R2 = 300 * 1024 * 1024
export const MIMES_FOTO_PROJETO = MIMES_FOTO_PEDIDO

export function pastaFotosProjeto(projetoId: string) {
  return `${PREFIXO_PROJETOS}/${projetoId}/fotos`
}

export function chaveFotoProjeto(p: { projetoId: string; idArquivo: string; nome: string }) {
  return `${pastaFotosProjeto(p.projetoId)}/${p.idArquivo}-${nomeSeguro(p.nome)}`
}

/** Lê uma chave de foto de projeto. `null` = malformada (nunca registrar). */
export function lerChaveFotoProjeto(key: unknown): { projetoId: string } | null {
  if (typeof key !== 'string' || key.includes('..')) return null
  const partes = key.split('/')
  if (partes.length !== 4) return null
  const [prefixo, projetoId, pasta, arquivo] = partes
  if (prefixo !== PREFIXO_PROJETOS || !ehUuid(projetoId) || pasta !== 'fotos') return null
  if (!/^[0-9a-f-]{36}-[a-zA-Z0-9._-]{1,80}$/i.test(arquivo)) return null
  return { projetoId }
}

export type PedidoDeEnvioFotoProjeto = { projetoId: string; idArquivo: string; nome: string; tipo: string; tamanho: number }

/** Valida o corpo de POST /api/uploads/projeto-foto. */
export function validarEnvioFotoProjeto(corpo: unknown): { ok: true; dados: PedidoDeEnvioFotoProjeto } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>
  if (!ehUuid(c.projetoId)) return { ok: false, erro: 'Projeto inválido.' }
  if (!ehUuid(c.idArquivo)) return { ok: false, erro: 'Arquivo inválido.' }
  if (typeof c.nome !== 'string' || c.nome.trim() === '' || c.nome.length > 255) return { ok: false, erro: 'Nome de arquivo inválido.' }
  if (typeof c.tipo !== 'string' || !MIMES_FOTO_PROJETO.has(c.tipo)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG, HEIC ou WebP.' }
  if (typeof c.tamanho !== 'number' || !Number.isInteger(c.tamanho) || c.tamanho <= 0) return { ok: false, erro: 'Tamanho de arquivo inválido.' }
  if (c.tamanho > TAMANHO_MAXIMO_FOTO_PROJETO_R2) return { ok: false, erro: 'Foto maior que 300 MB.' }
  return { ok: true, dados: { projetoId: c.projetoId, idArquivo: c.idArquivo, nome: c.nome, tipo: c.tipo, tamanho: c.tamanho } }
}

/* --------------------------------- álbuns --------------------------------- */

// Editor de álbum (migration 0027). Substitui o bucket `albuns_fotos`:
//   albuns/{albumId}/{idArquivo}-{nome}                    fotos do álbum avulso
//   albuns/{albumId}/derivados/{fotoId}-{mini|preview}.jpg versões leves
//   albuns/{albumId}/aprovacoes/{aprovacaoId}/{001}.jpg    lâminas do link de aprovação
// Os caminhos ficam em JSON (`album_layouts.fotos`/`derivados`,
// `album_aprovacoes.laminas`), sem coluna de bucket: o prefixo `albuns/` É a
// marca de "está no R2". Os caminhos antigos do Supabase começam pelo id do
// álbum (um UUID), então os dois nunca se confundem.
export const PREFIXO_ALBUNS = 'albuns'
export const BUCKET_ALBUNS_LEGADO = 'albuns_fotos'
export const TAMANHO_MAXIMO_FOTO_ALBUM_R2 = 50 * 1024 * 1024 // mesmo limite do bucket `albuns_fotos`
export const TAMANHO_MAXIMO_DERIVADO_R2 = 10 * 1024 * 1024
export const MIMES_FOTO_ALBUM = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** O caminho guardado no álbum está no R2? (senão, no bucket `albuns_fotos` do Supabase) */
export function ehChaveAlbumR2(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith(`${PREFIXO_ALBUNS}/`)
}

/** Bucket de um caminho do álbum, no formato de `fotos.bucket` ('r2' ou o bucket antigo). */
export function bucketDoArquivoAlbum(path: string) {
  return ehChaveAlbumR2(path) ? BUCKET_R2 : BUCKET_ALBUNS_LEGADO
}

export function pastaAlbumR2(albumId: string) {
  return `${PREFIXO_ALBUNS}/${albumId}`
}

export function chaveFotoAlbum(p: { albumId: string; idArquivo: string; nome: string }) {
  return `${pastaAlbumR2(p.albumId)}/${p.idArquivo}-${nomeSeguro(p.nome)}`
}

export function chaveDerivadoAlbum(p: { albumId: string; fotoId: string; variante: 'mini' | 'preview' }) {
  return `${pastaAlbumR2(p.albumId)}/derivados/${p.fotoId}-${p.variante}.jpg`
}

export function pastaAprovacaoAlbum(albumId: string, aprovacaoId: string) {
  return `${pastaAlbumR2(albumId)}/aprovacoes/${aprovacaoId}`
}

export function chaveLaminaAprovacao(p: { albumId: string; aprovacaoId: string; ordem: number }) {
  return `${pastaAprovacaoAlbum(p.albumId, p.aprovacaoId)}/${String(p.ordem).padStart(3, '0')}.jpg`
}

/** É a foto (original) de um álbum avulso, direto na pasta dele? */
export function chaveEhFotoDoAlbum(key: unknown, albumId: string): key is string {
  if (typeof key !== 'string' || key.includes('..')) return false
  const pasta = `${pastaAlbumR2(albumId)}/`
  return key.startsWith(pasta) && /^[0-9a-f-]{36}-[a-zA-Z0-9._-]{1,80}$/i.test(key.slice(pasta.length))
}

export function chaveEhDerivadoDoAlbum(key: unknown, albumId: string): key is string {
  if (typeof key !== 'string' || key.includes('..')) return false
  const pasta = `${pastaAlbumR2(albumId)}/derivados/`
  return key.startsWith(pasta) && /^[0-9a-f-]{36}-(mini|preview)\.jpg$/i.test(key.slice(pasta.length))
}

export function chaveEhLaminaDaAprovacao(key: unknown, albumId: string, aprovacaoId: string): key is string {
  if (typeof key !== 'string' || key.includes('..')) return false
  const pasta = `${pastaAprovacaoAlbum(albumId, aprovacaoId)}/`
  return key.startsWith(pasta) && /^\d{3}\.jpg$/.test(key.slice(pasta.length))
}

export type PedidoDeEnvioAlbum =
  | { albumId: string; destino: 'foto'; idArquivo: string; nome: string; tipo: string; tamanho: number }
  | { albumId: string; destino: 'derivado'; fotoId: string; variante: 'mini' | 'preview'; tipo: string; tamanho: number }
  | { albumId: string; destino: 'aprovacao'; aprovacaoId: string; ordem: number; tipo: string; tamanho: number }

/** Valida o corpo de POST /api/uploads/album. */
export function validarEnvioAlbum(corpo: unknown): { ok: true; dados: PedidoDeEnvioAlbum } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>
  if (!ehUuid(c.albumId)) return { ok: false, erro: 'Álbum inválido.' }
  if (typeof c.tamanho !== 'number' || !Number.isInteger(c.tamanho) || c.tamanho <= 0) return { ok: false, erro: 'Tamanho de arquivo inválido.' }
  const tipo = typeof c.tipo === 'string' ? c.tipo : ''
  const albumId = c.albumId
  const tamanho = c.tamanho

  if (c.destino === 'foto') {
    if (!ehUuid(c.idArquivo)) return { ok: false, erro: 'Arquivo inválido.' }
    if (typeof c.nome !== 'string' || c.nome.trim() === '' || c.nome.length > 255) return { ok: false, erro: 'Nome de arquivo inválido.' }
    if (!MIMES_FOTO_ALBUM.has(tipo)) return { ok: false, erro: 'Envie JPG, PNG ou WebP.' }
    if (tamanho > TAMANHO_MAXIMO_FOTO_ALBUM_R2) return { ok: false, erro: 'Foto maior que 50 MB.' }
    return { ok: true, dados: { albumId, destino: 'foto', idArquivo: c.idArquivo, nome: c.nome, tipo, tamanho } }
  }
  if (c.destino === 'derivado') {
    // O id da foto é o do álbum avulso ou o de `fotos` do projeto: sempre UUID.
    if (!ehUuid(c.fotoId)) return { ok: false, erro: 'Foto inválida.' }
    if (c.variante !== 'mini' && c.variante !== 'preview') return { ok: false, erro: 'Versão leve inválida.' }
    if (tipo !== 'image/jpeg') return { ok: false, erro: 'As versões leves são JPG.' }
    if (tamanho > TAMANHO_MAXIMO_DERIVADO_R2) return { ok: false, erro: 'Versão leve grande demais.' }
    return { ok: true, dados: { albumId, destino: 'derivado', fotoId: c.fotoId, variante: c.variante, tipo, tamanho } }
  }
  if (c.destino === 'aprovacao') {
    if (!ehUuid(c.aprovacaoId)) return { ok: false, erro: 'Envio inválido.' }
    if (typeof c.ordem !== 'number' || !Number.isInteger(c.ordem) || c.ordem < 1 || c.ordem > 999) return { ok: false, erro: 'Lâmina inválida.' }
    if (tipo !== 'image/jpeg') return { ok: false, erro: 'As lâminas precisam ser JPG.' }
    if (tamanho > TAMANHO_MAXIMO_LAMINA_R2) return { ok: false, erro: 'Lâmina maior que 50 MB.' }
    return { ok: true, dados: { albumId, destino: 'aprovacao', aprovacaoId: c.aprovacaoId, ordem: c.ordem, tipo, tamanho } }
  }
  return { ok: false, erro: 'Destino inválido.' }
}

/** Chave no R2 do que o navegador pediu para enviar ao álbum. */
export function chaveDoEnvioAlbum(d: PedidoDeEnvioAlbum) {
  if (d.destino === 'foto') return chaveFotoAlbum({ albumId: d.albumId, idArquivo: d.idArquivo, nome: d.nome })
  if (d.destino === 'derivado') return chaveDerivadoAlbum({ albumId: d.albumId, fotoId: d.fotoId, variante: d.variante })
  return chaveLaminaAprovacao({ albumId: d.albumId, aprovacaoId: d.aprovacaoId, ordem: d.ordem })
}

/* ------------------------- públicos: vitrine e logos ------------------------ */

// Bucket PÚBLICO do R2 (R2_PUBLIC_BUCKET), servido por R2_PUBLIC_URL:
//   vitrine/{idArquivo}-{nome}             biblioteca de mídia (banners, portfólio)
//   logos/{fotografoId}/{idArquivo}-{nome} logo do estúdio (tela pública do orçamento)
// Substituem os buckets públicos `midia_vitrine` e `fotografo_logos` (0009).
export const PREFIXO_VITRINE = 'vitrine'
export const PREFIXO_LOGOS = 'logos'
export const TAMANHO_MAXIMO_MIDIA_R2 = 50 * 1024 * 1024 // mesmo limite do `midia_vitrine`
export const TAMANHO_MAXIMO_LOGO_R2 = 5 * 1024 * 1024 // mesmo limite do `fotografo_logos`
// Sem SVG: servido de um domínio nosso, um SVG pode carregar script.
export const MIMES_MIDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
export const MIMES_LOGO = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function chaveMidiaVitrine(p: { idArquivo: string; nome: string }) {
  return `${PREFIXO_VITRINE}/${p.idArquivo}-${nomeSeguro(p.nome)}`
}

export function chaveEhMidiaVitrine(key: unknown): key is string {
  if (typeof key !== 'string' || key.includes('..')) return false
  const pasta = `${PREFIXO_VITRINE}/`
  return key.startsWith(pasta) && /^[0-9a-f-]{36}-[a-zA-Z0-9._-]{1,80}$/i.test(key.slice(pasta.length))
}

export function chaveLogoFotografo(p: { fotografoId: string; idArquivo: string; nome: string }) {
  return `${PREFIXO_LOGOS}/${p.fotografoId}/${p.idArquivo}-${nomeSeguro(p.nome)}`
}

/** A chave é um logo DESTE fotógrafo? */
export function chaveEhLogoDoFotografo(key: unknown, fotografoId: string): key is string {
  if (typeof key !== 'string' || key.includes('..')) return false
  const pasta = `${PREFIXO_LOGOS}/${fotografoId}/`
  return key.startsWith(pasta) && /^[0-9a-f-]{36}-[a-zA-Z0-9._-]{1,80}$/i.test(key.slice(pasta.length))
}

export type PedidoDeEnvioPublico = { idArquivo: string; nome: string; tipo: string; tamanho: number }

/** Valida o corpo de POST /api/uploads/midia e /api/uploads/logo. */
export function validarEnvioPublico(
  corpo: unknown,
  regra: { mimes: Set<string>; tamanhoMaximo: number },
): { ok: true; dados: PedidoDeEnvioPublico } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>
  if (!ehUuid(c.idArquivo)) return { ok: false, erro: 'Arquivo inválido.' }
  if (typeof c.nome !== 'string' || c.nome.trim() === '' || c.nome.length > 255) return { ok: false, erro: 'Nome de arquivo inválido.' }
  if (typeof c.tipo !== 'string' || !regra.mimes.has(c.tipo)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }
  if (typeof c.tamanho !== 'number' || !Number.isInteger(c.tamanho) || c.tamanho <= 0) return { ok: false, erro: 'Tamanho de arquivo inválido.' }
  if (c.tamanho > regra.tamanhoMaximo) return { ok: false, erro: `Arquivo maior que ${Math.round(regra.tamanhoMaximo / 1024 / 1024)} MB.` }
  return { ok: true, dados: { idArquivo: c.idArquivo, nome: c.nome, tipo: c.tipo, tamanho: c.tamanho } }
}

/* ------------------------- cópias e varredura de órfãos ------------------------ */

/** Tipos de imagem que gravamos no bucket privado (fotos de pedido/projeto, álbuns, lâminas). */
export const MIMES_IMAGEM_PRIVADA = new Set([...MIMES_FOTO_PEDIDO, ...MIMES_FOTO_ALBUM, ...MIMES_LAMINA])

const MIME_POR_EXTENSAO: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

/**
 * Content-Type de um arquivo antigo do Supabase Storage ao copiá-lo para o R2
 * (duplicar álbum). O tipo do Supabase vem de quem enviou e pode ser qualquer
 * coisa (`text/html`, `image/svg+xml`…): só passa o que está na lista de
 * imagens; senão vale a extensão do nome; senão `application/octet-stream`
 * (o navegador baixa em vez de interpretar).
 */
export function tipoDeImagemPermitido(tipo: string | null | undefined, nome: string): string {
  const base = (tipo ?? '').split(';')[0].trim().toLowerCase()
  const normalizado = base === 'image/jpg' || base === 'image/pjpeg' ? 'image/jpeg' : base
  if (MIMES_IMAGEM_PRIVADA.has(normalizado)) return normalizado
  const extensao = nome.toLowerCase().split('.').pop() ?? ''
  return MIME_POR_EXTENSAO[extensao] ?? 'application/octet-stream'
}

/**
 * Prefixos que o app grava em cada bucket do R2 — os únicos que a varredura
 * de órfãos (/api/cron/limpar-fotos-r2) olha.
 */
export const PREFIXOS_DO_APP = {
  privado: [`${PREFIXO_PEDIDOS}/`, `${PREFIXO_PROJETOS}/`, `${PREFIXO_ALBUNS}/`],
  publico: [`${PREFIXO_VITRINE}/`, `${PREFIXO_LOGOS}/`],
} as const

/**
 * A chave tem o formato que o app gera (prefixo conhecido, só caracteres de
 * `nomeSeguro`, sem `..`)? Fora disso, a varredura nunca apaga — o mesmo
 * critério de `r2_chaves_sem_referencia` (0040).
 */
export function chaveNoFormatoDoApp(key: unknown): key is string {
  return typeof key === 'string' && !key.includes('..') && /^(pedidos|projetos|albuns|vitrine|logos)(\/[A-Za-z0-9._-]+)+$/.test(key)
}
