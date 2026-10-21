'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Check, ImageUp, Loader2, ScanFace, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PreviaAlbumAberto } from '@/components/cliente/previa-album-aberto'
import { destacarFotosNoAlbum } from '@/lib/actions/reconhecimento'
import { selfieDaCamera, selfieDoArquivo } from '@/lib/rekognition/selfie'
import { track } from '@/lib/telemetria'

type Foto = { id: string; url: string }

type Estado =
  | { fase: 'inicio' }
  | { fase: 'captura' }
  | { fase: 'buscando' }
  | { fase: 'resultado'; fotos: Foto[] }
  | { fase: 'erro'; mensagem: string }

type Destaque = { fase: 'livre' } | { fase: 'salvando' } | { fase: 'feito' } | { fase: 'erro'; mensagem: string }

const TEXTO_CONSENTIMENTO =
  'Usamos sua foto apenas agora para achar suas memórias. Ela não será salva.'

/**
 * "Encontrar minhas fotos" (migration 0042), na aba Fotos do projeto. Máquina
 * de estados estrita:
 *
 *   inicio → captura (câmera frontal; sem câmera, envio de uma selfie)
 *          → buscando → resultado (prévia do álbum + grade + CTA) | erro
 *
 * A selfie vai direto para /api/reconhecimento/buscar e não é gravada em
 * lugar nenhum; o consentimento é um checkbox visível e obrigatório (rosto é
 * dado sensível na LGPD).
 */
export function EncontrarMinhasFotos({ projetoId }: { projetoId: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'inicio' })
  const [consentiu, setConsentiu] = useState(false)
  const [camera, setCamera] = useState<'abrindo' | 'ligada' | 'indisponivel'>('abrindo')
  const [destaque, setDestaque] = useState<Destaque>({ fase: 'livre' })
  const videoRef = useRef<HTMLVideoElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  // Câmera só enquanto a tela de captura está aberta.
  useEffect(() => {
    if (estado.fase !== 'captura') return
    let stream: MediaStream | null = null
    let cancelado = false
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setCamera('indisponivel'))
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelado) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
        setCamera('ligada')
      })
      .catch(() => {
        if (!cancelado) setCamera('indisponivel')
      })
    return () => {
      cancelado = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [estado.fase])

  function abrirCaptura() {
    track('facial_search_initiated', projetoId)
    setCamera('abrindo')
    setEstado({ fase: 'captura' })
  }

  async function buscar(preparar: () => Promise<Blob>) {
    if (!consentiu) return
    let selfie: Blob
    try {
      selfie = await preparar()
    } catch (e) {
      setEstado({ fase: 'erro', mensagem: e instanceof Error ? e.message : 'Não conseguimos preparar a selfie.' })
      return
    }

    setEstado({ fase: 'buscando' })
    const form = new FormData()
    form.set('projetoId', projetoId)
    form.set('consentimento', '1')
    form.set('selfie', selfie, 'selfie.jpg')

    const resposta = await fetch('/api/reconhecimento/buscar', { method: 'POST', body: form }).catch(() => null)
    const json = (await resposta?.json().catch(() => null)) as { fotos?: Foto[]; erro?: string } | null
    if (!resposta?.ok || !json?.fotos) {
      setEstado({ fase: 'erro', mensagem: json?.erro ?? 'Sem conexão. Confira a internet e tente de novo.' })
      return
    }
    if (json.fotos.length > 0) track('facial_search_success', projetoId, { fotos: json.fotos.length })
    setDestaque({ fase: 'livre' })
    setEstado({ fase: 'resultado', fotos: json.fotos })
  }

  async function destacar(fotos: Foto[]) {
    track('checkout_from_ai_gallery', projetoId, { fotos: fotos.length })
    setDestaque({ fase: 'salvando' })
    const r = await destacarFotosNoAlbum(projetoId, fotos.map((f) => f.id))
    setDestaque(r.ok ? { fase: 'feito' } : { fase: 'erro', mensagem: r.erro })
  }

  function recomecar() {
    setCamera('abrindo')
    setEstado({ fase: 'captura' })
  }

  if (estado.fase === 'inicio') {
    return (
      <button
        type="button"
        onClick={abrirCaptura}
        className="flex w-full items-center gap-4 rounded-2xl bg-[#171717] p-5 text-left text-white shadow-sm transition-colors hover:bg-[#2E2E2E]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10">
          <ScanFace className="h-6 w-6" aria-hidden />
        </span>
        <span>
          <span className="block text-base font-semibold">Encontrar minhas fotos</span>
          <span className="block text-xs text-white/70">Tire uma selfie e veja só as fotos em que você aparece.</span>
        </span>
      </button>
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[#EAEAEA] bg-white p-4" aria-live="polite">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
          <ScanFace className="h-4 w-4" aria-hidden />
          Encontrar minhas fotos
        </h2>
        <button
          type="button"
          onClick={() => setEstado({ fase: 'inicio' })}
          aria-label="Fechar"
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F5F5F5]"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {estado.fase === 'captura' ? (
        <div className="space-y-4">
          {camera === 'indisponivel' ? (
            <p className="rounded-xl bg-[#F5F5F5] p-4 text-sm text-[#444444]">
              Não conseguimos abrir a câmera. Envie uma selfie da sua galeria — de frente, com o rosto bem iluminado.
            </p>
          ) : (
            <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl bg-[#171717]">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
              {camera === 'abrindo' ? (
                <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-white/70" aria-label="Abrindo a câmera" />
              ) : (
                <div className="pointer-events-none absolute inset-[18%] rounded-[50%] border-2 border-white/60" />
              )}
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#EAEAEA] p-3 text-sm text-[#444444]">
            <input
              type="checkbox"
              checked={consentiu}
              onChange={(e) => setConsentiu(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#171717]"
            />
            <span>
              {TEXTO_CONSENTIMENTO} Concordo em usar minha selfie para esta busca.
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            {camera === 'ligada' ? (
              <Button
                variant="brand"
                size="lg"
                className="flex-1"
                disabled={!consentiu}
                onClick={() => videoRef.current && buscar(() => selfieDaCamera(videoRef.current!))}
              >
                <Camera className="h-4 w-4" aria-hidden />
                Tirar selfie e buscar
              </Button>
            ) : null}
            <Button
              variant={camera === 'ligada' ? 'brandOutline' : 'brand'}
              size="lg"
              className="flex-1"
              disabled={!consentiu}
              onClick={() => arquivoRef.current?.click()}
            >
              <ImageUp className="h-4 w-4" aria-hidden />
              Enviar uma selfie
            </Button>
            <input
              ref={arquivoRef}
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0]
                e.target.value = ''
                if (arquivo) buscar(() => selfieDoArquivo(arquivo))
              }}
            />
          </div>
        </div>
      ) : null}

      {estado.fase === 'buscando' ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Sparkles className="h-8 w-8 animate-pulse text-[#171717]" aria-hidden />
          <p className="font-medium text-[#171717]">Procurando os melhores momentos...</p>
        </div>
      ) : null}

      {estado.fase === 'erro' ? (
        <div className="space-y-4 py-4 text-center">
          <p className="text-sm text-[#444444]">{estado.mensagem}</p>
          <Button variant="brand" onClick={recomecar}>
            Tentar de novo
          </Button>
        </div>
      ) : null}

      {estado.fase === 'resultado' && estado.fotos.length === 0 ? (
        <div className="space-y-4 py-4 text-center">
          <p className="text-sm text-[#444444]">Poxa, não encontramos essa pessoa neste evento. Quer tentar outra foto?</p>
          <Button variant="brand" onClick={recomecar}>
            Tentar outra foto
          </Button>
        </div>
      ) : null}

      {estado.fase === 'resultado' && estado.fotos.length > 0 ? (
        <div className="space-y-4">
          <p className="text-center text-sm text-[#444444]">
            Encontramos você em <strong className="text-[#171717]">{estado.fotos.length}</strong>{' '}
            {estado.fotos.length === 1 ? 'foto' : 'fotos'}. Veja como fica no seu álbum:
          </p>

          <PreviaAlbumAberto fotos={estado.fotos} />

          {destaque.fase === 'feito' ? (
            <p className="flex items-center justify-center gap-2 rounded-xl bg-[#F5F5F5] p-4 text-sm font-medium text-[#171717]">
              <Check className="h-4 w-4" aria-hidden />
              Pronto! Essas fotos estão marcadas como favoritas para o seu álbum.
            </p>
          ) : (
            <Button
              variant="brand"
              size="lg"
              className="h-auto w-full whitespace-normal py-3"
              disabled={destaque.fase === 'salvando'}
              onClick={() => destacar(estado.fotos)}
            >
              {destaque.fase === 'salvando' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              {estado.fotos.length === 1 ? 'Colocar essa foto em destaque no meu álbum' : `Colocar essas ${estado.fotos.length} fotos em destaque no meu álbum`}
            </Button>
          )}
          {destaque.fase === 'erro' ? <p className="text-center text-sm text-red-600">{destaque.mensagem}</p> : null}

          <div className="grid grid-cols-3 gap-2">
            {estado.fotos.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element -- link assinado do R2 (1h), fora do next/image. */}
                <img src={f.url} alt="Foto em que você aparece" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>

          <button type="button" onClick={recomecar} className="w-full py-2 text-sm text-[#6B6B6B] underline-offset-4 hover:underline">
            Buscar outra pessoa
          </button>
        </div>
      ) : null}
    </section>
  )
}
