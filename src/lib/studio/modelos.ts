/**
 * Variáveis de modelos de mensagem (0082). A lista é FECHADA e espelha a do
 * banco (`studio_variaveis_validas`); a renderização oficial é a da RPC
 * `renderizar_modelo_studio`. Aqui só há conveniência de UI (prévia ao vivo
 * com dados de exemplo) — nada é enviado.
 */
export const VARIAVEIS_MODELO = [
  { nome: 'cliente_nome', exemplo: 'Ana Souza', descricao: 'Nome completo do cliente' },
  { nome: 'cliente_primeiro_nome', exemplo: 'Ana', descricao: 'Primeiro nome do cliente' },
  { nome: 'estudio', exemplo: 'Estúdio Luz', descricao: 'Nome do seu estúdio' },
  { nome: 'titulo_negocio', exemplo: 'Casamento Ana e Bruno', descricao: 'Título do negócio' },
  { nome: 'valor', exemplo: 'R$ 4.500,00', descricao: 'Valor estimado do negócio' },
  { nome: 'projeto', exemplo: 'Álbum Casamento', descricao: 'Nome do projeto vinculado' },
  { nome: 'responsavel_nome', exemplo: 'Carlos', descricao: 'Responsável pelo negócio ou tarefa' },
  { nome: 'tarefa', exemplo: 'Enviar contrato', descricao: 'Título da tarefa' },
  { nome: 'prazo_tarefa', exemplo: '30/11/2026', descricao: 'Prazo da tarefa' },
] as const

const NOMES = new Set<string>(VARIAVEIS_MODELO.map(v => v.nome))
const PADRAO = /\{\{\s*([a-z_]+)\s*\}\}/g

/** Variáveis usadas no texto (sem repetição, na ordem em que aparecem). */
export function variaveisDoTexto(texto: string): string[] {
  const achadas: string[] = []
  for (const m of texto.matchAll(PADRAO)) if (!achadas.includes(m[1])) achadas.push(m[1])
  return achadas
}

/** Mesma regra do banco: só variáveis conhecidas e nenhuma chave solta. */
export function variaveisValidas(texto: string): boolean {
  const resto = texto.replace(PADRAO, m => (NOMES.has(m.replace(/[{}\s]/g, '')) ? '' : m))
  return !resto.includes('{{') && !resto.includes('}}')
}

/**
 * Prévia local. Variável sem valor aparece como [nome] e entra em `faltando`,
 * igual ao servidor. Substituição por função: sem interpretar `$&` ou `\1`.
 */
export function renderizarPrevia(texto: string, valores: Partial<Record<string, string>>): { texto: string; faltando: string[] } {
  const faltando: string[] = []
  const saida = texto.replace(PADRAO, (_m, nome: string) => {
    const v = valores[nome]
    if (v === undefined || v === '') {
      if (!faltando.includes(nome)) faltando.push(nome)
      return `[${nome}]`
    }
    return v
  })
  return { texto: saida, faltando }
}

export const VALORES_EXEMPLO: Record<string, string> = Object.fromEntries(VARIAVEIS_MODELO.map(v => [v.nome, v.exemplo]))
