import { verificarTitularidade, type ResolvedorDns } from './dominio'

type Rpc = (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
export type ClienteRpc = { rpc: Rpc }

export type ResultadoVerificacao =
  | { ok: true; status: 'verificado' | 'falhou'; motivo?: 'registro_nao_encontrado' | 'dominio_em_uso' }
  | { ok: false; erro: string }

/**
 * Verificação de titularidade em dois passos (migration 0071):
 *  1. sessão do USUÁRIO (RLS/papel no banco) registra o pedido;
 *  2. o servidor consulta o DNS pelo resolver injetado e ATESTA o resultado
 *     com o cliente de serviço — que só consegue concluir um pedido feito no
 *     passo 1, nos últimos 15 minutos. Nenhuma autorização é pulada aqui.
 */
export async function verificarDominioSite(
  deps: { usuario: ClienteRpc; servico: () => ClienteRpc; resolvedor: ResolvedorDns },
  dominioId: string,
): Promise<ResultadoVerificacao> {
  const geral = { ok: false as const, erro: 'Não foi possível verificar o domínio agora. Tente de novo.' }
  const pedido = await deps.usuario.rpc('preparar_verificacao_dominio', { p_id: dominioId })
  if (pedido.error) {
    return pedido.error.code === '42501' ? { ok: false, erro: 'Você não tem permissão para esta ação.' } : geral
  }
  const linha = Array.isArray(pedido.data) ? (pedido.data[0] as { dominio?: string; token?: string; status?: string } | undefined) : undefined
  if (!linha?.dominio || !linha.token) return geral
  if (linha.status === 'verificado') return { ok: true, status: 'verificado' }

  const dns = await verificarTitularidade(deps.resolvedor, linha.dominio, linha.token)
  if (dns.erro) return { ok: false, erro: 'Não foi possível consultar o DNS agora. Tente de novo em instantes.' }

  let servico: ClienteRpc
  try { servico = deps.servico() } catch { return { ok: false, erro: 'Verificação automática indisponível neste ambiente.' } }
  const conf = await servico.rpc('confirmar_verificacao_dominio', { p_id: dominioId, p_registros: dns.registros })
  if (conf.error || (conf.data !== 'verificado' && conf.data !== 'falhou')) return geral
  return conf.data === 'verificado' ? { ok: true, status: 'verificado' } : { ok: true, status: 'falhou', motivo: dns.encontrado ? 'dominio_em_uso' : 'registro_nao_encontrado' }
}
