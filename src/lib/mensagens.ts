/**
 * Mensagens interligadas (migration 0037) — tipos e regras compartilhados
 * entre Server Actions, páginas e componentes (roda no navegador também: nada
 * de `server-only` aqui).
 *
 * Canais:
 *  - `estudio_equipe`: estúdio ↔ equipe seualbum (fio geral + um por projeto);
 *  - `cliente_estudio`: cliente final ↔ estúdio, por projeto. A equipe só lê.
 */

import type { MensagemRow } from '@/types/database'

export type CanalConversa = 'estudio_equipe' | 'cliente_estudio'
export const CANAIS: CanalConversa[] = ['estudio_equipe', 'cliente_estudio']

/** De que lado da conversa quem está vendo a tela está. */
export type PerfilMensagens = 'equipe' | 'fotografo' | 'cliente'

export const TAMANHO_MAXIMO_MENSAGEM = 4000
export const MENSAGENS_POR_PAGINA = 30

export type MensagemView = {
  id: string
  conversaId: string
  autorId: string | null
  autorNome: string
  autorPapel: MensagemRow['autor_papel']
  tipo: MensagemRow['tipo']
  corpo: string
  laminaId: string | null
  versaoId: string | null
  criadaEm: string
  apagada: boolean
}

export type ConversaResumo = {
  id: string
  canal: CanalConversa
  fotografoId: string
  estudio: string
  estudioLogoUrl: string | null
  projetoId: string | null
  projetoNome: string | null
  projetoNumero: number | null
  clienteNome: string | null
  ultimaMensagemEm: string | null
  ultimaMensagemPrevia: string | null
  naoLidas: number
  criadaEm: string
}

export type PaginaDeMensagens = {
  /** Em ordem cronológica (mais antiga primeiro). */
  mensagens: MensagemView[]
  temMais: boolean
  /** Até quando a outra ponta leu (para o "Visto"). */
  vistoAte: string | null
}

/** Lâmina que pode ser citada numa mensagem do projeto. */
export type OpcaoLamina = { id: string; rotulo: string }

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor)
}

export function ehCanal(valor: unknown): valor is CanalConversa {
  return typeof valor === 'string' && (CANAIS as string[]).includes(valor)
}

/** Corpo aparado e dentro do limite, ou o motivo da recusa. */
export function validarCorpo(corpo: unknown): { ok: true; corpo: string } | { ok: false; erro: string } {
  if (typeof corpo !== 'string') return { ok: false, erro: 'Mensagem inválida.' }
  const limpo = corpo.trim()
  if (!limpo) return { ok: false, erro: 'Escreva uma mensagem.' }
  if (limpo.length > TAMANHO_MAXIMO_MENSAGEM) {
    return { ok: false, erro: `A mensagem passa de ${TAMANHO_MAXIMO_MENSAGEM} caracteres.` }
  }
  return { ok: true, corpo: limpo }
}

/** Data ISO válida (cursor da paginação). */
export function ehDataIso(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= 40 && !Number.isNaN(Date.parse(valor))
}

export function mapMensagem(row: MensagemRow): MensagemView {
  return {
    id: row.id,
    conversaId: row.conversa_id,
    autorId: row.autor_id,
    autorNome: row.autor_nome,
    autorPapel: row.autor_papel,
    tipo: row.tipo,
    corpo: row.apagada_em ? '' : row.corpo,
    laminaId: row.lamina_id,
    versaoId: row.versao_id,
    criadaEm: row.created_at,
    apagada: Boolean(row.apagada_em),
  }
}

/** Junta páginas/eventos sem duplicar (id) e em ordem cronológica. */
export function mesclarMensagens(atuais: MensagemView[], novas: MensagemView[]): MensagemView[] {
  const porId = new Map(atuais.map((m) => [m.id, m]))
  for (const m of novas) porId.set(m.id, m)
  return [...porId.values()].sort((a, b) => a.criadaEm.localeCompare(b.criadaEm) || a.id.localeCompare(b.id))
}

/** Rótulo do autor visto por quem está na tela (o estúdio é white-label para o cliente). */
export function rotuloDoAutor(m: Pick<MensagemView, 'autorNome' | 'autorPapel'>, perfil: PerfilMensagens): string {
  if (m.autorPapel === 'sistema') return 'seualbum'
  if (m.autorPapel === 'equipe') return perfil === 'equipe' ? `${m.autorNome} (equipe)` : `Equipe seualbum · ${m.autorNome}`
  if (m.autorPapel === 'cliente') return m.autorNome || 'Cliente'
  return m.autorNome || 'Estúdio'
}

/** Título do fio na lista. */
export function tituloDaConversa(c: ConversaResumo, perfil: PerfilMensagens): string {
  if (perfil === 'cliente') return c.projetoNome ? `${c.estudio} · ${c.projetoNome}` : c.estudio
  if (!c.projetoId) return perfil === 'equipe' ? `${c.estudio} · Geral` : 'Equipe seualbum · Geral'
  const projeto = `#${c.projetoNumero ?? ''} ${c.projetoNome ?? 'Projeto'}`.trim()
  if (c.canal === 'cliente_estudio') return c.clienteNome ? `${c.clienteNome} · ${projeto}` : projeto
  return perfil === 'equipe' ? `${c.estudio} · ${projeto}` : projeto
}

/** Evento de janela para os contadores se atualizarem na hora (lido/enviado). */
export const EVENTO_MENSAGENS_LIDAS = 'seualbum:mensagens-lidas'
