/** Fluxo local inspirado nas rodadas de revisão do SmartStudios, adaptado ao domínio SeuAlbum.
 * Modos locais não são identidades Auth e este módulo não autoriza acesso remoto.
 */
import type { EstadoLocal, GaleriaLocal } from './modelo'
import { calcularFinanceiroLocal, lerConfigComercial } from './comercial'

export interface LaminaProducaoLocal { id: string; nome: string; url: string; bytes: number; tipo: string; largura: number; altura: number }
export interface ComentarioProducaoLocal { id: string; chave: string; laminaId: string; texto: string; ator: 'fotografo' | 'cliente'; x: number | null; y: number | null; criadoEm: string }
export interface VersaoProducaoLocal {
  id: string; numero: number; selecaoId: string; fotoIds: string[]; status: 'rascunho' | 'publicada' | 'ajustes' | 'aprovada'
  criadaEm: string; publicadaEm: string | null; chavePublicacao: string | null
  decididaEm: string | null; chaveDecisao: string | null; mensagemDecisao: string | null
  laminas: LaminaProducaoLocal[]; comentarios: ComentarioProducaoLocal[]
}
export interface ProducaoGaleriaLocal {
  galeriaId: string; proprietarioId: string; selecaoId: string; opcao: 'propria' | 'seualbum'; revisao: number
  pedidoId: string | null; servico: { produtoId: string; nome: string; precoCentavos: number | null } | null
  versoes: VersaoProducaoLocal[]
}
export interface EstadoProducaoLocal { projetos: ProducaoGaleriaLocal[] }
type Base = { galeriaId: string; revisaoEsperada: number; ator: 'fotografo' | 'cliente' }
export type ComandoProducaoLocal = Base & (
  | { tipo: 'escolher_diagramacao'; opcao: 'propria' | 'seualbum'; selecaoId: string }
  | { tipo: 'criar_versao' }
  | { tipo: 'adicionar_laminas'; versaoId: string; laminas: LaminaProducaoLocal[] }
  | { tipo: 'remover_lamina'; versaoId: string; laminaId: string }
  | { tipo: 'publicar'; versaoId: string; chave: string }
  | { tipo: 'comentar'; versaoId: string; laminaId: string; texto: string; x?: number | null; y?: number | null; chave: string }
  | { tipo: 'solicitar_ajustes'; versaoId: string; texto: string; chave: string }
  | { tipo: 'aprovar'; versaoId: string; chave: string }
)
export class ErroProducaoLocal extends Error {
  constructor(public codigo: string, mensagem: string) { super(mensagem); this.name = 'ErroProducaoLocal' }
}
const falhar = (codigo: string, mensagem: string): never => { throw new ErroProducaoLocal(codigo, mensagem) }
const id = () => crypto.randomUUID()
const registro = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const textoValido = (v: unknown, max = 160): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const dataValida = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))
const inteiro = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min
const unico = (a: { id: string }[]) => new Set(a.map(v => v.id)).size === a.length
const iguais = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const posicaoValida = (x: unknown, y: unknown) => (x == null && y == null) || (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100 && typeof y === 'number' && Number.isFinite(y) && y >= 0 && y <= 100)
function galeriaDoDono(estado: EstadoLocal, galeriaId: string): GaleriaLocal {
  return estado.galerias.find(g => g.id === galeriaId && g.proprietarioId === estado.proprietarioId) ?? falhar('acesso_negado', 'Galeria indisponível neste estúdio.')
}
function laminaValida(v: unknown): v is LaminaProducaoLocal {
  return registro(v) && textoValido(v.id) && textoValido(v.nome, 255) && typeof v.url === 'string' &&
    (v.url === `arquivo-local:${v.id}` || /^\/images\/[a-zA-Z0-9_./-]+$/.test(v.url) && !v.url.includes('..')) &&
    inteiro(v.bytes) && v.bytes <= 25 * 1024 * 1024 && ['image/jpeg','image/png','image/webp','image/gif'].includes(v.tipo as string) &&
    inteiro(v.largura, 1) && inteiro(v.altura, 1) && v.largura <= 50000 && v.altura <= 50000
}
const producaoDe = (estado: EstadoLocal) => (estado as EstadoLocal & { producao?: EstadoProducaoLocal }).producao
export function obterProducao(estado: EstadoLocal, galeriaId: string): ProducaoGaleriaLocal | undefined {
  galeriaDoDono(estado, galeriaId)
  return producaoDe(estado)?.projetos.find(p => p.galeriaId === galeriaId && p.proprietarioId === estado.proprietarioId)
}

/** A seleção já entregue é a única fonte da produção. Favoritos posteriores não alteram o snapshot. */
export function aplicarProducao(estado: EstadoLocal, comando: ComandoProducaoLocal): EstadoLocal {
  const galeria = galeriaDoDono(estado, comando.galeriaId)
  if (!['fotografo','cliente'].includes(comando.ator)) falhar('ator_invalido', 'Escolha um modo local válido.')
  if (comando.ator === 'cliente' && !galeria.acesso.ativo) falhar('acesso_revogado', 'O acesso local desta galeria foi revogado.')
  const anterior = obterProducao(estado, galeria.id)
  if (!inteiro(comando.revisaoEsperada)) falhar('revisao_invalida', 'A revisão da produção é inválida.')
  if (['escolher_diagramacao','criar_versao','adicionar_laminas','remover_lamina','publicar'].includes(comando.tipo) && comando.ator !== 'fotografo') falhar('modo_invalido', 'Esta etapa pertence ao modo fotógrafo.')
  if (['aprovar','solicitar_ajustes'].includes(comando.tipo) && comando.ator !== 'cliente') falhar('modo_invalido', 'A decisão da prova pertence ao modo cliente.')
  if ('chave' in comando && !textoValido(comando.chave)) falhar('chave_invalida', 'Informe uma chave válida para confirmar a ação.')

  // Retry é verificado antes do número da revisão; uma ação confirmada continua idempotente.
  if ('chave' in comando && anterior) {
    for (const v of anterior.versoes) {
      if (v.chavePublicacao === comando.chave) {
        if (comando.tipo === 'publicar' && comando.versaoId === v.id) return estado
        falhar('conflito_idempotencia', 'Esta chave já confirmou outra ação da prova.')
      }
      if (v.chaveDecisao === comando.chave) {
        if (comando.versaoId === v.id && ((comando.tipo === 'aprovar' && v.status === 'aprovada') || (comando.tipo === 'solicitar_ajustes' && v.status === 'ajustes' && comando.texto.trim() === v.mensagemDecisao))) return estado
        falhar('conflito_idempotencia', 'Esta chave já confirmou outra decisão da prova.')
      }
      const c = v.comentarios.find(c => c.chave === comando.chave)
      if (c) {
        if (comando.tipo === 'comentar' && comando.versaoId === v.id && comando.laminaId === c.laminaId && comando.texto.trim() === c.texto && comando.ator === c.ator && (comando.x ?? null) === c.x && (comando.y ?? null) === c.y) return estado
        falhar('conflito_idempotencia', 'Esta chave já confirmou outro comentário.')
      }
    }
  }
  if ((anterior?.revisao ?? 0) !== comando.revisaoEsperada) falhar('conflito_revisao', 'A produção mudou. Confira a versão atual antes de continuar.')
  if (comando.tipo === 'escolher_diagramacao' && anterior) {
    if (anterior.opcao === comando.opcao && anterior.selecaoId === comando.selecaoId) return estado
    falhar('diagramacao_definida', 'A opção de diagramação já foi registrada para esta seleção.')
  }
  const novo = structuredClone(estado) as EstadoLocal & { producao?: EstadoProducaoLocal }
  novo.producao ??= { projetos: [] }
  const agora = new Date().toISOString()
  const registrar = (texto: string) => novo.atividades.unshift({ id: id(), galeriaId: galeria.id, texto, criadaEm: agora })
  let projeto = novo.producao.projetos.find(p => p.galeriaId === galeria.id)
  if (comando.tipo === 'escolher_diagramacao') {
    if (!['propria','seualbum'].includes(comando.opcao)) falhar('opcao_invalida', 'Escolha uma opção de diagramação válida.')
    const selecao = galeria.selecoes.find(s => s.id === comando.selecaoId)
    if (!selecao) falhar('selecao_necessaria', 'Entregue a seleção de fotos antes de iniciar a diagramação.')
    projeto = { galeriaId: galeria.id, proprietarioId: estado.proprietarioId, selecaoId: selecao!.id, opcao: comando.opcao, revisao: 1, versoes: [], servico: null, pedidoId: null }
    if (comando.opcao === 'seualbum') {
      const produto = novo.catalogo.find(p => p.id === 'servico-diagramacao' && p.tipo === 'servico' && p.ativo && p.proprietarioId === estado.proprietarioId)
      if (!produto) falhar('servico_indisponivel', 'O serviço de diagramação está indisponível no catálogo local.')
      projeto.servico = { produtoId: produto!.id, nome: produto!.nome, precoCentavos: produto!.precoCentavos }
      projeto.pedidoId = id()
      novo.pedidos.unshift({ id: projeto.pedidoId, proprietarioId: estado.proprietarioId, galeriaId: galeria.id, produtoId: produto!.id, produtoNome: produto!.nome, fotoIds: [...selecao!.fotoIds], totalCentavos: produto!.precoCentavos, financeiro: calcularFinanceiroLocal(galeria.tipo, 'servico', produto!.precoCentavos, lerConfigComercial(novo)), criadoEm: agora, status: 'solicitado', simulacao: true })
    }
    novo.producao.projetos.push(projeto)
    registrar(comando.opcao === 'propria' ? 'Diagramação própria escolhida para a seleção entregue.' : 'Serviço de diagramação solicitado localmente, sem cobrança.')
    return novo
  }
  if (!projeto) falhar('diagramacao_necessaria', 'Escolha a diagramação após entregar a seleção de fotos.')
  const p = projeto!
  const ultima = p.versoes.at(-1)
  if (comando.tipo === 'criar_versao') {
    if (ultima && ultima.status !== 'ajustes') falhar('versao_aberta', 'Publique ou conclua a revisão atual antes de iniciar outra versão.')
    const selecao = galeria.selecoes.find(s => s.id === p.selecaoId)
    if (!selecao) falhar('selecao_invalida', 'A seleção de origem não está disponível.')
    p.versoes.push({ id: id(), numero: p.versoes.length + 1, selecaoId: p.selecaoId, fotoIds: [...selecao!.fotoIds], status: 'rascunho', criadaEm: agora, publicadaEm: null, chavePublicacao: null, decididaEm: null, chaveDecisao: null, mensagemDecisao: null, laminas: [], comentarios: [] })
    registrar(`Rascunho da prova versão ${p.versoes.length} iniciado no modo fotógrafo.`)
  } else {
    const v = p.versoes.find(v => v.id === comando.versaoId)
    if (!v || v.id !== ultima?.id) falhar('versao_antiga', 'Somente a versão mais recente pode receber ações.')
    const versao = v!
    if (['adicionar_laminas','remover_lamina','publicar'].includes(comando.tipo) && versao.status !== 'rascunho') falhar('versao_imutavel', 'As lâminas de uma versão publicada não podem ser alteradas.')
    if (['comentar','solicitar_ajustes','aprovar'].includes(comando.tipo) && versao.status !== 'publicada') falhar('prova_fechada', 'A versão atual não está aberta para revisão.')
    switch (comando.tipo) {
      case 'adicionar_laminas': {
        if (!Array.isArray(comando.laminas) || !comando.laminas.length || versao.laminas.length + comando.laminas.length > 100 || !comando.laminas.every(laminaValida)) falhar('lamina_invalida', 'Importe até 100 lâminas válidas de até 25 MB cada.')
        const ids = new Set(novo.galerias.flatMap(g => g.fotos.map(f => f.id)).concat(novo.producao.projetos.flatMap(p => p.versoes.flatMap(v => v.laminas.map(l => l.id)))))
        for (const l of comando.laminas) { if (ids.has(l.id)) falhar('lamina_duplicada', 'A identidade desta lâmina já foi utilizada.'); ids.add(l.id) }
        versao.laminas.push(...structuredClone(comando.laminas))
        registrar(`${comando.laminas.length} lâmina(s) importada(s) no rascunho da versão ${versao.numero}.`)
        break
      }
      case 'remover_lamina':
        if (!versao.laminas.some(l => l.id === comando.laminaId)) falhar('lamina_invalida', 'A lâmina não pertence a esta versão.')
        versao.laminas = versao.laminas.filter(l => l.id !== comando.laminaId)
        registrar(`Lâmina removida do rascunho da versão ${versao.numero}.`)
        break
      case 'publicar':
        if (!versao.laminas.length) falhar('versao_vazia', 'Importe ao menos uma lâmina antes de publicar a prova.')
        versao.status = 'publicada'; versao.publicadaEm = agora; versao.chavePublicacao = comando.chave
        registrar(`Prova versão ${versao.numero} publicada para revisão do cliente local.`)
        break
      case 'comentar':
        if (!versao.laminas.some(l => l.id === comando.laminaId) || !textoValido(comando.texto, 2000) || !posicaoValida(comando.x, comando.y)) falhar('comentario_invalido', 'Escolha uma lâmina e escreva um comentário de até 2000 caracteres com posição válida.')
        versao.comentarios.push({ id: id(), chave: comando.chave, laminaId: comando.laminaId, texto: comando.texto.trim(), ator: comando.ator, x: comando.x ?? null, y: comando.y ?? null, criadoEm: agora })
        registrar(`Comentário do modo ${comando.ator} na prova versão ${versao.numero}.`)
        break
      case 'solicitar_ajustes':
        if (!textoValido(comando.texto, 2000)) falhar('ajustes_invalidos', 'Descreva os ajustes em até 2000 caracteres.')
        versao.status = 'ajustes'; versao.mensagemDecisao = comando.texto.trim(); versao.decididaEm = agora; versao.chaveDecisao = comando.chave
        registrar(`Cliente local solicitou ajustes na prova versão ${versao.numero}.`)
        break
      case 'aprovar':
        versao.status = 'aprovada'; versao.decididaEm = agora; versao.chaveDecisao = comando.chave
        registrar(`Cliente local aprovou a prova versão ${versao.numero}; seleção e favoritos permanecem independentes.`)
        break
    }
  }
  p.revisao++
  return novo
}

/** Contrato persistido opcional: estados anteriores continuam válidos sem produção. */
export function validarProducao(valor: unknown, estado: EstadoLocal): valor is EstadoProducaoLocal {
  if (!registro(valor) || !Array.isArray(valor.projetos)) return false
  const galerias = new Set<string>(), laminas = new Set(estado.galerias.flatMap(g => g.fotos.map(f => f.id))), versoes = new Set<string>(), chaves = new Set<string>()
  for (const bruto of valor.projetos) {
    if (!registro(bruto) || typeof bruto.galeriaId !== 'string' || bruto.proprietarioId !== estado.proprietarioId || galerias.has(bruto.galeriaId) || !['propria','seualbum'].includes(bruto.opcao as string) || !inteiro(bruto.revisao, 1) || !Array.isArray(bruto.versoes)) return false
    galerias.add(bruto.galeriaId)
    const g = estado.galerias.find(g => g.id === bruto.galeriaId && g.proprietarioId === estado.proprietarioId)
    const selecao = g?.selecoes.find(s => s.id === bruto.selecaoId)
    if (!g || !selecao) return false
    if (bruto.opcao === 'propria' && (bruto.pedidoId !== null || bruto.servico !== null)) return false
    if (bruto.opcao === 'seualbum') {
      if (!registro(bruto.servico) || !textoValido(bruto.servico.produtoId) || !textoValido(bruto.servico.nome) || !(bruto.servico.precoCentavos === null || inteiro(bruto.servico.precoCentavos))) return false
      const servico = bruto.servico
      if (!estado.pedidos.some(p => p.id === bruto.pedidoId && p.proprietarioId === estado.proprietarioId && p.galeriaId === g.id && p.produtoId === servico.produtoId && p.produtoNome === servico.nome && p.totalCentavos === servico.precoCentavos && iguais(p.fotoIds, selecao.fotoIds))) return false
    }
    const lista = bruto.versoes
    for (let i = 0; i < lista.length; i++) {
      const v = lista[i]
      if (!registro(v) || !textoValido(v.id) || versoes.has(v.id) || v.numero !== i + 1 || v.selecaoId !== selecao.id || !iguais(v.fotoIds, selecao.fotoIds) || !['rascunho','publicada','ajustes','aprovada'].includes(v.status as string) || !dataValida(v.criadaEm) || !Array.isArray(v.laminas) || v.laminas.length > 100 || !v.laminas.every(laminaValida) || !Array.isArray(v.comentarios)) return false
      versoes.add(v.id)
      if (i < lista.length - 1 && v.status !== 'ajustes') return false
      for (const l of v.laminas) { if (laminas.has(l.id)) return false; laminas.add(l.id) }
      if (v.status === 'rascunho') { if (v.publicadaEm !== null || v.chavePublicacao !== null || v.decididaEm !== null || v.chaveDecisao !== null || v.mensagemDecisao !== null || v.comentarios.length !== 0) return false }
      else {
        if (!dataValida(v.publicadaEm) || !textoValido(v.chavePublicacao) || chaves.has(v.chavePublicacao) || !v.laminas.length) return false
        chaves.add(v.chavePublicacao)
        if (v.status === 'publicada') { if (v.decididaEm !== null || v.chaveDecisao !== null || v.mensagemDecisao !== null) return false }
        else {
          if (!dataValida(v.decididaEm) || !textoValido(v.chaveDecisao) || chaves.has(v.chaveDecisao) || v.status === 'ajustes' && !textoValido(v.mensagemDecisao, 2000) || v.status === 'aprovada' && v.mensagemDecisao !== null) return false
          chaves.add(v.chaveDecisao)
        }
      }
      const comentarios: { id: string }[] = []
      for (const c of v.comentarios) {
        if (!registro(c) || !textoValido(c.id) || !textoValido(c.chave) || chaves.has(c.chave) || !textoValido(c.texto, 2000) || !['fotografo','cliente'].includes(c.ator as string) || !dataValida(c.criadoEm) || !v.laminas.some(l => l.id === c.laminaId) || !posicaoValida(c.x, c.y)) return false
        chaves.add(c.chave); comentarios.push({ id: c.id })
      }
      if (!unico(comentarios)) return false
    }
  }
  return true
}
