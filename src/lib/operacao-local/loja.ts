/** Compra local: inspira-se na separação cálculo/snapshot/estados da plataforma-eventos
 * e no checkout SmartStudios que recebe escolhas e obtém o preço da fonte de catálogo.
 * Nenhum adapter de pagamento, Auth ou cálculo monetário em reais foi transplantado. */
import { calcularFinanceiroLocal, lerConfigComercial, validarFinanceiroPedido, type FinanceiroPedidoLocal } from './comercial'
import { ErroOperacaoLocal, type EstadoLocal, type FotoLocal, type GaleriaLocal, type ProdutoLocal } from './modelo'

export interface ItemCarrinhoLocal { produtoId: string; fotoIds: string[] }
export interface CarrinhoLocal { galeriaId: string; itens: ItemCarrinhoLocal[] }
export type FotoCompraLocal = Pick<FotoLocal, 'id' | 'nome' | 'url' | 'bytes' | 'tipo'>
export interface ItemResumoLojaLocal extends ItemCarrinhoLocal { produtoNome: string; produtoTipo: ProdutoLocal['tipo']; fotos: FotoCompraLocal[]; totalCentavos: number | null; financeiro: FinanceiroPedidoLocal }
export interface ItemCompraLocal extends ItemResumoLojaLocal { totalCentavos: number; financeiro: { comissaoBps: number; comissaoCentavos: number; liquidoCentavos: number } }
export interface CompraLocal {
  id: string; proprietarioId: string; galeriaId: string; chave: string; criadaEm: string
  status: 'pago_simulado' | 'recusado_simulado'; simulacao: true; itens: ItemCompraLocal[]
  totalCentavos: number; comissaoCentavos: number; liquidoCentavos: number
}
export interface EstadoLojaLocal { carrinhos: CarrinhoLocal[]; compras: CompraLocal[] }
export interface CotacaoItemLojaLocal { produtoId: string; totalCentavos: number | null; comissaoBps: number }
export type ComandoLojaLocal =
  | { tipo: 'definir_item'; galeriaId: string; produtoId: string; fotoIds: string[] }
  | { tipo: 'remover_item'; galeriaId: string; produtoId: string }
  | { tipo: 'checkout'; galeriaId: string; itens: ItemCarrinhoLocal[]; chave: string; resultado: CompraLocal['status']; totalEsperadoCentavos?: number; cotacaoEsperada?: CotacaoItemLojaLocal[] }
export interface ResumoCarrinhoLocal { itens: ItemResumoLojaLocal[]; totalCentavos: number | null; comissaoCentavos: number | null; liquidoCentavos: number | null }
type EstadoComLoja = EstadoLocal & { loja?: EstadoLojaLocal }
const falhar = (codigo: string, mensagem: string): never => { throw new ErroOperacaoLocal(codigo, mensagem) }
const registro = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null && !Array.isArray(valor)
const centavos = (valor: unknown): valor is number => typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
const soma = (valores: number[]): number => {
  const total = valores.reduce((atual, valor) => atual + valor, 0)
  if (!valores.every(centavos) || !centavos(total)) falhar('total_invalido', 'O total excede o limite seguro da simulação.')
  return total
}
function galeriaValida(estado: EstadoLocal, galeriaId: string): GaleriaLocal {
  const galeria = estado.galerias.find(item => item.id === galeriaId && item.proprietarioId === estado.proprietarioId)
  if (!galeria) return falhar('acesso_negado', 'Galeria indisponível neste estúdio.')
  return galeria
}
function fotoSnapshot(foto: FotoLocal): FotoCompraLocal {
  return { id: foto.id, nome: foto.nome, url: foto.url, bytes: foto.bytes, tipo: foto.tipo }
}
function canonicalizarItens(estado: EstadoLocal, galeria: GaleriaLocal, itens: ItemCarrinhoLocal[], exigirDisponivel: boolean): ItemCarrinhoLocal[] {
  if (!Array.isArray(itens) || itens.length > 100 || new Set(itens.map(item => item.produtoId)).size !== itens.length) falhar('itens_invalidos', 'Use no máximo 100 itens distintos no carrinho.')
  return itens.map(item => {
    const produto = estado.catalogo.find(produto => produto.id === item.produtoId && produto.proprietarioId === estado.proprietarioId)
    if (!produto || exigirDisponivel && (!produto.ativo || !galeria.produtoIds.includes(produto.id))) falhar('produto_invalido', 'Um item não está disponível nesta galeria.')
    if (!Array.isArray(item.fotoIds) || item.fotoIds.length > 1000 || new Set(item.fotoIds).size !== item.fotoIds.length || item.fotoIds.some(fotoId => !galeria.fotos.some(foto => foto.id === fotoId))) falhar('foto_invalida', 'Use até 1000 fotos distintas pertencentes à galeria.')
    if (produto!.tipo === 'produto' && item.fotoIds.length === 0) falhar('pacote_vazio', 'Escolha ao menos uma foto para o pacote digital.')
    return { produtoId: item.produtoId, fotoIds: [...item.fotoIds].sort() }
  }).sort((a, b) => a.produtoId.localeCompare(b.produtoId))
}
const payload = (itens: ItemCarrinhoLocal[]) => JSON.stringify(itens.map(item => ({ produtoId: item.produtoId, fotoIds: [...item.fotoIds].sort() })).sort((a, b) => a.produtoId.localeCompare(b.produtoId)))
const cotacao = (itens: ItemResumoLojaLocal[]) => JSON.stringify(itens.map(item => ({ produtoId: item.produtoId, totalCentavos: item.totalCentavos, comissaoBps: item.financeiro.comissaoBps })).sort((a, b) => a.produtoId.localeCompare(b.produtoId)))
const cotacaoEsperada = (itens: CotacaoItemLojaLocal[]) => JSON.stringify(itens.map(item => ({ produtoId: item.produtoId, totalCentavos: item.totalCentavos, comissaoBps: item.comissaoBps })).sort((a, b) => a.produtoId.localeCompare(b.produtoId)))

export function lerLoja(estado: EstadoLocal): EstadoLojaLocal {
  const loja = (estado as EstadoComLoja).loja
  if (loja === undefined) return { carrinhos: [], compras: [] }
  if (!validarLoja(loja, estado)) falhar('loja_invalida', 'Os dados da loja local não puderam ser validados.')
  return structuredClone(loja)
}

export function resumirCarrinho(estado: EstadoLocal, galeriaId: string, itens?: ItemCarrinhoLocal[]): ResumoCarrinhoLocal {
  const galeria = galeriaValida(estado, galeriaId)
  const escolhas = canonicalizarItens(estado, galeria, itens ?? lerLoja(estado).carrinhos.find(carrinho => carrinho.galeriaId === galeriaId)?.itens ?? [], true)
  const config = lerConfigComercial(estado)
  const resumo = escolhas.map(item => {
    const produto = estado.catalogo.find(produto => produto.id === item.produtoId)!
    return { ...item, produtoNome: produto.nome, produtoTipo: produto.tipo, fotos: item.fotoIds.map(fotoId => fotoSnapshot(galeria.fotos.find(foto => foto.id === fotoId)!)), totalCentavos: produto.precoCentavos, financeiro: calcularFinanceiroLocal(galeria.tipo, produto.tipo, produto.precoCentavos, config) }
  })
  const sobConsulta = resumo.some(item => item.totalCentavos === null)
  return { itens: resumo, totalCentavos: sobConsulta ? null : soma(resumo.map(item => item.totalCentavos!)), comissaoCentavos: sobConsulta ? null : soma(resumo.map(item => item.financeiro.comissaoCentavos!)), liquidoCentavos: sobConsulta ? null : soma(resumo.map(item => item.financeiro.liquidoCentavos!)) }
}

export function aplicarLoja(estado: EstadoLocal, comando: ComandoLojaLocal): EstadoLocal {
  const galeria = galeriaValida(estado, comando.galeriaId)
  if (!galeria.acesso.ativo) falhar('acesso_revogado', 'O acesso a esta galeria está revogado.')
  const loja = lerLoja(estado)
  const carrinho = loja.carrinhos.find(item => item.galeriaId === galeria.id) ?? { galeriaId: galeria.id, itens: [] }
  const agora = new Date().toISOString()
  let atividade: string
  if (comando.tipo === 'checkout') {
    if (!comando.chave || comando.chave.length > 160 || !['pago_simulado', 'recusado_simulado'].includes(comando.resultado)) falhar('confirmacao_invalida', 'Informe uma confirmação e um resultado válidos para a simulação.')
    const itens = canonicalizarItens(estado, galeria, comando.itens, false)
    const existente = loja.compras.find(compra => compra.chave === comando.chave)
    if (existente) {
      if (existente.galeriaId !== galeria.id || existente.status !== comando.resultado || payload(existente.itens) !== payload(itens) || comando.totalEsperadoCentavos !== undefined && comando.totalEsperadoCentavos !== existente.totalCentavos || comando.cotacaoEsperada !== undefined && cotacaoEsperada(comando.cotacaoEsperada) !== cotacao(existente.itens)) falhar('conflito_idempotencia', 'Esta confirmação já foi usada para outra compra ou resultado.')
      return estado
    }
    if (!galeria.acesso.ativo) falhar('acesso_revogado', 'O acesso a esta galeria está revogado.')
    if (itens.length === 0) falhar('carrinho_vazio', 'Adicione um pacote ao carrinho antes de concluir.')
    if (payload(carrinho.itens) !== payload(itens)) falhar('carrinho_alterado', 'O carrinho mudou. Revise os itens antes de confirmar.')
    const resumo = resumirCarrinho(estado, galeria.id, itens)
    if (resumo.totalCentavos === null) falhar('preco_sob_consulta', 'Itens sob consulta precisam de um preço antes do checkout simulado.')
    if (comando.totalEsperadoCentavos !== undefined && comando.totalEsperadoCentavos !== resumo.totalCentavos || comando.cotacaoEsperada !== undefined && cotacaoEsperada(comando.cotacaoEsperada) !== cotacao(resumo.itens)) falhar('preco_alterado', 'Os preços ou as comissões do carrinho mudaram. Revise os valores antes de confirmar.')
    const compra: CompraLocal = { id: crypto.randomUUID(), proprietarioId: estado.proprietarioId, galeriaId: galeria.id, chave: comando.chave, criadaEm: agora, status: comando.resultado, simulacao: true, itens: resumo.itens as ItemCompraLocal[], totalCentavos: resumo.totalCentavos!, comissaoCentavos: resumo.comissaoCentavos!, liquidoCentavos: resumo.liquidoCentavos! }
    loja.compras.unshift(compra)
    if (comando.resultado === 'pago_simulado') carrinho.itens = []
    atividade = comando.resultado === 'pago_simulado' ? `Compra simulada aprovada: ${resumo.itens.length} pacote(s). Nenhum pagamento real.` : 'Compra simulada recusada; nenhuma entrega liberada.'
  } else if (comando.tipo === 'definir_item') {
    if (!galeria.acesso.ativo) falhar('acesso_revogado', 'O acesso a esta galeria está revogado.')
    const item = canonicalizarItens(estado, galeria, [{ produtoId: comando.produtoId, fotoIds: comando.fotoIds }], true)[0]
    carrinho.itens = [...carrinho.itens.filter(atual => atual.produtoId !== item.produtoId), item]
    if (carrinho.itens.length > 100) falhar('itens_invalidos', 'Use no máximo 100 itens distintos no carrinho.')
    atividade = 'Pacote do carrinho local atualizado com os IDs das fotos escolhidas.'
  } else if (comando.tipo === 'remover_item') {
    const produto = estado.catalogo.find(item => item.id === comando.produtoId && item.proprietarioId === estado.proprietarioId)
    if (!produto) falhar('produto_invalido', 'Item indisponível neste estúdio.')
    carrinho.itens = carrinho.itens.filter(item => item.produtoId !== comando.produtoId)
    atividade = 'Pacote removido do carrinho local.'
  } else return falhar('comando_invalido', 'Ação de loja desconhecida.')
  loja.carrinhos = [...loja.carrinhos.filter(item => item.galeriaId !== galeria.id), carrinho]
  const novo: EstadoComLoja = { ...structuredClone(estado), loja }
  novo.atividades.unshift({ id: crypto.randomUUID(), galeriaId: galeria.id, texto: atividade, criadaEm: agora })
  return novo
}

/** Entrega somente pacotes digitais aprovados; serviço adquirido não vende os originais anexos. */
export function fotosDisponiveisCompra(estado: EstadoLocal, compraId: string): FotoCompraLocal[] {
  const compra = lerLoja(estado).compras.find(item => item.id === compraId && item.proprietarioId === estado.proprietarioId)
  if (!compra || compra.status !== 'pago_simulado') return falhar('entrega_negada', 'Esta compra não tem entrega liberada.')
  const galeria = galeriaValida(estado, compra.galeriaId)
  if (!galeria.acesso.ativo) falhar('acesso_revogado', 'O acesso a esta galeria está revogado.')
  const fotos = compra.itens.filter(item => item.produtoTipo === 'produto').flatMap(item => item.fotos)
  return structuredClone([...new Map(fotos.map(foto => [foto.id, foto])).values()])
}

export function validarLoja(valor: unknown, estado: EstadoLocal): valor is EstadoLojaLocal {
  try {
    if (!registro(valor) || !Array.isArray(valor.carrinhos) || !Array.isArray(valor.compras)) return false
    const galeriasCarrinho = new Set<string>()
    for (const carrinho of valor.carrinhos) {
      if (!registro(carrinho) || typeof carrinho.galeriaId !== 'string' || galeriasCarrinho.has(carrinho.galeriaId) || !Array.isArray(carrinho.itens)) return false
      galeriasCarrinho.add(carrinho.galeriaId)
      canonicalizarItens(estado, galeriaValida(estado, carrinho.galeriaId), carrinho.itens as ItemCarrinhoLocal[], false)
    }
    const ids = new Set<string>(), chaves = new Set<string>()
    for (const compra of valor.compras) {
      if (!registro(compra) || typeof compra.id !== 'string' || !compra.id || ids.has(compra.id) || typeof compra.chave !== 'string' || !compra.chave || compra.chave.length > 160 || chaves.has(compra.chave) || compra.proprietarioId !== estado.proprietarioId || typeof compra.galeriaId !== 'string' || !['pago_simulado', 'recusado_simulado'].includes(compra.status as string) || compra.simulacao !== true || typeof compra.criadaEm !== 'string' || Number.isNaN(Date.parse(compra.criadaEm)) || !Array.isArray(compra.itens) || compra.itens.length === 0) return false
      ids.add(compra.id); chaves.add(compra.chave)
      const galeria = galeriaValida(estado, compra.galeriaId)
      canonicalizarItens(estado, galeria, compra.itens as ItemCarrinhoLocal[], false)
      for (const item of compra.itens) {
        if (!registro(item) || typeof item.produtoNome !== 'string' || !item.produtoNome || !['produto', 'servico'].includes(item.produtoTipo as string) || !centavos(item.totalCentavos) || !validarFinanceiroPedido(item.financeiro, item.totalCentavos) || !Array.isArray(item.fotos) || item.fotos.length !== (item.fotoIds as string[]).length) return false
        const produto = estado.catalogo.find(produto => produto.id === item.produtoId)
        if (produto?.tipo !== item.produtoTipo || item.produtoTipo === 'servico' && item.financeiro.comissaoBps !== 0) return false
        const fotoIds = new Set<string>()
        for (const foto of item.fotos) {
          if (!registro(foto) || typeof foto.id !== 'string' || fotoIds.has(foto.id) || !(item.fotoIds as string[]).includes(foto.id)) return false
          fotoIds.add(foto.id)
          const original = galeria.fotos.find(original => original.id === foto.id)
          if (!original || JSON.stringify(fotoSnapshot(original)) !== JSON.stringify({ id: foto.id, nome: foto.nome, url: foto.url, bytes: foto.bytes, tipo: foto.tipo })) return false
        }
      }
      const itens = compra.itens as ItemCompraLocal[]
      if (compra.totalCentavos !== soma(itens.map(item => item.totalCentavos)) || compra.comissaoCentavos !== soma(itens.map(item => item.financeiro.comissaoCentavos)) || compra.liquidoCentavos !== soma(itens.map(item => item.financeiro.liquidoCentavos)) || compra.liquidoCentavos !== compra.totalCentavos - compra.comissaoCentavos) return false
    }
    return true
  } catch { return false }
}
