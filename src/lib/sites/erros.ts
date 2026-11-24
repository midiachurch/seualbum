/**
 * Tradução de erro do banco em mensagem para a tela, sem vazar detalhe
 * interno. Só mensagens conhecidas (escritas nas migrations 0070/0071) passam
 * como estão; qualquer outra coisa vira texto genérico.
 */
type ErroBanco = { code?: string; message?: string } | null | undefined

const MENSAGENS_CONHECIDAS = new Set([
  'Endereço indisponível.',
  'Esta organização já tem um site.',
  'A mídia está em uso no site.',
  'Domínio indisponível.',
  'Domínio inválido.',
  'Limite de domínios do site atingido.',
  'Limite de mídias do site atingido.',
  'Verifique a titularidade antes de ativar.',
  'Informe ao menos um canal de contato.',
])

export function mensagemDeErroSite(erro: ErroBanco, generica: string): string {
  if (!erro) return generica
  if (erro.code === '42501') return 'Você não tem permissão para esta ação.'
  if (erro.code === '40001') return 'O rascunho foi alterado por outra pessoa. Recarregue a página para continuar.'
  if (erro.code === '22023' && erro.message && MENSAGENS_CONHECIDAS.has(erro.message)) return erro.message
  return generica
}

export const ehConflitoDeRevisao = (erro: ErroBanco) => erro?.code === '40001'
