'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudOff,
  Ellipsis,
  Loader2,
  Lock,
  MessageSquare,
  WandSparkles,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react'
import { MiniaturaLamina } from '@/components/album-editor/miniatura-lamina'
import type { FotoNoCanvas } from '@/components/album-editor/tipos'
import type { Geometria, LaminaDoc } from '@/lib/album/documento'
import type { Variante } from '@/lib/album/modelos'
import { cn } from '@/lib/utils'

/**
 * Peças da barra e do entorno da lâmina no editor enxuto (modelo SmartAlbums):
 * pílula de status, menu "⋯", seletor de layout, lâminas vizinhas, dados do
 * álbum e o diálogo do "Montar automático".
 */

type EstadoSalvo = 'salvo' | 'pendente' | 'salvando' | 'erro' | 'conflito' | 'travado'

/**
 * Tudo o que antes eram faixas de aviso no topo, numa pílula só:
 * "Salvo na nuvem · 12 lâminas · 86/240 fotos". Sem conexão fica âmbar.
 * Comentários e alertas viram contadores clicáveis.
 */
export function PilulaStatus({
  online,
  sincronizado,
  estado,
  mensagem,
  laminas,
  fotosUsadas,
  fotosTotal,
  comentarios,
  erros,
  avisos,
  motivoTravado,
  statusAlbum,
  onComentarios,
  onVerificacao,
  onTravado,
}: {
  online: boolean
  sincronizado: boolean
  estado: EstadoSalvo
  mensagem: string | null
  laminas: number
  fotosUsadas: number
  fotosTotal: number
  comentarios: number
  erros: number
  avisos: number
  motivoTravado: string | null
  /** Status do álbum avulso (em edição, aprovado…), mostrado no título. */
  statusAlbum: string | null
  onComentarios: () => void
  onVerificacao: () => void
  /** Álbum avulso travado: abre aprovação/produção para reabrir ou finalizar. */
  onTravado?: () => void
}) {
  const salvo: { texto: string; icone: LucideIcon; cor: string; gira?: boolean } = !online
    ? { texto: 'Salvando localmente (offline)', icone: WifiOff, cor: 'bg-amber-400/15 text-amber-300' }
    : estado === 'travado'
      ? { texto: 'Somente leitura', icone: Lock, cor: 'text-emerald-300' }
      : estado === 'conflito'
        ? { texto: 'Versão desatualizada', icone: AlertTriangle, cor: 'bg-amber-400/15 text-amber-300' }
        : estado === 'erro'
          ? { texto: mensagem ?? 'Erro ao salvar', icone: CloudOff, cor: 'bg-red-500/15 text-red-300' }
          : sincronizado
            ? { texto: 'Conexão restaurada · sincronizado', icone: Wifi, cor: 'text-emerald-300' }
            : estado === 'salvando'
              ? { texto: 'Salvando…', icone: Loader2, cor: 'text-white/70', gira: true }
              : estado === 'pendente'
                ? { texto: 'Alterações não salvas', icone: Cloud, cor: 'text-white/70' }
                : { texto: 'Salvo na nuvem', icone: Check, cor: 'text-white/70' }
  const titulo = [motivoTravado, statusAlbum ? `Status: ${statusAlbum}` : null].filter(Boolean).join(' · ') || undefined

  const conteudoSalvo = (
    <>
      <salvo.icone className={cn('h-3.5 w-3.5 shrink-0', salvo.gira && 'animate-spin')} aria-hidden />
      <span className="max-w-[14rem] truncate">{salvo.texto}</span>
    </>
  )

  return (
    <div role="status" className="flex min-w-0 items-center gap-1 rounded-full bg-white/5 py-0.5 pl-1 pr-1 text-[11px]" title={titulo}>
      {onTravado && estado === 'travado' ? (
        <button type="button" onClick={onTravado} className={cn('flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-white/10', salvo.cor)}>
          {conteudoSalvo}
        </button>
      ) : (
        <span className={cn('flex items-center gap-1.5 rounded-full px-2 py-1', salvo.cor)}>{conteudoSalvo}</span>
      )}
      <span className="hidden whitespace-nowrap pr-1 tabular-nums text-white/55 md:inline">
        · {laminas} {laminas === 1 ? 'lâmina' : 'lâminas'} · {fotosUsadas}/{fotosTotal} fotos
      </span>
      {comentarios > 0 ? (
        <button type="button" onClick={onComentarios} className="flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-1 text-sky-300 hover:bg-sky-400/25" aria-label={`${comentarios} comentário(s) do cliente em aberto`}>
          <MessageSquare className="h-3 w-3" aria-hidden />
          {comentarios}
        </button>
      ) : null}
      {erros + avisos > 0 ? (
        <button
          type="button"
          onClick={onVerificacao}
          className={cn('flex items-center gap-1 rounded-full px-2 py-1', erros > 0 ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25')}
          aria-label={`${erros + avisos} alerta(s) na verificação`}
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {erros + avisos}
        </button>
      ) : null}
    </div>
  )
}

export type ItemMenu = { rotulo: string; icone: LucideIcon; onClick: () => void }

/** Menu "⋯": o que é usado de vez em quando (fundos, textos, elementos, histórico…). */
export function MenuMais({ secoes }: { secoes: ItemMenu[][] }) {
  const [aberto, setAberto] = useState(false)
  const primeiroRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (aberto) primeiroRef.current?.focus()
  }, [aberto])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Mais opções"
        title="Mais opções"
        className={cn('rounded-full p-2 hover:bg-white/10', aberto ? 'bg-white/10 text-white' : 'text-white/80')}
      >
        <Ellipsis className="h-4 w-4" aria-hidden />
      </button>
      {aberto ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} aria-hidden />
          <div
            role="menu"
            onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
            className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-white/10 bg-[#1C1C1C] py-1 shadow-2xl"
          >
            {secoes.map((itens, s) => (
              <div key={s} className={cn(s > 0 && 'mt-1 border-t border-white/10 pt-1')}>
                {itens.map((item, i) => (
                  <button
                    key={item.rotulo}
                    ref={s === 0 && i === 0 ? primeiroRef : undefined}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAberto(false)
                      item.onClick()
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs text-white/85 hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                  >
                    <item.icone className="h-4 w-4 text-white/60" aria-hidden />
                    {item.rotulo}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

/** Desenho mínimo de uma variação: os quadros sobre a lâmina, com a dobra no meio. */
function PreviaVariante({ v, g }: { v: Variante; g: Geometria }) {
  return (
    <svg viewBox={`0 0 ${g.laminaW} ${g.laminaH}`} className="h-auto w-full" aria-hidden>
      <rect width={g.laminaW} height={g.laminaH} fill="#F5F5F5" />
      {v.quadros.map((q) => (
        <rect key={q.id} x={q.x} y={q.y} width={q.w} height={q.h} fill="#9CA3AF" />
      ))}
      <line x1={g.paginaW} y1={0} x2={g.paginaW} y2={g.laminaH} stroke="#D4D4D4" strokeWidth={g.laminaW / 300} />
    </svg>
  )
}

/**
 * "Trocar layout ▾" embaixo da lâmina: as variações para as fotos que estão
 * nela. ▲/▼ (e as setas do teclado) trocam na hora, sem abrir nada.
 */
export function SeletorLayout({
  variantes,
  atual,
  geometria: g,
  desabilitado,
  onAplicar,
  onCiclar,
  onMais,
}: {
  variantes: Variante[]
  atual: number | null
  geometria: Geometria
  desabilitado: boolean
  onAplicar: (idx: number) => void
  onCiclar: (delta: number) => void
  onMais: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const vazio = variantes.length === 0
  const podeCiclar = !desabilitado && variantes.length > 1

  return (
    <div className="relative flex items-center rounded-full bg-white/5">
      <button type="button" onClick={() => onCiclar(-1)} disabled={!podeCiclar} className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-30" aria-label="Layout anterior (↑)" title="Layout anterior (↑)">
        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={desabilitado || vazio}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium hover:bg-white/10 disabled:opacity-40"
        title={vazio ? 'Arraste fotos da bandeja para a lâmina' : 'Ver as variações de layout'}
      >
        {vazio ? 'Sem fotos na lâmina' : 'Trocar layout'}
        {!vazio ? (
          <span className="tabular-nums text-white/50">
            {atual !== null ? `${atual + 1}/${variantes.length}` : variantes.length}
          </span>
        ) : null}
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>
      <button type="button" onClick={() => onCiclar(1)} disabled={!podeCiclar} className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-30" aria-label="Próximo layout (↓)" title="Próximo layout (↓)">
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>

      {aberto ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Variações de layout"
            onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-[22rem] -translate-x-1/2 rounded-xl border border-white/10 bg-[#1C1C1C] p-3 shadow-2xl"
          >
            <p className="mb-2 text-[11px] text-white/50">
              {variantes[0]?.quadros.length ?? 0} fotos · ↑/↓ alterna sem abrir esta janela
            </p>
            <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
              {variantes.map((v, i) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAplicar(i)
                      setAberto(false)
                    }}
                    aria-label={`Layout ${i + 1}`}
                    aria-pressed={atual === i}
                    className={cn('block w-full overflow-hidden rounded-md ring-2 hover:ring-white/60', atual === i ? 'ring-white' : 'ring-transparent')}
                  >
                    <PreviaVariante v={v} g={g} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                onMais()
              }}
              className="mt-2 w-full rounded-md bg-white/5 py-1.5 text-[11px] text-white/80 hover:bg-white/10"
            >
              Mais layouts e templates…
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

/** Lâmina anterior/próxima espiando nas laterais (clique para ir até ela). */
export function LaminaVizinha({
  lamina,
  geometria,
  fotos,
  lado,
  onIr,
}: {
  lamina: LaminaDoc | undefined
  geometria: Geometria
  fotos: Map<string, FotoNoCanvas>
  lado: 'anterior' | 'proxima'
  onIr: () => void
}) {
  if (!lamina) return <div className="hidden w-32 shrink-0 xl:block" aria-hidden />
  return (
    <div className="hidden w-32 shrink-0 items-center justify-center xl:flex">
      <button
        type="button"
        onClick={onIr}
        aria-label={lado === 'anterior' ? 'Ir para a lâmina anterior' : 'Ir para a próxima lâmina'}
        className="rounded bg-white opacity-40 shadow-lg transition-opacity hover:opacity-90 focus-visible:opacity-90"
      >
        <MiniaturaLamina lamina={lamina} geometria={geometria} fotos={fotos} largura={112} />
      </button>
    </div>
  )
}

/** Painel direito sem nada selecionado: o essencial do álbum. */
export function InfoAlbum({
  formato,
  orientacao,
  sangria,
  margem,
  laminas,
  capa,
  fotosUsadas,
  fotosTotal,
}: {
  formato: string
  orientacao: string
  sangria: number
  margem: number
  laminas: number
  capa: boolean
  fotosUsadas: number
  fotosTotal: number
}) {
  const linhas: [string, string][] = [
    ['Formato', `${formato} · ${orientacao}`],
    ['Lâminas', `${laminas} (${laminas * 2} páginas)`],
    ['Primeira lâmina', capa ? 'Capa' : 'Miolo'],
    ['Sangria', `${sangria} mm`],
    ['Margem segura', `${margem} mm`],
    ['Fotos usadas', `${fotosUsadas} de ${fotosTotal}`],
  ]
  return (
    <dl className="space-y-1.5 border-b border-white/10 px-4 py-3 text-xs">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex justify-between gap-3">
          <dt className="text-white/50">{rotulo}</dt>
          <dd className="text-right font-medium text-white/85">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Confirmação do "Montar automático": quantas lâminas e se a primeira é capa.
 * A montagem segue a linha do tempo do evento e dá destaque às favoritas.
 */
export function DialogoMontagem({
  sugestaoLaminas,
  totalFotos,
  favoritas,
  capa: capaInicial,
  temConteudo,
  onCancelar,
  onMontar,
}: {
  sugestaoLaminas: number
  totalFotos: number
  favoritas: number
  capa: boolean
  temConteudo: boolean
  onCancelar: () => void
  onMontar: (laminas: number, capa: boolean) => void
}) {
  const [laminas, setLaminas] = useState(String(sugestaoLaminas))
  const [capa, setCapa] = useState(capaInicial)
  const n = Math.round(Number(laminas))
  const valido = Number.isFinite(n) && n >= 1 && n <= 200

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onCancelar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="montagem-titulo"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1C1C1C] p-5 text-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="montagem-titulo" className="flex items-center gap-2 text-base font-semibold">
            <WandSparkles className="h-4 w-4" aria-hidden />
            Montar automático
          </h2>
          <button type="button" onClick={onCancelar} className="rounded-full p-1 text-white/60 hover:bg-white/10" aria-label="Fechar">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-white/70">
          <li>• {totalFotos} fotos na ordem em que foram tiradas (preparação → cerimônia → festa).</li>
          <li>• Fotos do mesmo momento ficam na mesma lâmina; layouts escolhidos pela orientação das fotos.</li>
          <li>
            • {favoritas > 0 ? `${favoritas} favorita(s) ganham o maior quadro do seu momento.` : 'Marque favoritas na bandeja para que ganhem destaque.'}
          </li>
        </ul>
        <div className="mt-4 flex items-end gap-4">
          <label className="text-xs text-white/70">
            Lâminas
            <input
              type="number"
              min={1}
              max={200}
              value={laminas}
              autoFocus
              onChange={(e) => setLaminas(e.target.value)}
              className="mt-1 block w-24 rounded-md border border-white/20 bg-[#141414] px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-xs text-white/80">
            <input type="checkbox" checked={capa} onChange={(e) => setCapa(e.target.checked)} className="accent-white" />
            Primeira lâmina é a capa
          </label>
        </div>
        {temConteudo ? (
          <p className="mt-3 rounded-md bg-amber-400/10 p-2 text-xs text-amber-200">
            Substitui a diagramação atual. Dá para voltar com Ctrl+Z.
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="rounded-full px-4 py-2 text-xs text-white/80 hover:bg-white/10">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valido || totalFotos === 0}
            onClick={() => onMontar(n, capa)}
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-white/90 disabled:opacity-40"
          >
            Montar álbum
          </button>
        </div>
      </div>
    </div>
  )
}
