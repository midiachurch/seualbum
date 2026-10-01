'use client'

import { createClient } from '@/lib/supabase/client'
import { lerMetadadosFoto, metadadosDoStorage } from '@/lib/exif'
import { novoUuid, usePedidoWizardStore, type ArquivoFoto } from '@/store/usePedidoWizardStore'

/**
 * Fila de upload das fotos do wizard de novo pedido (passo 3) para o bucket
 * privado `pedidos_fotos` (migration 0011). Path:
 *   {userId}/{chaveIdempotencia}/{idArquivo}-{nome}
 *
 * Vive no nível do módulo, não num componente: se o fotógrafo volta ao passo 2
 * com fotos subindo, o passo 3 desmonta mas a fila continua e segue
 * atualizando a store.
 *
 * O supabase-js não expõe progresso de bytes no `upload()` (usa fetch), então
 * o progresso visível é por arquivo concluído — ver `resumoUpload`.
 */

export const BUCKET_PEDIDOS_FOTOS = 'pedidos_fotos'
export const TAMANHO_MAXIMO_FOTO = 50 * 1024 * 1024 // espelha file_size_limit do bucket
const UPLOADS_SIMULTANEOS = 3

// Inlined (não importado de '@/lib/demo-mode'): roda no navegador, e
// NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

const MIME_POR_EXTENSAO: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
}
const MIMES_ACEITOS = new Set(Object.values(MIME_POR_EXTENSAO))

/** `File` não serializa no localStorage — fica aqui enquanto a aba vive. */
const arquivosEmMemoria = new Map<string, File>()
const ativos = new Set<string>()
let contexto: { userId: string; chave: string } | null = null

/** Alguns navegadores entregam HEIC com `type` vazio; a extensão resolve. */
function mimeDoArquivo(file: File) {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_POR_EXTENSAO[ext] ?? ''
}

/** Chaves do Storage não aceitam acento e parte dos símbolos. */
function nomeSeguro(nome: string) {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(-80) || 'foto'
  )
}

/**
 * Valida e enfileira os arquivos escolhidos na galeria. Os inválidos entram
 * já como erro, para o fotógrafo ver por que ficaram de fora.
 */
export function adicionarFotos(files: FileList | File[], ctx: { userId: string; chave: string }) {
  contexto = ctx
  // Mesma foto (nome + tamanho) já na fila ou enviada: ignora, senão viraria
  // uma cópia no Storage. Se estava com erro, a nova seleção substitui.
  const jaNaLista = new Set(
    usePedidoWizardStore
      .getState()
      .fotos.arquivos.filter((a) => a.status !== 'erro')
      .map((a) => `${a.nome}:${a.tamanho}`),
  )
  const selecionados = Array.from(files)
  const ineditos = selecionados.filter((f) => !jaNaLista.has(`${f.name}:${f.size}`))

  const novos = ineditos.map((file): ArquivoFoto => {
    const id = novoUuid()
    const base = { id, nome: file.name, tamanho: file.size }
    if (!MIMES_ACEITOS.has(mimeDoArquivo(file))) {
      return { ...base, status: 'erro', erro: 'Formato não aceito. Use JPG, PNG, HEIC ou WebP.' }
    }
    if (file.size > TAMANHO_MAXIMO_FOTO) {
      return { ...base, status: 'erro', erro: 'Maior que 50 MB. Envie esta pelo link externo.' }
    }
    arquivosEmMemoria.set(id, file)
    return { ...base, status: 'fila' }
  })

  usePedidoWizardStore.getState().adicionarArquivos(novos)
  processarFila()
  return { adicionadas: novos.length, repetidas: selecionados.length - ineditos.length }
}

export function reenviarFoto(id: string, ctx: { userId: string; chave: string }) {
  contexto = ctx
  const store = usePedidoWizardStore.getState()
  if (!arquivosEmMemoria.has(id)) {
    store.atualizarArquivo(id, { status: 'erro', erro: 'Selecione esta foto de novo na galeria.' })
    return
  }
  store.atualizarArquivo(id, { status: 'fila', erro: undefined })
  processarFila()
}

export function reenviarComErro(ctx: { userId: string; chave: string }) {
  usePedidoWizardStore
    .getState()
    .fotos.arquivos.filter((a) => a.status === 'erro' && arquivosEmMemoria.has(a.id))
    .forEach((a) => reenviarFoto(a.id, ctx))
}

/** Tira da lista e, se já tinha subido, apaga do Storage (a RLS só deixa enquanto é rascunho). */
export function removerFoto(id: string) {
  const store = usePedidoWizardStore.getState()
  const arquivo = store.fotos.arquivos.find((a) => a.id === id)
  if (!arquivo || arquivo.status === 'enviando') return

  store.removerArquivo(id)
  arquivosEmMemoria.delete(id)

  if (arquivo.storagePath && !DEMO_MODE) {
    void createClient()
      .storage.from(BUCKET_PEDIDOS_FOTOS)
      .remove([arquivo.storagePath])
      .catch(() => undefined)
  }
}

/** Uma foto que existe na store mas cujo `File` morreu com a aba anterior. */
export function temArquivoEmMemoria(id: string) {
  return arquivosEmMemoria.has(id)
}

function processarFila() {
  const store = usePedidoWizardStore.getState()
  const pendentes = store.fotos.arquivos.filter((a) => a.status === 'fila' && !ativos.has(a.id))

  for (const arquivo of pendentes) {
    if (ativos.size >= UPLOADS_SIMULTANEOS) break
    void enviar(arquivo.id)
  }
  atualizarProtecoes()
}

async function enviar(id: string) {
  const store = usePedidoWizardStore.getState()
  const file = arquivosEmMemoria.get(id)
  if (!file || !contexto) {
    store.atualizarArquivo(id, { status: 'erro', erro: 'Selecione esta foto de novo na galeria.' })
    return
  }

  ativos.add(id)
  store.atualizarArquivo(id, { status: 'enviando', erro: undefined })
  const path = `${contexto.userId}/${contexto.chave}/${id}-${nomeSeguro(file.name)}`

  try {
    if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 1200))
    } else {
      // Smart Layout local: data/hora de captura e câmera viajam como metadados
      // do próprio arquivo (invisível para o fotógrafo — nunca trava o envio).
      // Na conversão em projeto, o banco copia para `fotos` (migration 0025).
      const meta = await lerMetadadosFoto(file)
      const { error } = await createClient()
        .storage.from(BUCKET_PEDIDOS_FOTOS)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: mimeDoArquivo(file),
          metadata: metadadosDoStorage(meta),
        })

      // 409 = o objeto já existe: um envio anterior desta mesma foto chegou ao
      // Storage mas a resposta se perdeu. Para nós, é sucesso.
      if (error && !jaExiste(error)) throw error
    }

    // A foto pode ter sido removida da lista enquanto subia.
    if (usePedidoWizardStore.getState().fotos.arquivos.some((a) => a.id === id)) {
      usePedidoWizardStore.getState().atualizarArquivo(id, { status: 'enviado', storagePath: path })
    }
  } catch (error) {
    console.error('[upload-pedido-foto]', error)
    usePedidoWizardStore.getState().atualizarArquivo(id, {
      status: 'erro',
      erro: navigator.onLine ? 'Falha no envio. Toque para tentar de novo.' : 'Sem internet. Toque para tentar de novo.',
    })
  } finally {
    ativos.delete(id)
    processarFila()
  }
}

function jaExiste(error: unknown) {
  const e = error as { status?: number; statusCode?: string | number; message?: string }
  return (
    e.status === 409 ||
    String(e.statusCode) === '409' ||
    /already exists|duplicate/i.test(e.message ?? '')
  )
}

// -----------------------------------------------------------------------------
// Proteções enquanto há upload: tela acesa e aviso ao fechar a aba
// -----------------------------------------------------------------------------

type WakeLockSentinelLike = { release: () => Promise<void> }
let wakeLock: WakeLockSentinelLike | null = null
let protegendo = false

function avisarAoSair(event: BeforeUnloadEvent) {
  event.preventDefault()
}

async function pedirWakeLock() {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (tipo: 'screen') => Promise<WakeLockSentinelLike> }
    }
    wakeLock = (await nav.wakeLock?.request('screen')) ?? null
  } catch {
    wakeLock = null // sem suporte, bateria baixa ou aba em segundo plano
  }
}

// O navegador solta o wake lock quando a aba some; pede de novo ao voltar.
function aoVoltarParaAba() {
  if (document.visibilityState === 'visible' && protegendo) void pedirWakeLock()
}

function atualizarProtecoes() {
  const emAndamento =
    ativos.size > 0 || usePedidoWizardStore.getState().fotos.arquivos.some((a) => a.status === 'fila')

  if (emAndamento && !protegendo) {
    protegendo = true
    window.addEventListener('beforeunload', avisarAoSair)
    document.addEventListener('visibilitychange', aoVoltarParaAba)
    void pedirWakeLock()
  } else if (!emAndamento && protegendo) {
    protegendo = false
    window.removeEventListener('beforeunload', avisarAoSair)
    document.removeEventListener('visibilitychange', aoVoltarParaAba)
    void wakeLock?.release().catch(() => undefined)
    wakeLock = null
  }
}

// -----------------------------------------------------------------------------
// Resumo para a UI
// -----------------------------------------------------------------------------

export function resumoUpload(arquivos: ArquivoFoto[]) {
  const validos = arquivos.filter((a) => a.status !== 'erro')
  const enviados = arquivos.filter((a) => a.status === 'enviado')
  const bytesTotal = validos.reduce((s, a) => s + a.tamanho, 0)
  const bytesEnviados = enviados.reduce((s, a) => s + a.tamanho, 0)

  return {
    total: arquivos.length,
    enviados: enviados.length,
    comErro: arquivos.filter((a) => a.status === 'erro').length,
    emAndamento: arquivos.some((a) => a.status === 'fila' || a.status === 'enviando'),
    bytesTotal,
    bytesEnviados,
    /** 0–100, por bytes de arquivos concluídos. */
    percentual: bytesTotal > 0 ? Math.round((bytesEnviados / bytesTotal) * 100) : 0,
  }
}
