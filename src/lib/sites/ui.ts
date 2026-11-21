import type { PapelOrganizacao, SiteDominioRow, SiteEventoRow, SiteRow, SiteVersaoRow } from '@/types/database'

/** Dados que a página do painel entrega ao editor (sem conteúdo pesado das versões). */
export type VersaoUI = Pick<SiteVersaoRow, 'id' | 'numero' | 'nota' | 'created_at'>
export type EventoUI = Pick<SiteEventoRow, 'id' | 'acao' | 'detalhe' | 'created_at'>
export type DominioUI = Pick<SiteDominioRow, 'id' | 'dominio' | 'status' | 'token' | 'ativo' | 'falhou_motivo'>
export type SiteUI = Pick<SiteRow, 'id' | 'organizacao_id' | 'slug' | 'nome' | 'status' | 'rascunho_rev' | 'versao_publicada_id' | 'publicado_em'>
export type MidiaListaUI = { id: string; nome: string; url: string | null; largura: number | null; altura: number | null }

export const podeEditarSite = (papel: PapelOrganizacao) => papel === 'dono' || papel === 'admin' || papel === 'editor'
export const podePublicarSite = (papel: PapelOrganizacao) => papel === 'dono' || papel === 'admin'

export const ROTULO_STATUS_SITE: Record<SiteRow['status'], string> = {
  rascunho: 'Rascunho (nunca publicado)',
  publicado: 'No ar',
  despublicado: 'Fora do ar',
}

export const ROTULO_EVENTO_SITE: Record<string, string> = {
  criado: 'Site criado',
  rascunho_salvo: 'Rascunho salvo',
  publicado: 'Publicado',
  revertido: 'Voltou para uma versão anterior',
  despublicado: 'Tirado do ar',
  restaurado_no_rascunho: 'Versão restaurada no rascunho',
  dados_alterados: 'Nome ou endereço alterados',
  dominio_adicionado: 'Domínio adicionado',
  dominio_verificado: 'Domínio verificado',
  dominio_falhou: 'Verificação de domínio falhou',
  dominio_ativado: 'Domínio ativado',
  dominio_desativado: 'Domínio desativado',
  dominio_removido: 'Domínio removido',
}
