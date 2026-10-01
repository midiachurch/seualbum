import type { ItemEscolhido } from '@/types/platform'

/**
 * Adicionais escolhidos no modal de oferta → formato de `aprovar_prova`.
 * Só id + quantidade seguem para o banco; o preço é sempre calculado lá.
 */
export function normalizarAdicionais(itens: ItemEscolhido[] | undefined) {
  return (Array.isArray(itens) ? itens : [])
    .filter((i) => typeof i?.adicionalId === 'string' && /^[0-9a-f-]{36}$/.test(i.adicionalId) && Number(i.quantidade) > 0)
    .slice(0, 10)
    .map((i) => ({ adicional_id: i.adicionalId, quantidade: Math.min(10, Math.max(1, Math.floor(Number(i.quantidade)))) }))
}
