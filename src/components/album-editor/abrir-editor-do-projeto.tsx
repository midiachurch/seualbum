'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { criarLayoutDoProjeto } from '@/lib/actions/album-editor'
import { laminaEmCm } from '@/lib/resolucao'
import type { AlbumOrientationValue } from '@/types/platform'
import { cn } from '@/lib/utils'

const FORMATOS = ['20x20', '25x25', '30x30', '20x30', '30x40']
const ORIENTACOES: { valor: AlbumOrientationValue; rotulo: string }[] = [
  { valor: 'quadrado', rotulo: 'Quadrado' },
  { valor: 'vertical', rotulo: 'Retrato' },
  { valor: 'horizontal', rotulo: 'Paisagem' },
]

/**
 * Primeira abertura do editor num projeto: cria o documento e recarrega.
 * Projeto sem formato do álbum: pergunta aqui mesmo (formato + orientação).
 */
export function AbrirEditorDoProjeto({ projetoId }: { projetoId: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pedirFormato, setPedirFormato] = useState(false)
  const [formato, setFormato] = useState('30x30')
  const [orientacao, setOrientacao] = useState<AlbumOrientationValue>('quadrado')
  const [enviando, setEnviando] = useState(false)

  type Resultado = Awaited<ReturnType<typeof criarLayoutDoProjeto>>
  const tratar = useCallback(
    (r: Resultado, escolha?: { formato: string; orientacao: AlbumOrientationValue }) => {
      setEnviando(false)
      if (r.ok) {
        router.refresh()
        return
      }
      if ('precisaFormato' in r && r.precisaFormato) {
        if (!escolha && r.sugestao) setFormato(r.sugestao)
        setPedirFormato(true)
        if (escolha) setErro(r.erro)
        return
      }
      setErro(r.erro)
    },
    [router],
  )

  // `criarLayoutDoProjeto` é idempotente: duas chamadas devolvem o mesmo documento.
  function abrir(escolha: { formato: string; orientacao: AlbumOrientationValue }) {
    setEnviando(true)
    setErro(null)
    void criarLayoutDoProjeto(projetoId, escolha).then((r) => tratar(r, escolha))
  }

  // Primeira tentativa ao montar; o estado só muda quando a resposta chega.
  useEffect(() => {
    void criarLayoutDoProjeto(projetoId).then((r) => tratar(r))
  }, [projetoId, tratar])

  const cm = laminaEmCm({ formato, orientacao })
  const chip = (ativo: boolean) => cn('min-h-[40px] rounded-full border px-4 text-sm', ativo ? 'border-white bg-white text-[#171717]' : 'border-white/30 hover:bg-white/10')

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#141414] p-6 text-center text-white">
      {pedirFormato ? (
        <div className="w-full max-w-md space-y-4 text-left">
          <div>
            <h1 className="text-lg font-semibold">Qual é o formato deste álbum?</h1>
            <p className="text-sm text-white/60">O projeto ainda não tem formato definido. Ele vale para o editor e para a gráfica.</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-white/50">Formato (cm)</p>
            <div className="flex flex-wrap gap-2">
              {FORMATOS.map((f) => (
                <button key={f} type="button" onClick={() => setFormato(f)} className={chip(formato === f)}>
                  {f.replace('x', ' × ')}
                </button>
              ))}
              <input
                aria-label="Outro formato"
                value={FORMATOS.includes(formato) ? '' : formato}
                onChange={(e) => setFormato(e.target.value.toLowerCase().replace('×', 'x').replace(/\s|cm/g, ''))}
                placeholder="Outro: 24x30"
                className="w-32 rounded-full border border-white/30 bg-transparent px-3 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-white/50">Orientação</p>
            <div className="flex flex-wrap gap-2">
              {ORIENTACOES.map((o) => (
                <button key={o.valor} type="button" onClick={() => setOrientacao(o.valor)} className={chip(orientacao === o.valor)}>
                  {o.rotulo}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/50">{cm ? `Lâmina aberta: ${cm.largura} × ${cm.altura} cm.` : 'Use largura x altura em cm (ex.: 24x30).'}</p>
          {erro ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {erro}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" disabled={!cm || enviando} onClick={() => abrir({ formato, orientacao })}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Abrir o editor
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
              <Link href={`/admin/projetos/${projetoId}`}>Voltar ao projeto</Link>
            </Button>
          </div>
        </div>
      ) : erro ? (
        <>
          <AlertCircle className="h-8 w-8 text-amber-400" aria-hidden />
          <p className="max-w-md text-sm">{erro}</p>
          <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
            <Link href={`/admin/projetos/${projetoId}`}>Voltar ao projeto</Link>
          </Button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparando o editor deste projeto…
        </p>
      )}
    </div>
  )
}
