'use client'

import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImageUp, Star, X } from 'lucide-react'
import { definirFavoritoFoto } from '@/lib/actions/favoritos'
import { criarFilaUploadProjeto } from '@/lib/fila-upload-projeto'
import { criarUploadProjetoFoto, validarArquivoFotoProjeto } from '@/lib/upload-projeto-foto'
import { cn } from '@/lib/utils'
import type { Photo } from '@/types/platform'

type ManagedPhoto = Photo & {
  idLocal?: string
  nomeArquivo?: string
  emFila?: boolean
  uploading?: boolean
  progress?: number
  erroEnvio?: string
  salvandoFavorito?: boolean
}

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Aba "Minhas Fotos" (seção 12). Em modo de demonstração o upload é só
 * cosmético (`URL.createObjectURL`, sem envio real). Fora dele, cada arquivo
 * sobe de verdade para o Cloudflare R2 e vira uma linha em `fotos`
 * (`bucket = 'r2'`) — ver `uploadProjetoFoto`.
 */
export function ClientPhotosManager({ projetoId, initialPhotos }: { projetoId: string; initialPhotos: Photo[] }) {
  const [photos, setPhotos] = useState<ManagedPhoto[]>(initialPhotos)
  const [errosArquivos, setErrosArquivos] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  const [somenteFavoritas, setSomenteFavoritas] = useState(false)
  const [erroFavorito, setErroFavorito] = useState<string | null>(null)
  const favoritosEmCursoRef = useRef(new Set<string>())
  const dialogRef = useRef<HTMLDialogElement>(null)
  const filtroRef = useRef<HTMLButtonElement>(null)
  const focoAnteriorRef = useRef<HTMLElement | null>(null)
  const lightboxAberto = lightboxId !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (lightboxAberto && !dialog.open) {
      focoAnteriorRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    }
    if (!lightboxAberto && dialog.open) {
      dialog.close()
      const anterior = focoAnteriorRef.current
      if (anterior?.isConnected) anterior.focus()
      else filtroRef.current?.focus()
    }
    if (lightboxAberto) {
      const overflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = overflow }
    }
  }, [lightboxAberto])
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<string[]>([])
  const enviosRef = useRef(new Map<string, ReturnType<typeof criarUploadProjetoFoto>>())
  const filaRef = useRef<ReturnType<typeof criarFilaUploadProjeto> | null>(null)
  const montadoRef = useRef(false)

  useEffect(() => {
    montadoRef.current = true
    filaRef.current = criarFilaUploadProjeto(3)
    const envios = enviosRef.current
    const objectUrls = objectUrlsRef.current
    const fila = filaRef.current
    return () => {
      montadoRef.current = false
      fila.encerrar()
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.length = 0
      envios.clear()
    }
  }, [])

  const enviarFoto = useCallback(async (idLocal: string) => {
    const envio = enviosRef.current.get(idLocal)
    if (!envio || !montadoRef.current) return
    setPhotos((prev) => prev.map((p) => p.idLocal === idLocal ? { ...p, uploading: true, emFila: false, erroEnvio: undefined } : p))
    try {
      if (DEMO_MODE) {
        // Simulação identificada: não é progresso de bytes transferidos.
        await new Promise((resolve) => setTimeout(resolve, 800))
        if (!montadoRef.current) return
        setPhotos((prev) => prev.map((p) => p.idLocal === idLocal ? { ...p, uploading: false, progress: 100 } : p))
      } else {
        const { id, url, meta } = await envio.executar()
        if (!montadoRef.current) return
        setPhotos((prev) => prev.map((p) => p.idLocal === idLocal
          ? { ...p, id, url, capturadaEm: meta.capturadaEm, camera: meta.camera, uploading: false, progress: 100, erroEnvio: undefined }
          : p))
      }
      enviosRef.current.delete(idLocal)
    } catch (e) {
      if (!montadoRef.current) return
      setPhotos((prev) => prev.map((p) => p.idLocal === idLocal
        ? { ...p, uploading: false, erroEnvio: e instanceof Error ? e.message : 'Não foi possível enviar a foto. Tente novamente.' }
        : p))
    }
  }, [])

  const agendarFoto = useCallback((idLocal: string) => {
    if (!enviosRef.current.has(idLocal)) return
    if (filaRef.current?.adicionar(idLocal, () => enviarFoto(idLocal))) {
      setPhotos((prev) => prev.map((p) => p.idLocal === idLocal
        ? { ...p, uploading: true, emFila: true, erroEnvio: undefined } : p))
    }
  }, [enviarFoto])

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return
    const erros: string[] = []
    const novas: ManagedPhoto[] = []
    for (const file of Array.from(fileList)) {
      const erro = validarArquivoFotoProjeto(file)
      if (erro) { erros.push(`${file.name}: ${erro}`); continue }
      const url = URL.createObjectURL(file)
      const idLocal = `novo-${crypto.randomUUID()}`
      objectUrlsRef.current.push(url)
      enviosRef.current.set(idLocal, criarUploadProjetoFoto(projetoId, file, 'Novas fotos'))
      novas.push({
        id: idLocal, idLocal, nomeArquivo: file.name, url,
        grupo: 'Novas fotos', favorita: false, obrigatoria: false, destaque: false,
        capa: false, observacao: null, uploading: true, emFila: true, progress: 0,
      })
    }
    setErrosArquivos(erros)
    if (!novas.length) return
    setPhotos((prev) => [...prev, ...novas])
    novas.forEach((foto) => agendarFoto(foto.idLocal!))
  }, [projetoId, agendarFoto])

  async function toggleFavorite(photo: ManagedPhoto) {
    if (photo.uploading || photo.erroEnvio || favoritosEmCursoRef.current.has(photo.id)) return
    const favorita = !photo.favorita
    favoritosEmCursoRef.current.add(photo.id)
    setErroFavorito(null)
    setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, favorita, salvandoFavorito: true } : p))
    // A foto deixa a lista filtrada assim que é desmarcada.
    if (somenteFavoritas && !favorita && lightboxId === (photo.idLocal ?? photo.id)) setLightboxId(null)
    try {
      if (!DEMO_MODE) {
        const resultado = await definirFavoritoFoto(projetoId, photo.id, favorita)
        if (!resultado.ok) throw new Error(resultado.erro)
      }
    } catch (error) {
      setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, favorita: photo.favorita } : p))
      setErroFavorito(error instanceof Error ? error.message : 'Não foi possível salvar o favorito. Tente novamente.')
    } finally {
      favoritosEmCursoRef.current.delete(photo.id)
      setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, salvandoFavorito: false } : p))
    }
  }

  const favoritas = photos.filter((photo) => photo.favorita).length
  const fotosVisiveis = somenteFavoritas ? photos.filter((photo) => photo.favorita) : photos
  const lightboxIndex = fotosVisiveis.findIndex((photo) => (photo.idLocal ?? photo.id) === lightboxId)
  const lightboxPhoto = lightboxIndex >= 0 ? fotosVisiveis[lightboxIndex] : null
  function navegarFoto(delta: number) {
    const photo = fotosVisiveis[lightboxIndex + delta]
    if (photo) setLightboxId(photo.idLocal ?? photo.id)
  }
  // Barra fixa do envio em segundo plano: a pessoa segue navegando na aba.
  const novas = photos.filter((p) => p.idLocal)
  const esperando = novas.filter((p) => p.uploading && p.emFila).length
  const enviando = novas.filter((p) => p.uploading && !p.emFila).length
  const falhas = novas.filter((p) => p.erroEnvio).length
  const concluidas = novas.filter((p) => !p.uploading && !p.erroEnvio).length

  return (
    <div className="space-y-5">
      {DEMO_MODE ? <p className="rounded-xl bg-secondary p-3 text-sm">Demonstração: uploads e favoritos ficam apenas nesta tela.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted-foreground">{favoritas} de {photos.length} fotos favoritas</p>
        <button ref={filtroRef} type="button" aria-pressed={somenteFavoritas} onClick={() => setSomenteFavoritas((value) => !value)} className="min-h-11 rounded-full border px-4 text-sm">
          {somenteFavoritas ? 'Mostrar todas as fotos' : 'Mostrar favoritas'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Os favoritos são compartilhados com as pessoas que têm acesso ao projeto. Marcar favoritas salva um rascunho. O cliente confirma a entrega pelo link da galeria.</p>
      {errosArquivos.length ? <div role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{errosArquivos.map((erro, i) => <p key={i}>{erro}</p>)}</div> : null}
      {novas.length ? <div role="status" className="space-y-1 text-sm text-muted-foreground"><p>{concluidas} de {novas.length} envios concluídos · {esperando} na fila · {enviando} em envio · {falhas} com falha</p><progress aria-label="Progresso geral dos envios" max={novas.length} value={concluidas} className="w-full" /></div> : null}
      {erroFavorito ? <p role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{erroFavorito}</p> : null}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          addFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex min-h-[44px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
          dragActive ? 'border-[#171717] bg-[#F5F5F5]' : 'border-[#DDDDDD] hover:border-[#AAAAAA]',
        )}
      >
        <ImageUp className="h-8 w-8 text-[#6B6B6B]" aria-hidden />
        <div>
          <p className="font-medium text-[#171717]">Adicionar fotos</p>
          <p className="text-xs text-[#6B6B6B]">Toque para escolher ou arraste os arquivos aqui</p>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>

      {fotosVisiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-[#6B6B6B]">
          {somenteFavoritas ? 'Nenhuma foto favorita. Marque a estrela nas fotos para encontrá-las aqui.' : 'Nenhuma foto enviada ainda.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotosVisiveis.map((photo) => (
            <div key={photo.idLocal ?? photo.id} className="min-w-0">
            <div className="group relative aspect-square overflow-hidden rounded-xl bg-secondary">
              <button type="button" onClick={() => setLightboxId(photo.idLocal ?? photo.id)} aria-label={`Ampliar foto ${photo.nomeArquivo ?? photo.grupo}`} className="h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:) e fotos mockadas, next/image não serve blob e cache local corrompe no volume externo. */}
              <img src={photo.url} alt={photo.grupo} className={cn('h-full w-full object-cover', photo.uploading && 'opacity-60')} />
              </button>
              {photo.uploading ? (
                <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-xs text-white">{photo.emFila ? 'Na fila' : 'Enviando…'}</span>
              ) : null}
              {photo.capa ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">Capa</span>
              ) : null}
              <button
                type="button"
                disabled={photo.uploading || Boolean(photo.erroEnvio) || photo.salvandoFavorito}
                onClick={(e) => {
                  e.stopPropagation()
                  startTransition(async () => { await toggleFavorite(photo) })
                }}
                aria-label={photo.favorita ? 'Remover dos favoritos' : 'Marcar como favorita'}
                aria-pressed={photo.favorita}
                aria-busy={photo.salvandoFavorito || undefined}
                className="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white"
              >
                <Star className={cn('h-4 w-4', photo.favorita && 'fill-yellow-400 text-yellow-400')} aria-hidden />
              </button>
            </div>
            {photo.nomeArquivo ? <p className="mt-1 truncate text-xs text-muted-foreground" title={photo.nomeArquivo}>{photo.nomeArquivo}{!photo.uploading && !photo.erroEnvio ? ' · Concluído' : ''}</p> : null}
            {photo.erroEnvio ? (
              <div role="alert" className="mt-2 space-y-1 text-xs text-destructive">
                <p className="break-words font-medium">{photo.nomeArquivo}</p>
                <p>{photo.erroEnvio}</p>
                <button type="button" onClick={() => agendarFoto(photo.idLocal!)} className="min-h-11 underline underline-offset-2">
                  Tentar novamente
                </button>
              </div>
            ) : null}
            </div>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-label="Visualização de fotografia"
        onCancel={() => setLightboxId(null)}
        onClose={() => setLightboxId(null)}
        onClick={(event) => { if (event.target === event.currentTarget) setLightboxId(null) }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); navegarFoto(-1) }
          if (event.key === 'ArrowRight') { event.preventDefault(); navegarFoto(1) }
        }}
        className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black/80"
      >
      {lightboxPhoto ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-3">
            <button
              type="button"
              onClick={() => setLightboxId(null)}
              aria-label="Fechar"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              disabled={lightboxPhoto.uploading || Boolean(lightboxPhoto.erroEnvio) || lightboxPhoto.salvandoFavorito}
              onClick={(e) => {
                e.stopPropagation()
                startTransition(async () => { await toggleFavorite(lightboxPhoto) })
              }}
              aria-pressed={lightboxPhoto.favorita}
              aria-busy={lightboxPhoto.salvandoFavorito || undefined}
              aria-label={lightboxPhoto.favorita ? 'Remover dos favoritos' : 'Marcar como favorita'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <Star className={cn('h-5 w-5', lightboxPhoto.favorita && 'fill-yellow-400 text-yellow-400')} aria-hidden />
            </button>
          </div>
          {erroFavorito ? <p role="alert" className="px-4 py-2 text-sm text-red-300">{erroFavorito}</p> : null}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- lightbox de preview local/mock, sem otimização de imagem. */}
            <img src={lightboxPhoto.url} alt={lightboxPhoto.grupo} className="max-h-full max-w-full object-contain" />
            {lightboxIndex > 0 ? (
              <button
                type="button"
                onClick={() => navegarFoto(-1)}
                aria-label="Foto anterior"
                className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
            ) : null}
            {lightboxIndex >= 0 && lightboxIndex < fotosVisiveis.length - 1 ? (
              <button
                type="button"
                onClick={() => navegarFoto(1)}
                aria-label="Próxima foto"
                className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="p-4 text-center text-sm text-white/70">
            {lightboxIndex + 1} / {fotosVisiveis.length} · {lightboxPhoto.grupo}
          </p>
        </div>
      ) : null}
      </dialog>

      {enviando + esperando > 0 ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-[64px] z-30 mx-auto flex max-w-lg items-center gap-3 rounded-t-2xl bg-[#171717] px-4 py-3 text-sm text-white shadow-lg"
        >
          <ImageUp className="h-4 w-4 shrink-0 animate-pulse" aria-hidden />
          <span className="flex-1">
            Preparando suas memórias... {concluidas} concluídas · {enviando} em envio · {esperando} na fila
          </span>
        </div>
      ) : null}
    </div>
  )
}
