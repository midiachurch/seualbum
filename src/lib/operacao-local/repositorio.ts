import { criarEstadoInicial, ErroOperacaoLocal, urlFotoLocalValida, type EstadoLocal } from './modelo'
import { validarProducao } from './producao'
import { validarLoja } from './loja'
import { validarCicloAssinatura } from './assinatura'
import { validarConfigComercial, validarFinanceiroPedido } from './comercial'

export const CHAVE_ESTADO_LOCAL = 'seualbum:operacao-local:v1'
export interface ArmazenamentoLocal { getItem(chave: string): string | null; setItem(chave: string, valor: string): void }
const registro = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null && !Array.isArray(valor)
const string = (valor: unknown): valor is string => typeof valor === 'string'
const strings = (valor: unknown): valor is string[] => Array.isArray(valor) && valor.every(string)
const data = (valor: unknown) => string(valor) && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(valor) && !Number.isNaN(Date.parse(valor)) && new Date(valor).toISOString().slice(0, 10) === valor.slice(0, 10)
const centavos = (valor: unknown) => valor === null || typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
const arrayDe = (valor: unknown, validar: (item: Record<string, unknown>) => boolean): boolean => Array.isArray(valor) && valor.every(item => registro(item) && validar(item))
const idsUnicos = (valor: unknown[]): boolean => new Set(valor.map(item => (item as { id: string }).id)).size === valor.length

/** Valida dados não confiáveis vindos de disco; nunca faz cast antes da inspeção. */
export function validarEstadoLocal(valor: unknown): valor is EstadoLocal {
  if (!registro(valor) || valor.versao !== 1 || !string(valor.proprietarioId) || !valor.proprietarioId) return false
  if (valor.comercial !== undefined && !validarConfigComercial(valor.comercial)) return false
  const dono = valor.proprietarioId
  if (!arrayDe(valor.galerias, galeria => {
    if (!string(galeria.id) || !galeria.id || galeria.proprietarioId !== dono || !string(galeria.nome) || !string(galeria.cliente) || !['selecao', 'inteligente'].includes(galeria.tipo as string) || !data(galeria.criadaEm)) return false
    if (!registro(galeria.acesso) || !string(galeria.acesso.codigo) || !/^[a-zA-Z0-9-]{4,32}$/.test(galeria.acesso.codigo) || typeof galeria.acesso.ativo !== 'boolean') return false
    if (!arrayDe(galeria.fotos, foto => string(foto.id) && !!foto.id && string(foto.nome) && string(foto.url) && urlFotoLocalValida(foto.url, foto.id) && typeof foto.bytes === 'number' && Number.isSafeInteger(foto.bytes) && foto.bytes >= 0 && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(foto.tipo as string) && strings(foto.participantes))) return false
    const fotos = galeria.fotos as Array<{ id: string }>
    if (!idsUnicos(fotos) || !strings(galeria.favoritas) || new Set(galeria.favoritas).size !== galeria.favoritas.length || !galeria.favoritas.every(fotoId => fotos.some(foto => foto.id === fotoId)) || !strings(galeria.produtoIds) || new Set(galeria.produtoIds).size !== galeria.produtoIds.length) return false
    if (!arrayDe(galeria.selecoes, selecao => string(selecao.id) && !!selecao.id && string(selecao.chave) && !!selecao.chave && typeof selecao.revisao === 'number' && Number.isSafeInteger(selecao.revisao) && selecao.revisao > 0 && selecao.revisaoEsperada === selecao.revisao - 1 && data(selecao.entregueEm) && strings(selecao.fotoIds) && new Set(selecao.fotoIds).size === selecao.fotoIds.length && selecao.fotoIds.length > 0 && selecao.fotoIds.length <= 1000 && selecao.fotoIds.every(fotoId => fotos.some(foto => foto.id === fotoId)))) return false
    const selecoes = galeria.selecoes as Array<{ revisao: number; chave: string }>
    return idsUnicos(galeria.selecoes as unknown[]) && new Set(selecoes.map(selecao => selecao.chave)).size === selecoes.length && selecoes.every((selecao, index) => selecao.revisao === index + 1)
  })) return false
  if (!arrayDe(valor.catalogo, produto => string(produto.id) && produto.proprietarioId === dono && string(produto.nome) && string(produto.descricao) && ['produto', 'servico'].includes(produto.tipo as string) && centavos(produto.precoCentavos) && typeof produto.ativo === 'boolean')) return false
  const galerias = valor.galerias as Array<{ id: string; fotos: Array<{ id: string; bytes: number }>; produtoIds: string[] }>
  const catalogo = valor.catalogo as Array<{ id: string; tipo: string }>
  if (!idsUnicos(galerias) || !idsUnicos(catalogo) || !idsUnicos(galerias.flatMap(galeria => galeria.fotos)) || galerias.some(galeria => galeria.produtoIds.some(produtoId => !catalogo.some(produto => produto.id === produtoId)))) return false
  if (!Number.isSafeInteger(galerias.flatMap(galeria => galeria.fotos).reduce((total, foto) => total + foto.bytes, 0))) return false
  if (!arrayDe(valor.eventos, evento => string(evento.id) && evento.proprietarioId === dono && string(evento.nome) && string(evento.local) && data(evento.data) && galerias.some(galeria => galeria.id === evento.galeriaId))) return false
  if (!arrayDe(valor.pedidos, pedido => {
    const galeria = galerias.find(item => item.id === pedido.galeriaId)
    const produto = catalogo.find(item => item.id === pedido.produtoId)
    const financeiroValido = pedido.financeiro === undefined || validarFinanceiroPedido(pedido.financeiro, pedido.totalCentavos as number | null) && (produto?.tipo !== 'servico' || pedido.financeiro.comissaoBps === 0)
    return string(pedido.id) && !!pedido.id && pedido.proprietarioId === dono && !!galeria && !!produto && string(pedido.produtoNome) && strings(pedido.fotoIds) && new Set(pedido.fotoIds).size === pedido.fotoIds.length && pedido.fotoIds.length <= 1000 && pedido.fotoIds.every(fotoId => galeria.fotos.some(foto => foto.id === fotoId)) && centavos(pedido.totalCentavos) && financeiroValido && data(pedido.criadoEm) && ['solicitado', 'em_preparacao', 'concluido', 'cancelado'].includes(pedido.status as string) && pedido.simulacao === true
  })) return false
  if (!registro(valor.assinatura) || !string(valor.assinatura.plano) || !['nao_contratada', 'simulada'].includes(valor.assinatura.status as string) || valor.assinatura.simulacao !== true) return false
  const assinatura = valor.assinatura
  if (assinatura.planoId !== undefined || assinatura.precoMensalCentavos !== undefined || assinatura.armazenamentoBytes !== undefined) {
    if (assinatura.status !== 'simulada' || !string(assinatura.planoId) || !/^[a-z0-9-]{1,50}$/.test(assinatura.planoId) || !centavos(assinatura.precoMensalCentavos) || assinatura.precoMensalCentavos === null || typeof assinatura.armazenamentoBytes !== 'number' || !Number.isSafeInteger(assinatura.armazenamentoBytes) || assinatura.armazenamentoBytes <= 0) return false
  }
  if (!arrayDe(valor.atividades, atividade => string(atividade.id) && string(atividade.texto) && data(atividade.criadaEm) && (atividade.galeriaId === null || galerias.some(galeria => galeria.id === atividade.galeriaId))) || !idsUnicos(valor.eventos as unknown[]) || !idsUnicos(valor.pedidos as unknown[])) return false
  const estado = valor as unknown as EstadoLocal
  if (valor.producao !== undefined && !validarProducao(valor.producao, estado)) return false
  if (valor.loja !== undefined && !validarLoja(valor.loja, estado)) return false
  if (valor.cicloAssinatura !== undefined && !validarCicloAssinatura(valor.cicloAssinatura, estado)) return false
  if (valor.ciclosAssinaturaAnteriores !== undefined) {
    if (!Array.isArray(valor.ciclosAssinaturaAnteriores) || !valor.ciclosAssinaturaAnteriores.every(item => validarCicloAssinatura(item, estado) && item.status === 'cancelada') || !idsUnicos(valor.ciclosAssinaturaAnteriores)) return false
    if (estado.ciclosAssinaturaAnteriores!.some(item => item.id === estado.cicloAssinatura?.id)) return false
  }
  if (valor.notificacoes !== undefined) {
    if (!arrayDe(valor.notificacoes, aviso => string(aviso.id) && string(aviso.atividadeId) && string(aviso.texto) && data(aviso.criadaEm) && (aviso.lidaEm === null || data(aviso.lidaEm)) && estado.atividades.some(item => item.id === aviso.atividadeId && item.galeriaId === aviso.galeriaId && item.texto === aviso.texto && item.criadaEm === aviso.criadaEm)) || !idsUnicos(valor.notificacoes as unknown[])) return false
    if (new Set(estado.notificacoes!.map(item => item.atividadeId)).size !== estado.notificacoes!.length) return false
  }
  if (valor.mensagens !== undefined) {
    if (!arrayDe(valor.mensagens, mensagem => string(mensagem.id) && string(mensagem.chave) && mensagem.chave.length > 0 && ['fotografo', 'cliente'].includes(mensagem.autor as string) && string(mensagem.texto) && mensagem.texto.trim().length > 0 && mensagem.texto.length <= 2000 && data(mensagem.criadaEm) && galerias.some(galeria => galeria.id === mensagem.galeriaId)) || !idsUnicos(valor.mensagens as unknown[])) return false
    if (new Set(estado.mensagens!.map(item => `${item.galeriaId}:${item.chave}`)).size !== estado.mensagens!.length) return false
  }
  return true
}

export function carregarEstado(armazenamento?: ArmazenamentoLocal): EstadoLocal {
  if (!armazenamento && typeof window === 'undefined') return criarEstadoInicial()
  let bruto: string | null
  try { bruto = (armazenamento ?? window.localStorage).getItem(CHAVE_ESTADO_LOCAL) } catch { throw new ErroOperacaoLocal('armazenamento_indisponivel', 'O navegador bloqueou o armazenamento local.') }
  if (bruto === null) return criarEstadoInicial()
  let valor: unknown
  try { valor = JSON.parse(bruto) } catch { throw new ErroOperacaoLocal('estado_invalido', 'Os dados locais estão corrompidos. Eles foram preservados para recuperação.') }
  if (!validarEstadoLocal(valor)) throw new ErroOperacaoLocal('estado_invalido', 'Os dados locais têm formato incompatível. Eles foram preservados para recuperação.')
  return valor
}

export function salvarEstado(estado: EstadoLocal, armazenamento?: ArmazenamentoLocal): void {
  if (!validarEstadoLocal(estado)) throw new ErroOperacaoLocal('estado_invalido', 'Os dados não puderam ser validados para gravação.')
  if (!armazenamento && typeof window === 'undefined') throw new ErroOperacaoLocal('armazenamento_indisponivel', 'A persistência local requer um navegador.')
  try { (armazenamento ?? window.localStorage).setItem(CHAVE_ESTADO_LOCAL, JSON.stringify(estado)) } catch { throw new ErroOperacaoLocal('armazenamento_cheio', 'Não foi possível salvar. Verifique o espaço e as permissões do navegador antes de continuar.') }
}

export function exportarEstado(estado: EstadoLocal): string {
  if (!validarEstadoLocal(estado)) throw new ErroOperacaoLocal('estado_invalido', 'Dados locais inválidos.')
  return JSON.stringify(estado, null, 2)
}

function abrirArquivos(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new ErroOperacaoLocal('arquivo_indisponivel', 'Este navegador não disponibiliza armazenamento de arquivos.')); return }
    const pedido = indexedDB.open('seualbum-operacao-local', 1)
    pedido.onupgradeneeded = () => { pedido.result.createObjectStore('arquivos') }
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(new ErroOperacaoLocal('arquivo_indisponivel', 'Não foi possível abrir os arquivos locais.'))
    pedido.onblocked = () => reject(new ErroOperacaoLocal('arquivo_bloqueado', 'Feche as outras abas para abrir o armazenamento de arquivos.'))
  })
}

export async function salvarArquivo(fotoId: string, arquivo: Blob): Promise<void> {
  if (!fotoId || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(arquivo.type) || arquivo.size > 25 * 1024 * 1024) throw new ErroOperacaoLocal('arquivo_invalido', 'Use JPG, PNG, WebP ou GIF de até 25 MB por foto.')
  const banco = await abrirArquivos()
  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction('arquivos', 'readwrite')
      transacao.objectStore('arquivos').put(arquivo, fotoId)
      transacao.oncomplete = () => resolve()
      transacao.onerror = transacao.onabort = () => reject(new ErroOperacaoLocal('arquivo_nao_salvo', 'A foto não foi salva. Verifique o espaço disponível no navegador.'))
    })
  } finally { banco.close() }
}

export async function lerArquivo(fotoId: string): Promise<Blob | null> {
  const banco = await abrirArquivos()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const pedido = banco.transaction('arquivos', 'readonly').objectStore('arquivos').get(fotoId)
      pedido.onsuccess = () => resolve(pedido.result instanceof Blob ? pedido.result : null)
      pedido.onerror = () => reject(new ErroOperacaoLocal('arquivo_indisponivel', 'Não foi possível recuperar a foto local.'))
    })
  } finally { banco.close() }
}

/** Apenas compensação de um upload ainda não confirmado no estado. */
export async function apagarArquivo(fotoId: string): Promise<void> {
  const banco = await abrirArquivos()
  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction('arquivos', 'readwrite')
      transacao.objectStore('arquivos').delete(fotoId)
      transacao.oncomplete = () => resolve()
      transacao.onerror = transacao.onabort = () => reject(new ErroOperacaoLocal('arquivo_nao_removido', 'Não foi possível desfazer o armazenamento da foto.'))
    })
  } finally { banco.close() }
}
