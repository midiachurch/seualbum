'use client'

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  Shapes,
  Type,
  Unlock,
} from 'lucide-react'
import type { Selecao } from '@/components/album-editor/tipos'
import { rotuloDaLamina, type LaminaDoc } from '@/lib/album/documento'
import { cn } from '@/lib/utils'

export type Alinhamento = 'esquerda' | 'centro-h' | 'direita' | 'topo' | 'meio' | 'base' | 'distribuir-h' | 'distribuir-v'

type Item = { sel: Selecao; nome: string; bloqueado: boolean; oculto: boolean; icone: typeof ImageIcon }

/** Ordem visual (de cima para baixo), como o canvas desenha. */
export function camadasDaLamina(l: LaminaDoc, nomeDaFoto: (id: string | null) => string): Item[] {
  const textos = [...l.textos].reverse().map((t) => ({
    sel: { tipo: 'texto' as const, id: t.id },
    nome: `Texto: ${t.texto.trim().slice(0, 24) || '(vazio)'}`,
    bloqueado: t.bloqueado,
    oculto: t.oculto,
    icone: Type,
  }))
  const formas = (camada: 'frente' | 'tras') =>
    [...l.formas]
      .filter((f) => f.camada === camada)
      .reverse()
      .map((f) => ({
        sel: { tipo: 'forma' as const, id: f.id },
        nome: { retangulo: 'Retângulo', elipse: 'Elipse', linha: 'Linha', ornamento: 'Ornamento' }[f.forma],
        bloqueado: f.bloqueado,
        oculto: f.oculto,
        icone: Shapes,
      }))
  const quadros = [...l.quadros].reverse().map((q, i) => ({
    sel: { tipo: 'quadro' as const, id: q.id },
    nome: `Foto ${String(l.quadros.length - i).padStart(2, '0')} · ${nomeDaFoto(q.fotoId)}`,
    bloqueado: q.bloqueado,
    oculto: q.oculto,
    icone: ImageIcon,
  }))
  return [...textos, ...formas('frente'), ...quadros, ...formas('tras')]
}

/** Painel de camadas: selecionar, ocultar, bloquear, avançar/recuar. */
export function PainelCamadas({
  lamina,
  selecionados,
  nomeDaFoto,
  somenteLeitura,
  onSelecionar,
  onAlternar,
  onMover,
}: {
  lamina: LaminaDoc
  selecionados: Selecao[]
  nomeDaFoto: (id: string | null) => string
  somenteLeitura: boolean
  onSelecionar: (s: Selecao, aditivo: boolean) => void
  onAlternar: (s: Selecao, campo: 'bloqueado' | 'oculto') => void
  onMover: (s: Selecao, direcao: 'avancar' | 'recuar') => void
}) {
  const itens = camadasDaLamina(lamina, nomeDaFoto)
  const ids = new Set(selecionados.map((s) => s.id))
  return (
    <div className="space-y-2 p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Camadas</p>
      {itens.length === 0 ? <p className="text-xs text-white/50">Lâmina vazia.</p> : null}
      <ul className="space-y-1">
        {itens.map((it) => (
          <li key={it.sel.id} className={cn('flex items-center gap-1 rounded-md px-1.5 py-1', ids.has(it.sel.id) ? 'bg-white/15' : 'hover:bg-white/5')}>
            <button type="button" onClick={(e) => onSelecionar(it.sel, e.shiftKey)} className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs', it.oculto && 'opacity-40')}>
              <it.icone className="h-3.5 w-3.5 shrink-0 text-white/60" aria-hidden />
              <span className="truncate">{it.nome}</span>
            </button>
            {!somenteLeitura ? (
              <>
                <button type="button" onClick={() => onMover(it.sel, 'avancar')} className="rounded p-0.5 text-white/50 hover:text-white" aria-label="Avançar">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onMover(it.sel, 'recuar')} className="rounded p-0.5 text-white/50 hover:text-white" aria-label="Recuar">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onAlternar(it.sel, 'oculto')} className="rounded p-0.5 text-white/50 hover:text-white" aria-label={it.oculto ? 'Mostrar' : 'Ocultar'} aria-pressed={it.oculto}>
                  {it.oculto ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => onAlternar(it.sel, 'bloqueado')} className="rounded p-0.5 text-white/50 hover:text-white" aria-label={it.bloqueado ? 'Desbloquear' : 'Bloquear'} aria-pressed={it.bloqueado}>
                  {it.bloqueado ? <Lock className="h-3.5 w-3.5 text-amber-300" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </>
            ) : null}
          </li>
        ))}
        <li className="flex items-center gap-1.5 px-1.5 py-1 text-xs text-white/40">
          <span className="h-3.5 w-3.5 rounded-sm border border-white/30" style={{ background: lamina.fundo }} />
          Fundo
        </li>
      </ul>
      <p className="text-[11px] text-white/40">Bloqueados não se movem pelo canvas; ocultos não aparecem nem na impressão.</p>
    </div>
  )
}

/** Alinhar/distribuir: com 1 elemento, em relação à página dele; com vários, entre eles. */
export function BarraAlinhamento({ quantos, onAlinhar }: { quantos: number; onAlinhar: (a: Alinhamento) => void }) {
  const botoes: { a: Alinhamento; icone: typeof AlignStartVertical; rotulo: string; min?: number }[] = [
    { a: 'esquerda', icone: AlignStartVertical, rotulo: 'Alinhar à esquerda' },
    { a: 'centro-h', icone: AlignCenterVertical, rotulo: 'Alinhar ao centro' },
    { a: 'direita', icone: AlignEndVertical, rotulo: 'Alinhar à direita' },
    { a: 'topo', icone: AlignStartHorizontal, rotulo: 'Alinhar ao topo' },
    { a: 'meio', icone: AlignCenterHorizontal, rotulo: 'Alinhar ao meio' },
    { a: 'base', icone: AlignEndHorizontal, rotulo: 'Alinhar à base' },
    { a: 'distribuir-h', icone: AlignHorizontalDistributeCenter, rotulo: 'Distribuir horizontalmente', min: 3 },
    { a: 'distribuir-v', icone: AlignVerticalDistributeCenter, rotulo: 'Distribuir verticalmente', min: 3 },
  ]
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-white/10 px-3 py-2" role="toolbar" aria-label="Alinhamento">
      <span className="mr-1 text-[10px] uppercase tracking-wide text-white/40">{quantos > 1 ? `${quantos} itens` : 'Na página'}</span>
      {botoes.map((b) => (
        <button
          key={b.a}
          type="button"
          onClick={() => onAlinhar(b.a)}
          disabled={quantos < (b.min ?? 1)}
          title={b.rotulo}
          aria-label={b.rotulo}
          className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-25"
        >
          <b.icone className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

/** Painel direito sem nada selecionado: configurações da página. */
export function InspetorLamina({
  lamina,
  indice,
  primeiraEhCapa,
  comentarios,
  somenteLeitura,
  onFundo,
  onIrFundos,
  onAdicionarTexto,
  onLayoutVazio,
}: {
  lamina: LaminaDoc
  indice: number
  primeiraEhCapa: boolean
  comentarios: number
  somenteLeitura: boolean
  onFundo: (cor: string) => void
  onIrFundos: () => void
  onAdicionarTexto: () => void
  onLayoutVazio: (n: number) => void
}) {
  return (
    <div className="space-y-4 p-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Configurações da página</p>
        <p className="mt-1 font-medium">{rotuloDaLamina(indice, primeiraEhCapa)}</p>
        <p className="text-xs text-white/60">
          {lamina.quadros.length} foto(s) · {lamina.textos.length} texto(s) · {lamina.formas.length} elemento(s)
          {comentarios > 0 ? ` · ${comentarios} comentário(s) do cliente` : ''}
        </p>
      </div>
      {!somenteLeitura ? (
        <>
          <label className="flex items-center justify-between gap-2 text-xs text-white/80">
            Cor de fundo
            <input type="color" value={lamina.fundo} onChange={(e) => onFundo(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-white/20 bg-transparent" />
          </label>
          <button type="button" onClick={onIrFundos} className="text-xs text-white/70 underline">
            Degradês, texturas e foto de fundo
          </button>
          <div className="space-y-1">
            <p className="text-xs text-white/60">Aplicar layout vazio</p>
            <div className="grid grid-cols-4 gap-1">
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <button key={n} type="button" onClick={() => onLayoutVazio(n)} className="rounded bg-white/10 py-1 text-xs hover:bg-white/20">
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={onAdicionarTexto} className="w-full rounded-md border border-white/20 px-2.5 py-1.5 text-left text-xs hover:bg-white/10">
            + Caixa de texto
          </button>
        </>
      ) : null}
      <div className="space-y-1 text-xs text-white/40">
        <p>Shift+clique: seleção múltipla · Ctrl+C / Ctrl+V / Ctrl+D</p>
        <p>Arraste uma foto sobre outra para trocar as duas</p>
        <p>Ctrl+Z desfaz · Delete apaga · setas movem 1 mm (Shift: 10)</p>
        <p>Ctrl + rodinha: zoom · Ctrl+0: ajustar à tela</p>
      </div>
    </div>
  )
}
