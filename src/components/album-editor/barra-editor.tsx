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
    ? { texto: 'Salvando localmente (offline)', icone: WifiOff, cor: 'bg-amber-50 text-amber-800' }
    : estado === 'travado'
      ? { texto: 'Somente leitura', icone: Lock, cor: 'text-emerald-700' }
      : estado === 'conflito'
        ? { texto: 'Versão desatualizada', icone: AlertTriangle, cor: 'bg-amber-50 text-amber-800' }
        : estado === 'erro'
          ? { texto: mensagem ?? 'Erro ao salvar', icone: CloudOff, cor: 'bg-red-50 text-red-700' }
          : sincronizado
            ? { texto: 'Conexão restaurada · sincronizado', icone: Wifi, cor: 'text-emerald-700' }
            : estado === 'salvando'
              ? { texto: 'Salvando…', icone: Loader2, cor: 'text-[#6B6B6B]', gira: true }
              : estado === 'pendente'
                ? { texto: 'Alterações não salvas', icone: Cloud, cor: 'text-[#6B6B6B]' }
                : { texto: 'Salvo na nuvem', icone: Check, cor: 'text-[#6B6B6B]' }
  const titulo = [motivoTravado, statusAlbum ? `Status: ${statusAlbum}` : null].filter(Boolean).join(' · ') || undefined

  const conteudoSalvo = (
    <>
      <salvo.icone className={cn('h-3.5 w-3.5 shrink-0', salvo.gira && 'animate-spin')} aria-hidden />
      <span className="max-w-[14rem] truncate">{salvo.texto}</span>
    </>
  )

  return (
    <div role="status" className="flex min-w-0 items-center gap-1 rounded-full bg-[#F5F5F5] py-0.5 pl-1 pr-1 text-[11px] text-[#6B6B6B]" title={titulo}>
      {onTravado && estado === 'travado' ? (
        <button type="button" onClick={onTravado} className={cn('flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-white', salvo.cor)}>
          {conteudoSalvo}
        </button>
      ) : (
        <span className={cn('flex items-center gap-1.5 rounded-full px-2 py-1', salvo.cor)}>{conteudoSalvo}</span>
      )}
      <span className="hidden whitespace-nowrap pr-1 tabular-nums text-[#6B6B6B] md:inline">
        · {laminas} {laminas === 1 ? 'lâmina' : 'lâminas'} · {fotosUsadas}/{fotosTotal} fotos
      </span>
      {comentarios > 0 ? (
        <button type="button" onClick={onComentarios} className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-sky-700 hover:bg-sky-100" aria-label={`${comentarios} comentário(s) do cliente em aberto`}>
          <MessageSquare className="h-3 w-3" aria-hidden />
          {comentarios}
        </button>
      ) : null}
      {erros + avisos > 0 ? (
        <button
          type="button"
          onClick={onVerificacao}
          className={cn('flex items-center gap-1 rounded-full px-2 py-1', erros > 0 ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-amber-50 text-amber-800 hover:bg-amber-100')}
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
        className={cn('rounded-full p-2 hover:bg-[#F5F5F5]', aberto ? 'bg-[#F5F5F5] text-[#171717]' : 'text-[#6B6B6B]')}
      >
        <Ellipsis className="h-4 w-4" aria-hidden />
      </button>
      {aberto ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} aria-hidden />
          <div
            role="menu"
            onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
            className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-[#EAEAEA] bg-white py-1 shadow-2xl"
          >
            {secoes.map((itens, s) => (
              <div key={s} className={cn(s > 0 && 'mt-1 border-t border-[#EAEAEA] pt-1')}>
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
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs text-[#171717] hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] focus:outline-none"
                  >
                    <item.icone className="h-4 w-4 text-[#6B6B6B]" aria-hidden />
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

/**
 * Indicador de layout embaixo da lâmina (modelo SmartAlbums): solte as fotos
 * na lâmina e use ▲/▼ (ou as setas do teclado) para alternar as variações.
 */
export function SeletorLayout({
  variantes,
  atual,
  desabilitado,
  onCiclar,
}: {
  variantes: Variante[]
  atual: number | null
  geometria: Geometria
  desabilitado: boolean
  onAplicar: (idx: number) => void
  onCiclar: (delta: number) => void
  onMais: () => void
}) {
  // Fluxo SmartAlbums: solte as fotos na lâmina e use ↑/↓ para alternar os layouts.
  const vazio = variantes.length === 0
  const podeCiclar = !desabilitado && variantes.length > 1
  const rotulo = vazio
    ? 'Arraste fotos para a lâmina'
    : `Layout ${atual !== null ? atual + 1 : '–'} de ${variantes.length} · ↑/↓`

  return (
    <div className="flex items-center rounded-full border border-[#EAEAEA] bg-white text-[#171717]">
      <button type="button" onClick={() => onCiclar(-1)} disabled={!podeCiclar} className="rounded-full p-1.5 hover:bg-[#F5F5F5] disabled:opacity-30" aria-label="Layout anterior (↑)" title="Layout anterior (↑)">
        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        aria-live="polite"
        className={cn('px-2.5 py-1 text-[11px] font-medium tabular-nums', vazio || desabilitado ? 'text-[#9A9A9A]' : 'text-[#171717]')}
      >
        {rotulo}
      </span>
      <button type="button" onClick={() => onCiclar(1)} disabled={!podeCiclar} className="rounded-full p-1.5 hover:bg-[#F5F5F5] disabled:opacity-30" aria-label="Próximo layout (↓)" title="Próximo layout (↓)">
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
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
        className="rounded bg-white opacity-50 shadow-md shadow-black/10 transition-opacity hover:opacity-90 focus-visible:opacity-90"
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
    <dl className="space-y-1.5 border-b border-[#EAEAEA] px-4 py-3 text-xs">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex justify-between gap-3">
          <dt className="text-[#6B6B6B]">{rotulo}</dt>
          <dd className="text-right font-medium text-[#171717]">{valor}</dd>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={onCancelar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="montagem-titulo"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
        className="w-full max-w-md rounded-2xl border border-[#EAEAEA] bg-white p-5 text-[#171717] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="montagem-titulo" className="flex items-center gap-2 text-base font-semibold">
            <WandSparkles className="h-4 w-4" aria-hidden />
            Montar automático
          </h2>
          <button type="button" onClick={onCancelar} className="rounded-full p-1 text-[#6B6B6B] hover:bg-[#F5F5F5]" aria-label="Fechar">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-[#6B6B6B]">
          <li>• {totalFotos} fotos na ordem em que foram tiradas (preparação → cerimônia → festa).</li>
          <li>• Fotos do mesmo momento ficam na mesma lâmina; layouts escolhidos pela orientação das fotos.</li>
          <li>
            • {favoritas > 0 ? `${favoritas} favorita(s) ganham o maior quadro do seu momento.` : 'Marque favoritas na bandeja para que ganhem destaque.'}
          </li>
        </ul>
        <div className="mt-4 flex items-end gap-4">
          <label className="text-xs text-[#6B6B6B]">
            Lâminas
            <input
              type="number"
              min={1}
              max={200}
              value={laminas}
              autoFocus
              onChange={(e) => setLaminas(e.target.value)}
              className="mt-1 block w-24 rounded-md border border-[#DDDDDD] bg-white px-2 py-1.5 text-sm text-[#171717]"
            />
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-xs text-[#171717]">
            <input type="checkbox" checked={capa} onChange={(e) => setCapa(e.target.checked)} className="accent-[#171717]" />
            Primeira lâmina é a capa
          </label>
        </div>
        {temConteudo ? (
          <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            Substitui a diagramação atual. Dá para voltar com Ctrl+Z.
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="rounded-full px-4 py-2 text-xs text-[#6B6B6B] hover:bg-[#F5F5F5]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valido || totalFotos === 0}
            onClick={() => onMontar(n, capa)}
            className="rounded-full bg-[#171717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#171717]/90 disabled:opacity-40"
          >
            Montar álbum
          </button>
        </div>
      </div>
    </div>
  )
}
