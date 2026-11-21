/**
 * Colunas legíveis das tabelas da agenda. `agenda_reservas.token_hash` não tem
 * GRANT de leitura: um `select('*')` falharia por permissão, então sempre se
 * lista a projeção.
 */
export const COLUNAS_RESERVA =
  'id,organizacao_id,recurso_id,status,inicio,fim,ocupa_ate,contato_nome,contato_email,contato_telefone,expira_em,confirmada_em,cancelada_em,cancelada_por,motivo_cancelamento,concluida_em,cliente_id,sinal_centavos,sinal_status,remarcacoes,created_at,updated_at'
export const COLUNAS_RECURSO =
  'id,organizacao_id,nome,slug,tipo,descricao,fuso,duracao_min,buffer_min,intervalo_min,antecedencia_min_min,antecedencia_max_dias,cancelamento_antecedencia_h,sinal_centavos,publicado,ativo,created_at,updated_at'

/** Instante ISO de N dias atrás (calculado fora do componente, que deve ser puro). */
export const dataIsoHaDias = (dias: number) => new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString()
