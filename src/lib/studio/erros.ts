/**
 * Erros do Estúdio sem vazar detalhe interno. 42501 vira mensagem genérica de
 * permissão; 22023 só repassa textos que NÓS escrevemos nas RPCs (lista
 * fechada); qualquer outra coisa vira a mensagem padrão da ação.
 */
const MENSAGENS_SEGURAS = new Set([
  'O responsável precisa ser membro ativo da equipe.',
  'Este cliente já tem um negócio em andamento.',
  'Este cliente já tem outro negócio em andamento.',
  'Informe o motivo da perda.',
  'O projeto precisa ser do mesmo cliente e estúdio.',
  'Tarefa já encerrada.',
  'Já existe um modelo com este nome.',
  'O cliente não tem contato neste canal.',
  'O cliente optou por não receber neste canal.',
  'Modelo indisponível.',
  'Faltam dados para preencher o modelo.',
  'Envio externo desligado: só o adaptador registro é aceito.',
])

export type ErroRpc = { code?: string | null; message?: string | null } | null | undefined

export function mensagemDeErro(erro: ErroRpc, padrao: string): string {
  if (erro?.code === '42501') return 'Você não tem permissão para esta ação.'
  if (erro?.code === '22023' && erro.message && MENSAGENS_SEGURAS.has(erro.message)) return erro.message
  return padrao
}

export type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; erro: string }

/** Aceita data (AAAA-MM-DD, vira fim do dia em Brasília) ou ISO completo; vazio = sem prazo; inválido = undefined. */
export function normalizarPrazo(v: string | null | undefined): string | null | undefined {
  if (v == null || v === '') return null
  if (typeof v !== 'string' || v.length > 40) return undefined
  const base = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:00-03:00` : v
  const t = Date.parse(base)
  return Number.isNaN(t) ? undefined : new Date(t).toISOString()
}

/** Chave de idempotência gerada no cliente: estável entre retries do mesmo gesto. */
export const chaveValida = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9:_-]{8,100}$/.test(v)
