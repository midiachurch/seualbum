/** Sandbox de produto. As guardas de domínio locais não substituem Auth/RLS. */
import { calcularFinanceiroLocal, configPadrao, lerConfigComercial, validarConfigComercial, type ConfigComercialLocal, type FinanceiroPedidoLocal } from './comercial'
import { aplicarProducao, type EstadoProducaoLocal, type ComandoProducaoLocal } from './producao'
import { aplicarLoja, type EstadoLojaLocal, type ComandoLojaLocal } from './loja'
import { aplicarAssinatura, type CicloAssinaturaLocal, type ComandoAssinaturaLocal } from './assinatura'
export type TipoGaleriaLocal = 'selecao' | 'inteligente'
export interface FotoLocal { id: string; nome: string; url: string; bytes: number; tipo: string; participantes: string[] }
export interface SelecaoLocal { id: string; chave: string; revisao: number; revisaoEsperada: number; fotoIds: string[]; entregueEm: string }
export interface GaleriaLocal {
  id: string; proprietarioId: string; nome: string; cliente: string; tipo: TipoGaleriaLocal; criadaEm: string
  fotos: FotoLocal[]; favoritas: string[]; selecoes: SelecaoLocal[]
  acesso: { codigo: string; ativo: boolean }; produtoIds: string[]
}
export interface EventoLocal { id: string; proprietarioId: string; nome: string; data: string; local: string; galeriaId: string }
export interface ProdutoLocal { id: string; proprietarioId: string; nome: string; tipo: 'produto' | 'servico'; descricao: string; precoCentavos: number | null; ativo: boolean }
export interface PedidoLocal { id: string; proprietarioId: string; galeriaId: string; produtoId: string; produtoNome: string; fotoIds: string[]; totalCentavos: number | null; financeiro?: FinanceiroPedidoLocal; criadoEm: string; status: 'solicitado' | 'em_preparacao' | 'concluido' | 'cancelado'; simulacao: true }
export interface AtividadeLocal { id: string; galeriaId: string | null; texto: string; criadaEm: string }
export interface NotificacaoLocal { id: string; atividadeId: string; galeriaId: string | null; texto: string; criadaEm: string; lidaEm: string | null }
export interface MensagemLocal { id: string; galeriaId: string; autor: 'fotografo' | 'cliente'; texto: string; criadaEm: string; chave: string }
export interface EstadoLocal {
  versao: 1; proprietarioId: string; galerias: GaleriaLocal[]; eventos: EventoLocal[]; catalogo: ProdutoLocal[]
  pedidos: PedidoLocal[]; assinatura: { plano: string; status: 'nao_contratada' | 'simulada'; simulacao: true; planoId?: string; precoMensalCentavos?: number; armazenamentoBytes?: number }; atividades: AtividadeLocal[]
  comercial?: ConfigComercialLocal
  producao?: EstadoProducaoLocal
  loja?: EstadoLojaLocal
  cicloAssinatura?: CicloAssinaturaLocal
  ciclosAssinaturaAnteriores?: CicloAssinaturaLocal[]
  notificacoes?: NotificacaoLocal[]
  mensagens?: MensagemLocal[]
}

export type ComandoLocal =
  | { tipo: 'criar_galeria'; nome: string; cliente: string; galeriaTipo: TipoGaleriaLocal; codigo: string }
  | { tipo: 'adicionar_fotos'; galeriaId: string; fotos: FotoLocal[] }
  | { tipo: 'definir_favorita'; galeriaId: string; fotoId: string; favorita: boolean }
  | { tipo: 'entregar_selecao'; galeriaId: string; fotoIds: string[]; revisaoEsperada: number; chave: string }
  | { tipo: 'alterar_acesso'; galeriaId: string; ativo: boolean; codigo?: string }
  | { tipo: 'marcar_participante'; galeriaId: string; fotoId: string; participante: string; presente: boolean }
  | { tipo: 'criar_evento'; nome: string; data: string; local: string; galeriaId: string }
  | { tipo: 'criar_produto'; nome: string; produtoTipo: 'produto' | 'servico'; descricao: string; precoCentavos: number | null }
  | { tipo: 'editar_produto'; produtoId: string; nome: string; precoCentavos: number | null }
  | { tipo: 'vincular_produto'; galeriaId: string; produtoId: string; vinculado: boolean }
  | { tipo: 'criar_pedido'; galeriaId: string; produtoId: string; fotoIds: string[] }
  | { tipo: 'alterar_pedido'; pedidoId: string; status: PedidoLocal['status'] }
  | { tipo: 'simular_assinatura'; plano: string }
  | { tipo: 'configurar_comercial'; config: ConfigComercialLocal }
  | { tipo: 'escolher_plano'; planoId: string }
  | { tipo: 'producao'; comando: ComandoProducaoLocal }
  | { tipo: 'loja'; comando: ComandoLojaLocal }
  | { tipo: 'assinatura'; comando: ComandoAssinaturaLocal }
  | { tipo: 'ler_notificacao'; id: string }
  | { tipo: 'enviar_mensagem'; galeriaId: string; autor: MensagemLocal['autor']; texto: string; chave: string }

export class ErroOperacaoLocal extends Error {
  constructor(public codigo: string, mensagem: string) { super(mensagem); this.name = 'ErroOperacaoLocal' }
}
const falhar = (codigo: string, mensagem: string): never => { throw new ErroOperacaoLocal(codigo, mensagem) }
const texto = (valor: string, campo: string, max = 160): string => {
  const limpo = valor.trim()
  if (!limpo || limpo.length > max) falhar('campo_invalido', `${campo}: informe entre 1 e ${max} caracteres.`)
  return limpo
}
const id = (): string => globalThis.crypto.randomUUID()
const validarCodigo = (codigo: string): string => {
  const limpo = codigo.trim()
  if (!/^[a-zA-Z0-9-]{4,32}$/.test(limpo)) falhar('codigo_invalido', 'Use um código de 4 a 32 letras, números ou hífen.')
  return limpo
}
const validarPreco = (valor: number | null) => {
  if (valor !== null && (!Number.isSafeInteger(valor) || valor < 0)) falhar('preco_invalido', 'Informe um valor inteiro em centavos ou deixe sob consulta.')
}
export function urlFotoLocalValida(url: string, fotoId: string): boolean {
  return url === `arquivo-local:${fotoId}` || /^\/images\/[a-zA-Z0-9_./-]+$/.test(url) && !url.includes('..')
}
function galeriaDoDono(estado: EstadoLocal, galeriaId: string, proprietarioId: string): GaleriaLocal {
  const galeria = estado.galerias.find(item => item.id === galeriaId && item.proprietarioId === proprietarioId)
  if (!galeria) return falhar('acesso_negado', 'Galeria indisponível neste estúdio.')
  return galeria
}
function fotosDaGaleria(galeria: GaleriaLocal, fotoIds: string[]): string[] {
  if (fotoIds.length > 1000 || new Set(fotoIds).size !== fotoIds.length) falhar('fotos_invalidas', 'A lista deve conter até 1000 fotos distintas.')
  if (fotoIds.some(fotoId => !galeria.fotos.some(foto => foto.id === fotoId))) falhar('foto_invalida', 'A foto não pertence à galeria.')
  return [...fotoIds].sort()
}

/** Retorna novo estado; falhas não modificam o estado recebido. */
function aplicarComandoInterno(estado: EstadoLocal, comando: ComandoLocal, proprietarioId = estado.proprietarioId): EstadoLocal {
  if (!proprietarioId || estado.proprietarioId !== proprietarioId) falhar('acesso_negado', 'Estúdio inválido.')
  const novo = structuredClone(estado)
  const agora = new Date().toISOString()
  const galeria = 'galeriaId' in comando ? galeriaDoDono(novo, comando.galeriaId, proprietarioId) : null
  const registrar = (mensagem: string, galeriaId: string | null = galeria?.id ?? null) => novo.atividades.unshift({ id: id(), galeriaId, texto: mensagem, criadaEm: agora })
  switch (comando.tipo) {
    case 'producao': return aplicarProducao(estado, comando.comando)
    case 'loja': return aplicarLoja(estado, comando.comando)
    case 'assinatura': return aplicarAssinatura(estado, comando.comando)
    case 'ler_notificacao': {
      const notificacao = novo.notificacoes?.find(item => item.id === comando.id)
      if (!notificacao) falhar('notificacao_invalida', 'Notificação indisponível.')
      notificacao!.lidaEm ??= agora
      break
    }
    case 'enviar_mensagem': {
      if (!['fotografo', 'cliente'].includes(comando.autor) || comando.autor === 'cliente' && !galeria!.acesso.ativo) falhar('acesso_negado', 'Conversa indisponível neste acesso.')
      const conteudo = texto(comando.texto, 'Mensagem', 2000)
      const chave = texto(comando.chave, 'Chave da mensagem')
      const anterior = novo.mensagens?.find(item => item.galeriaId === galeria!.id && item.chave === chave)
      if (anterior) {
        if (anterior.autor !== comando.autor || anterior.texto !== conteudo) falhar('conflito_idempotencia', 'Esta mensagem já foi enviada com outro conteúdo.')
        return estado
      }
      novo.mensagens = [...(novo.mensagens ?? []), { id: id(), galeriaId: galeria!.id, autor: comando.autor, texto: conteudo, criadaEm: agora, chave }]
      registrar(`Mensagem enviada pelo ${comando.autor === 'cliente' ? 'cliente' : 'fotógrafo'}.`)
      break
    }
    case 'criar_galeria': {
      if (!['selecao', 'inteligente'].includes(comando.galeriaTipo)) falhar('tipo_invalido', 'Tipo de galeria inválido.')
      const nova: GaleriaLocal = { id: id(), proprietarioId, nome: texto(comando.nome, 'Nome'), cliente: texto(comando.cliente, 'Cliente'), tipo: comando.galeriaTipo, criadaEm: agora, fotos: [], favoritas: [], selecoes: [], acesso: { codigo: validarCodigo(comando.codigo), ativo: true }, produtoIds: [] }
      novo.galerias.unshift(nova)
      registrar(`Galeria ${nova.nome} criada.`, nova.id)
      break
    }
    case 'adicionar_fotos': {
      if (!galeria || comando.fotos.length === 0) falhar('fotos_invalidas', 'Selecione ao menos uma foto.')
      const ids = new Set(novo.galerias.flatMap(item => item.fotos.map(foto => foto.id)))
      for (const foto of comando.fotos) {
        if (ids.has(foto.id) || !foto.id || !foto.nome.trim() || !Number.isSafeInteger(foto.bytes) || foto.bytes < 0 || !urlFotoLocalValida(foto.url, foto.id)) falhar('foto_invalida', 'Arquivo ou identidade de foto inválidos.')
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(foto.tipo)) falhar('tipo_invalido', 'Neste ambiente local, use JPG, PNG, WebP ou GIF.')
        ids.add(foto.id)
      }
      galeria!.fotos.push(...structuredClone(comando.fotos))
      registrar(`${comando.fotos.length} foto(s) adicionada(s).`)
      break
    }
    case 'definir_favorita': {
      fotosDaGaleria(galeria!, [comando.fotoId])
      galeria!.favoritas = galeria!.favoritas.filter(fotoId => fotoId !== comando.fotoId)
      if (comando.favorita) galeria!.favoritas.push(comando.fotoId)
      break
    }
    case 'entregar_selecao': {
      const fotoIds = fotosDaGaleria(galeria!, comando.fotoIds)
      if (fotoIds.length === 0) falhar('selecao_vazia', 'Selecione ao menos uma foto antes de entregar.')
      texto(comando.chave, 'Chave de confirmação')
      const existente = galeria!.selecoes.find(selecao => selecao.chave === comando.chave)
      if (existente) {
        if (existente.revisaoEsperada !== comando.revisaoEsperada || JSON.stringify(existente.fotoIds) !== JSON.stringify(fotoIds)) falhar('conflito_idempotencia', 'Esta confirmação já foi usada para outra seleção ou revisão.')
        return estado
      }
      if (galeria!.selecoes.length !== comando.revisaoEsperada) falhar('conflito_revisao', 'A seleção foi atualizada. Recarregue antes de confirmar.')
      galeria!.selecoes.push({ id: id(), chave: comando.chave, revisao: galeria!.selecoes.length + 1, revisaoEsperada: comando.revisaoEsperada, fotoIds, entregueEm: agora })
      registrar(`Seleção entregue: ${fotoIds.length} foto(s), revisão ${galeria!.selecoes.length}.`)
      break
    }
    case 'alterar_acesso':
      galeria!.acesso = { ativo: comando.ativo, codigo: comando.codigo === undefined ? galeria!.acesso.codigo : validarCodigo(comando.codigo) }
      registrar(comando.ativo ? 'Acesso local habilitado.' : 'Acesso local revogado.')
      break
    case 'marcar_participante': {
      fotosDaGaleria(galeria!, [comando.fotoId])
      const participante = texto(comando.participante, 'Participante', 80)
      const foto = galeria!.fotos.find(item => item.id === comando.fotoId)!
      foto.participantes = foto.participantes.filter(item => item !== participante)
      if (comando.presente) foto.participantes.push(participante)
      break
    }
    case 'criar_evento':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(comando.data) || Number.isNaN(Date.parse(comando.data)) || new Date(comando.data).toISOString().slice(0, 10) !== comando.data) falhar('data_invalida', 'Informe uma data válida para o evento.')
      novo.eventos.unshift({ id: id(), proprietarioId, nome: texto(comando.nome, 'Nome do evento'), data: comando.data, local: texto(comando.local, 'Local'), galeriaId: galeria!.id })
      registrar('Evento vinculado à galeria.')
      break
    case 'criar_produto':
      validarPreco(comando.precoCentavos)
      if (!['produto', 'servico'].includes(comando.produtoTipo)) falhar('tipo_invalido', 'Tipo de item inválido.')
      novo.catalogo.unshift({ id: id(), proprietarioId, nome: texto(comando.nome, 'Nome'), tipo: comando.produtoTipo, descricao: comando.descricao.trim().slice(0, 2000), precoCentavos: comando.precoCentavos, ativo: true })
      registrar('Item adicionado ao catálogo local.')
      break
    case 'vincular_produto': {
      const produto = novo.catalogo.find(item => item.id === comando.produtoId && item.proprietarioId === proprietarioId && item.ativo)
      if (!produto) falhar('produto_invalido', 'Item indisponível neste estúdio.')
      galeria!.produtoIds = galeria!.produtoIds.filter(produtoId => produtoId !== comando.produtoId)
      if (comando.vinculado) galeria!.produtoIds.push(comando.produtoId)
      break
    }
    case 'editar_produto': {
      const produto = novo.catalogo.find(item => item.id === comando.produtoId && item.proprietarioId === proprietarioId)
      if (!produto) falhar('produto_invalido', 'Item indisponível neste estúdio.')
      validarPreco(comando.precoCentavos)
      produto!.nome = texto(comando.nome, 'Nome')
      produto!.precoCentavos = comando.precoCentavos
      registrar('Nome e preço simulado do item atualizados.')
      break
    }
    case 'criar_pedido': {
      const produto = novo.catalogo.find(item => item.id === comando.produtoId && item.proprietarioId === proprietarioId && item.ativo)
      if (!produto || !galeria!.produtoIds.includes(comando.produtoId)) falhar('produto_invalido', 'Este item não está disponível nesta galeria.')
      const fotoIds = fotosDaGaleria(galeria!, comando.fotoIds)
      const financeiro = calcularFinanceiroLocal(galeria!.tipo, produto!.tipo, produto!.precoCentavos, lerConfigComercial(novo))
      novo.pedidos.unshift({ id: id(), proprietarioId, galeriaId: galeria!.id, produtoId: produto!.id, produtoNome: produto!.nome, fotoIds, totalCentavos: produto!.precoCentavos, financeiro, criadoEm: agora, status: 'solicitado', simulacao: true })
      registrar(`Solicitação local de ${produto!.nome} criada, sem cobrança.`)
      break
    }
    case 'alterar_pedido': {
      const pedido = novo.pedidos.find(item => item.id === comando.pedidoId && item.proprietarioId === proprietarioId)
      if (!pedido) falhar('acesso_negado', 'Pedido indisponível neste estúdio.')
      const transicoes: Record<PedidoLocal['status'], PedidoLocal['status'][]> = { solicitado: ['em_preparacao', 'cancelado'], em_preparacao: ['concluido', 'cancelado'], concluido: [], cancelado: [] }
      if (pedido!.status === comando.status) return estado
      if (!transicoes[pedido!.status].includes(comando.status)) falhar('transicao_invalida', 'Esta mudança de etapa não está disponível.')
      pedido!.status = comando.status
      registrar(`Solicitação passou para ${comando.status.replaceAll('_', ' ')}.`, pedido!.galeriaId)
      break
    }
    case 'simular_assinatura':
      novo.assinatura = { plano: texto(comando.plano, 'Plano'), status: 'simulada', simulacao: true }
      registrar('Assinatura simulada localmente, sem cobrança ou renovação automática.')
      break
    case 'configurar_comercial':
      if (!validarConfigComercial(comando.config)) falhar('configuracao_invalida', 'Revise planos, preços, armazenamento e percentuais da simulação.')
      novo.comercial = structuredClone(comando.config)
      registrar('Hipóteses comerciais locais atualizadas; solicitações e assinatura anteriores foram preservadas.')
      break
    case 'escolher_plano': {
      const plano = lerConfigComercial(novo).planos.find(item => item.id === comando.planoId)
      if (!plano) falhar('plano_invalido', 'Plano indisponível nesta simulação.')
      novo.assinatura = { plano: plano!.nome, status: 'simulada', simulacao: true, planoId: plano!.id, precoMensalCentavos: plano!.precoMensalCentavos, armazenamentoBytes: plano!.armazenamentoBytes }
      registrar(`Plano ${plano!.nome} escolhido na simulação, sem cobrança ou renovação automática.`)
      break
    }
  }
  return novo
}

/** Notificações nascem de atividades reais; retries não geram novos avisos. */
export function aplicarComando(estado: EstadoLocal, comando: ComandoLocal, proprietarioId = estado.proprietarioId): EstadoLocal {
  const atualizado = aplicarComandoInterno(estado, comando, proprietarioId)
  if (atualizado === estado) return estado
  const anteriores = new Set(estado.atividades.map(item => item.id))
  const notificadas = new Set(atualizado.notificacoes?.map(item => item.atividadeId) ?? [])
  const novas = atualizado.atividades.filter(item => !anteriores.has(item.id) && !notificadas.has(item.id))
  if (novas.length) atualizado.notificacoes = [
    ...novas.map(item => ({ id: id(), atividadeId: item.id, galeriaId: item.galeriaId, texto: item.texto, criadaEm: item.criadaEm, lidaEm: null })),
    ...(atualizado.notificacoes ?? []),
  ]
  return atualizado
}

export function listarGalerias(estado: EstadoLocal, proprietarioId: string): GaleriaLocal[] {
  return estado.proprietarioId === proprietarioId ? estado.galerias.filter(galeria => galeria.proprietarioId === proprietarioId) : []
}

/** Consumo dos arquivos importados; imagens demonstrativas possuem bytes=0. Não é uma franquia comercial. */
export function calcularConsumoLocal(estado: EstadoLocal): { bytes: number; fotos: number; galerias: number } {
  const galerias = listarGalerias(estado, estado.proprietarioId)
  const fotos = galerias.flatMap(galeria => galeria.fotos)
  const bytes = fotos.reduce((total, foto) => total + foto.bytes, 0)
  if (fotos.some(foto => !Number.isSafeInteger(foto.bytes) || foto.bytes < 0) || !Number.isSafeInteger(bytes)) falhar('consumo_invalido', 'O consumo local contém valores inválidos.')
  return { bytes, fotos: fotos.length, galerias: galerias.length }
}

/** Conveniência de navegação local, nunca autenticação ou proteção de dados reais. */
export function verificarAcessoLocal(galeria: GaleriaLocal, codigo: string): boolean {
  return galeria.acesso.ativo && galeria.acesso.codigo === codigo.trim()
}

export function criarEstadoInicial(proprietarioId = 'estudio-local'): EstadoLocal {
  const criadaEm = new Date().toISOString()
  const foto = (fotoId: string, nome: string, url: string, participantes: string[]): FotoLocal => ({ id: fotoId, nome, url, bytes: 0, tipo: 'image/webp', participantes })
  return {
    versao: 1, proprietarioId, comercial: configPadrao(),
    galerias: [
      { id: 'galeria-ensaio', proprietarioId, nome: 'Ensaio editorial', cliente: 'Cliente de demonstração', tipo: 'selecao', criadaEm, fotos: [foto('foto-1', 'editorial.webp', '/images/estilos/editorial.webp', ['Participante A']), foto('foto-2', 'fineart.webp', '/images/estilos/fineart.webp', ['Participante A']), foto('foto-3', 'classico.webp', '/images/estilos/classico.webp', ['Participante B']), foto('foto-4', 'moderno.webp', '/images/estilos/moderno.webp', ['Participante B'])], favoritas: [], selecoes: [], acesso: { codigo: 'LOCAL2026', ativo: true }, produtoIds: ['servico-diagramacao'] },
      { id: 'galeria-evento', proprietarioId, nome: 'Encontro criativo', cliente: 'Evento de demonstração', tipo: 'inteligente', criadaEm, fotos: [foto('evento-1', 'estudio.webp', '/images/servicos/estudio.webp', ['Participante A']), foto('evento-2', 'servicos.webp', '/images/servicos/servicos.webp', ['Participante B'])], favoritas: [], selecoes: [], acesso: { codigo: 'EVENTO2026', ativo: true }, produtoIds: ['produto-digital'] },
    ],
    eventos: [{ id: 'evento-demo', proprietarioId, nome: 'Encontro criativo', data: criadaEm.slice(0, 10), local: 'Espaço de demonstração', galeriaId: 'galeria-evento' }],
    catalogo: [{ id: 'servico-diagramacao', proprietarioId, nome: 'Diagramação de álbum', tipo: 'servico', descricao: 'Preço de hipótese local para simular um serviço complementar.', precoCentavos: 19900, ativo: true }, { id: 'produto-digital', proprietarioId, nome: 'Coleção digital', tipo: 'produto', descricao: 'Preço de hipótese local para simular um produto vinculado ao evento.', precoCentavos: 9900, ativo: true }],
    pedidos: [], assinatura: { plano: '', status: 'nao_contratada', simulacao: true }, atividades: [],
  }
}
