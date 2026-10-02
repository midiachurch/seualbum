'use client'

import { useState, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  RotateCw,
  Sparkles,
  Crop,
  Expand,
  FlipHorizontal2,
  FlipVertical2,
  ImageOff,
  Maximize,
  RotateCcw,
  Scan,
  Trash2,
} from 'lucide-react'
import { AJUSTES_NEUTROS, dpiDoQuadro, type Ajustes, type FormaDoc, type Geometria, type Quadro, type TextoDoc } from '@/lib/album/documento'
import { LIMITE_ESTOURO } from '@/lib/album/ajustes'
import { FONTES_ALBUM } from '@/lib/album/fontes'
import { DPI_MINIMO } from '@/lib/resolucao'
import { cn } from '@/lib/utils'

const arred = (v: number) => Math.round(v * 10) / 10
const TITULO = 'text-xs font-semibold uppercase tracking-wide text-white/50'
const BOTAO = 'flex w-full items-center gap-2 rounded-md border border-white/20 px-2.5 py-1.5 text-left text-xs text-white hover:bg-white/10 disabled:opacity-40'

function Numero({ rotulo, valor, passo = 0.5, onMudar }: { rotulo: string; valor: number; passo?: number; onMudar: (v: number) => void }) {
  return (
    <label className="block text-[11px] text-white/60">
      {rotulo}
      <input
        type="number"
        step={passo}
        value={arred(valor)}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onMudar(v)
        }}
        className="mt-0.5 block w-full rounded-md border border-white/20 bg-white/5 px-2 py-1 text-sm tabular-nums text-white"
      />
    </label>
  )
}

function Faixa({ rotulo, valor, min, max, passo = 1, sufixo = '', onMudar }: { rotulo: string; valor: number; min: number; max: number; passo?: number; sufixo?: string; onMudar: (v: number) => void }) {
  return (
    <label className="block text-[11px] text-white/60">
      <span className="flex justify-between">
        {rotulo}
        <span className="tabular-nums text-white/80">
          {arred(valor)}
          {sufixo}
        </span>
      </span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => onMudar(Number(e.target.value))} className="mt-0.5 block w-full accent-white" />
    </label>
  )
}

function Cor({ rotulo, valor, permitirNenhuma, onMudar }: { rotulo: string; valor: string | null; permitirNenhuma?: boolean; onMudar: (v: string | null) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-white/80">
      {rotulo}
      <span className="flex items-center gap-1.5">
        {permitirNenhuma ? (
          <button type="button" onClick={() => onMudar(null)} className={cn('rounded px-1.5 py-0.5 text-[10px]', valor === null ? 'bg-white text-[#171717]' : 'bg-white/10')}>
            Nenhuma
          </button>
        ) : null}
        <input type="color" value={valor ?? '#000000'} onChange={(e) => onMudar(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-white/20 bg-transparent" />
      </span>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <p className={TITULO}>{titulo}</p>
      {children}
    </section>
  )
}

function PosicaoTamanho({
  e,
  comAltura = true,
  onAlterar,
}: {
  e: { x: number; y: number; w: number; h?: number; rotacao: number; opacidade: number }
  comAltura?: boolean
  onAlterar: (p: { x?: number; y?: number; w?: number; h?: number; rotacao?: number; opacidade?: number }) => void
}) {
  const [proporcional, setProporcional] = useState(false)
  const razao = e.h !== undefined && e.w > 0 ? e.h / e.w : 1
  return (
    <Secao titulo="Posição, tamanho e rotação">
      <div className="grid grid-cols-2 gap-2">
        <Numero rotulo="X (mm)" valor={e.x} onMudar={(x) => onAlterar({ x })} />
        <Numero rotulo="Y (mm)" valor={e.y} onMudar={(y) => onAlterar({ y })} />
        <Numero
          rotulo="Largura"
          valor={e.w}
          onMudar={(w) => {
            const nw = Math.max(1, w)
            // Proporcional: cresce/encolhe em torno do centro, mantendo a forma.
            if (proporcional && comAltura && e.h !== undefined) onAlterar({ w: nw, h: nw * razao, x: e.x + (e.w - nw) / 2, y: e.y + (e.h - nw * razao) / 2 })
            else onAlterar({ w: nw })
          }}
        />
        {comAltura && e.h !== undefined ? (
          <Numero
            rotulo="Altura"
            valor={e.h}
            onMudar={(h) => {
              const nh = Math.max(0.1, h)
              if (proporcional) onAlterar({ h: nh, w: nh / razao, x: e.x + (e.w - nh / razao) / 2, y: e.y + (e.h! - nh) / 2 })
              else onAlterar({ h: nh })
            }}
          />
        ) : null}
      </div>
      {comAltura ? (
        <label className="flex items-center gap-2 text-[11px] text-white/70">
          <input type="checkbox" checked={proporcional} onChange={(ev) => setProporcional(ev.target.checked)} className="accent-white" />
          Manter proporção (no canvas: segure Shift ao puxar o canto)
        </label>
      ) : null}
      <Faixa rotulo="Rotação" valor={e.rotacao} min={-180} max={180} sufixo="°" onMudar={(rotacao) => onAlterar({ rotacao })} />
      <Faixa rotulo="Opacidade" valor={Math.round(e.opacidade * 100)} min={0} max={100} sufixo="%" onMudar={(v) => onAlterar({ opacidade: v / 100 })} />
    </Secao>
  )
}

export type DirecaoOrdem = 'frente' | 'avancar' | 'recuar' | 'tras'

function Ordem({ onOrdem, onExcluir, onDuplicar, rotuloExcluir }: { onOrdem: (d: DirecaoOrdem) => void; onExcluir: () => void; onDuplicar: () => void; rotuloExcluir: string }) {
  return (
    <section className="space-y-2">
      <p className={TITULO}>Camada</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={BOTAO} onClick={() => onOrdem('frente')}>
          <ArrowUpToLine className="h-4 w-4" aria-hidden /> Trazer p/ frente
        </button>
        <button type="button" className={BOTAO} onClick={() => onOrdem('avancar')}>
          <ArrowUp className="h-4 w-4" aria-hidden /> Avançar
        </button>
        <button type="button" className={BOTAO} onClick={() => onOrdem('recuar')}>
          <ArrowDown className="h-4 w-4" aria-hidden /> Recuar
        </button>
        <button type="button" className={BOTAO} onClick={() => onOrdem('tras')}>
          <ArrowDownToLine className="h-4 w-4" aria-hidden /> Enviar p/ trás
        </button>
      </div>
      <button type="button" className={BOTAO} onClick={onDuplicar}>
        <Copy className="h-4 w-4" aria-hidden /> Duplicar (Ctrl+D)
      </button>
      <button type="button" className={cn(BOTAO, 'text-red-300')} onClick={onExcluir}>
        <Trash2 className="h-4 w-4" aria-hidden /> {rotuloExcluir}
      </button>
    </section>
  )
}

/* --------------------------------- foto --------------------------------- */

/**
 * Quadro selecionado tem duas faces (seção "regra de ouro" da especificação):
 *   - QUADRO: geometria — posição, tamanho, rotação, borda, cantos, sombra;
 *   - FOTO: o que aparece dentro — escala, posição, ponto focal, ajustes.
 * A face "Foto" é o modo de ajuste (duplo clique na foto): mexer nela nunca
 * altera o quadro, e vice-versa.
 */
export function InspetorQuadro({
  geometria: g,
  quadro: q,
  foto,
  recortando,
  escolhendoFoco,
  onRecortar,
  onEscolherFoco,
  onAlterar,
  onOrdem,
  onExcluir,
  onDuplicar,
}: {
  geometria: Geometria
  quadro: Quadro
  foto: { nome: string; largura: number | null; altura: number | null; estouro?: number | null; fx?: number | null; fy?: number | null; focoManual?: boolean } | null
  recortando: boolean
  escolhendoFoco: boolean
  onRecortar: (v: boolean) => void
  onEscolherFoco: (v: boolean) => void
  onAlterar: (patch: Partial<Quadro>) => void
  onOrdem: (d: DirecaoOrdem) => void
  onExcluir: () => void
  onDuplicar: () => void
}) {
  const dpi = foto?.largura && foto.altura ? dpiDoQuadro(q, foto.largura, foto.altura) : null
  const ajuste = (patch: Partial<Ajustes>) => onAlterar({ ajustes: { ...q.ajustes, ...patch } })
  const face: 'quadro' | 'foto' = recortando && q.fotoId ? 'foto' : 'quadro'
  const sangrar = () => {
    // Bordas a menos de 1 cm do corte vão até o fim da sangria.
    const s = g.sangria
    let { x, y, w, h } = q
    if (x < 10) {
      w += x + s
      x = -s
    }
    if (y < 10) {
      h += y + s
      y = -s
    }
    if (g.laminaW - (x + w) < 10) w = g.laminaW + s - x
    if (g.laminaH - (y + h) < 10) h = g.laminaH + s - y
    onAlterar({ x, y, w, h, rotacao: 0 })
  }
  const pagina = q.x + q.w / 2 < g.paginaW ? 0 : 1

  return (
    <div className="space-y-5 p-4 text-sm">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1" role="tablist" aria-label="Editar">
        <button
          type="button"
          role="tab"
          aria-selected={face === 'quadro'}
          onClick={() => onRecortar(false)}
          className={cn('rounded-md py-1.5 text-xs font-semibold', face === 'quadro' ? 'bg-white text-[#171717]' : 'text-white/70 hover:text-white')}
        >
          Quadro
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={face === 'foto'}
          disabled={!q.fotoId}
          onClick={() => onRecortar(true)}
          className={cn('rounded-md py-1.5 text-xs font-semibold disabled:opacity-40', face === 'foto' ? 'bg-white text-[#171717]' : 'text-white/70 hover:text-white')}
        >
          Foto
        </button>
      </div>
      <p className="-mt-3 text-[11px] font-semibold uppercase tracking-wide text-sky-300">{face === 'foto' ? 'Foto selecionada' : 'Quadro selecionado'}</p>

      <Secao titulo="Imagem">
        {foto ? (
          <>
            <p className="truncate text-white/80" title={foto.nome}>
              {foto.nome}
            </p>
            {foto.largura && foto.altura ? (
              <p className="text-xs tabular-nums text-white/50">
                {foto.largura}×{foto.altura} px
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-white/50">Quadro vazio — arraste uma foto para ele.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {dpi !== null ? (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', dpi < DPI_MINIMO ? 'bg-amber-400 text-[#171717]' : 'bg-emerald-500/20 text-emerald-300')}>
              {dpi} DPI{dpi < DPI_MINIMO ? ` — abaixo de ${DPI_MINIMO}` : ''}
            </span>
          ) : null}
          {foto?.estouro != null && foto.estouro > LIMITE_ESTOURO ? (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-[#171717]">Estourada ({Math.round(foto.estouro * 100)}%)</span>
          ) : null}
        </div>
      </Secao>

      {face === 'foto' ? (
        <>
          <Secao titulo="Enquadramento (não muda o quadro)">
            <p className="text-[11px] text-white/50">Arraste a foto dentro do quadro no canvas. Esc ou “Quadro” volta.</p>
            <Faixa rotulo="Escala (zoom)" valor={Math.round(q.recorte.zoom * 100)} min={100} max={400} sufixo="%" onMudar={(v) => onAlterar({ recorte: { ...q.recorte, zoom: v / 100 } })} />
            <Faixa rotulo="Posição horizontal" valor={Math.round(q.recorte.cx * 100)} min={0} max={100} sufixo="%" onMudar={(v) => onAlterar({ recorte: { ...q.recorte, cx: v / 100 } })} />
            <Faixa rotulo="Posição vertical" valor={Math.round(q.recorte.cy * 100)} min={0} max={100} sufixo="%" onMudar={(v) => onAlterar({ recorte: { ...q.recorte, cy: v / 100 } })} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={BOTAO} onClick={() => onAlterar({ recorte: { zoom: 1, cx: foto?.fx ?? 0.5, cy: foto?.fy ?? 0.5 } })}>
                <Sparkles className="h-4 w-4" aria-hidden /> Automático
              </button>
              <button type="button" className={BOTAO} onClick={() => onAlterar({ recorte: { ...q.recorte, cx: 0.5, cy: 0.5 } })}>
                Centralizar
              </button>
            </div>
            <button type="button" aria-pressed={escolhendoFoco} className={cn(BOTAO, escolhendoFoco && 'bg-amber-400 text-[#171717] hover:bg-amber-300')} onClick={() => onEscolherFoco(!escolhendoFoco)}>
              <Scan className="h-4 w-4" aria-hidden />
              {escolhendoFoco ? 'Clique no ponto principal da foto…' : 'Definir ponto focal'}
            </button>
            <p className="text-[11px] text-white/50">
              Ponto focal: {Math.round((foto?.fx ?? 0.5) * 100)}% × {Math.round((foto?.fy ?? 0.5) * 100)}%{foto?.focoManual ? ' (definido à mão)' : ' (automático)'} — vale para esta foto em
              qualquer quadro.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={q.espelharH} className={cn(BOTAO, q.espelharH && 'bg-white/20')} onClick={() => onAlterar({ espelharH: !q.espelharH })}>
                <FlipHorizontal2 className="h-4 w-4" aria-hidden /> Espelhar ↔
              </button>
              <button type="button" aria-pressed={q.espelharV} className={cn(BOTAO, q.espelharV && 'bg-white/20')} onClick={() => onAlterar({ espelharV: !q.espelharV })}>
                <FlipVertical2 className="h-4 w-4" aria-hidden /> Espelhar ↕
              </button>
            </div>
          </Secao>
          <Secao titulo="Ajustes">
            <Faixa rotulo="Exposição" valor={q.ajustes.exposicao} min={-100} max={100} onMudar={(exposicao) => ajuste({ exposicao })} />
            <Faixa rotulo="Brilho" valor={q.ajustes.brilho} min={-100} max={100} onMudar={(brilho) => ajuste({ brilho })} />
            <Faixa rotulo="Contraste" valor={q.ajustes.contraste} min={-100} max={100} onMudar={(contraste) => ajuste({ contraste })} />
            <Faixa rotulo="Saturação" valor={q.ajustes.saturacao} min={-100} max={100} onMudar={(saturacao) => ajuste({ saturacao })} />
            <Faixa rotulo="Temperatura" valor={q.ajustes.temperatura} min={-100} max={100} onMudar={(temperatura) => ajuste({ temperatura })} />
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={q.ajustes.pb} onChange={(e) => ajuste({ pb: e.target.checked })} className="accent-white" />
              Preto e branco
            </label>
          </Secao>
          <button
            type="button"
            className={BOTAO}
            onClick={() => onAlterar({ recorte: { zoom: 1, cx: foto?.fx ?? 0.5, cy: foto?.fy ?? 0.5 }, espelharH: false, espelharV: false, ajustes: { ...AJUSTES_NEUTROS } })}
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Restaurar foto (enquadramento e ajustes)
          </button>
          <button type="button" className={BOTAO} onClick={() => onAlterar({ fotoId: null })}>
            <ImageOff className="h-4 w-4" aria-hidden /> Tirar a foto (manter o quadro)
          </button>
        </>
      ) : (
        <>
          <PosicaoTamanho e={q} onAlterar={onAlterar} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={BOTAO} onClick={() => onAlterar({ rotacao: ((q.rotacao - 90 + 540) % 360) - 180 })}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Girar −90°
            </button>
            <button type="button" className={BOTAO} onClick={() => onAlterar({ rotacao: ((q.rotacao + 90 + 540) % 360) - 180 })}>
              <RotateCw className="h-4 w-4" aria-hidden /> Girar +90°
            </button>
            <button type="button" className={BOTAO} onClick={sangrar}>
              <Expand className="h-4 w-4" aria-hidden /> Sangrar
            </button>
            <button
              type="button"
              className={BOTAO}
              onClick={() => onAlterar({ x: pagina * g.paginaW - (pagina === 0 ? g.sangria : 0), y: -g.sangria, w: g.paginaW + g.sangria, h: g.laminaH + 2 * g.sangria, rotacao: 0 })}
            >
              <Maximize className="h-4 w-4" aria-hidden /> Página inteira
            </button>
            <button
              type="button"
              className={BOTAO}
              disabled={!foto?.largura || !foto.altura}
              onClick={() => {
                if (!foto?.largura || !foto.altura) return
                const h = q.w * (foto.altura / foto.largura)
                onAlterar({ y: q.y + q.h / 2 - h / 2, h, recorte: { zoom: 1, cx: 0.5, cy: 0.5 } })
              }}
            >
              <Maximize className="h-4 w-4" aria-hidden /> Ajustar à foto
            </button>
            <button type="button" className={BOTAO} onClick={() => onAlterar({ recorte: { zoom: 1, cx: foto?.fx ?? 0.5, cy: foto?.fy ?? 0.5 } })}>
              <Scan className="h-4 w-4" aria-hidden /> Preencher quadro
            </button>
          </div>
          <Secao titulo="Borda, cantos e sombra">
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={q.borda !== null} onChange={(e) => onAlterar({ borda: e.target.checked ? { cor: '#ffffff', espessura: 2 } : null })} className="accent-white" />
              Borda
            </label>
            {q.borda ? (
              <>
                <Cor rotulo="Cor da borda" valor={q.borda.cor} onMudar={(cor) => onAlterar({ borda: { ...q.borda!, cor: cor ?? '#ffffff' } })} />
                <Faixa rotulo="Espessura" valor={q.borda.espessura} min={0.2} max={15} passo={0.1} sufixo=" mm" onMudar={(espessura) => onAlterar({ borda: { ...q.borda!, espessura } })} />
              </>
            ) : null}
            <Faixa rotulo="Cantos arredondados" valor={q.raio} min={0} max={Math.round(Math.min(q.w, q.h) / 2)} passo={0.5} sufixo=" mm" onMudar={(raio) => onAlterar({ raio })} />
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={q.sombra} onChange={(e) => onAlterar({ sombra: e.target.checked })} className="accent-white" />
              Sombra
            </label>
          </Secao>
          <Ordem onOrdem={onOrdem} onExcluir={onExcluir} onDuplicar={onDuplicar} rotuloExcluir="Excluir quadro" />
        </>
      )}
    </div>
  )
}

/* --------------------------------- texto --------------------------------- */

export function InspetorTexto({
  texto: t,
  onAlterar,
  onOrdem,
  onExcluir,
  onDuplicar,
}: {
  texto: TextoDoc
  onAlterar: (patch: Partial<TextoDoc>) => void
  onOrdem: (d: DirecaoOrdem) => void
  onExcluir: () => void
  onDuplicar: () => void
}) {
  const fonte = FONTES_ALBUM.find((f) => f.chave === t.fonte) ?? FONTES_ALBUM[0]
  return (
    <div className="space-y-5 p-4 text-sm">
      <Secao titulo="Texto">
        <textarea
          value={t.texto}
          rows={4}
          maxLength={2000}
          onChange={(e) => onAlterar({ texto: e.target.value })}
          className="block w-full resize-y rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white"
          aria-label="Conteúdo do texto"
        />
      </Secao>
      <Secao titulo="Fonte">
        <select
          value={t.fonte}
          onChange={(e) => {
            const nova = FONTES_ALBUM.find((f) => f.chave === e.target.value) ?? FONTES_ALBUM[0]
            onAlterar({ fonte: nova.chave, peso: nova.pesos.includes(t.peso) ? t.peso : nova.pesos[0] })
          }}
          className="block w-full rounded-md border border-white/20 bg-[#1c1c1c] px-2 py-1.5 text-sm text-white"
          aria-label="Fonte"
        >
          {FONTES_ALBUM.map((f) => (
            <option key={f.chave} value={f.chave}>
              {f.nome}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <Numero rotulo="Tamanho (pt)" valor={t.tamanho} passo={1} onMudar={(tamanho) => onAlterar({ tamanho: Math.min(400, Math.max(4, tamanho)) })} />
          <label className="block text-[11px] text-white/60">
            Peso
            <select
              value={t.peso}
              onChange={(e) => onAlterar({ peso: Number(e.target.value) as TextoDoc['peso'] })}
              className="mt-0.5 block w-full rounded-md border border-white/20 bg-[#1c1c1c] px-2 py-1 text-sm text-white"
            >
              {fonte.pesos.map((p) => (
                <option key={p} value={p}>
                  {{ 300: 'Leve', 400: 'Regular', 500: 'Médio', 600: 'Seminegrito', 700: 'Negrito' }[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={t.italico} onChange={(e) => onAlterar({ italico: e.target.checked })} className="accent-white" />
          Itálico
        </label>
        <Cor rotulo="Cor" valor={t.cor} onMudar={(cor) => onAlterar({ cor: cor ?? '#171717' })} />
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Alinhamento">
          {(
            [
              ['left', AlignLeft, 'Esquerda'],
              ['center', AlignCenter, 'Centro'],
              ['right', AlignRight, 'Direita'],
            ] as const
          ).map(([v, Icone, r]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={t.alinhamento === v}
              aria-label={r}
              onClick={() => onAlterar({ alinhamento: v })}
              className={cn('flex justify-center rounded-md py-1.5', t.alinhamento === v ? 'bg-white text-[#171717]' : 'bg-white/10 text-white')}
            >
              <Icone className="h-4 w-4" />
            </button>
          ))}
        </div>
        <Faixa rotulo="Espaço entre letras" valor={t.entreLetras} min={-100} max={500} passo={10} onMudar={(entreLetras) => onAlterar({ entreLetras })} />
        <Faixa rotulo="Espaço entre linhas" valor={t.entreLinhas} min={0.8} max={3} passo={0.05} sufixo="×" onMudar={(entreLinhas) => onAlterar({ entreLinhas })} />
      </Secao>
      <PosicaoTamanho e={t} comAltura={false} onAlterar={onAlterar} />
      <Ordem onOrdem={onOrdem} onExcluir={onExcluir} onDuplicar={onDuplicar} rotuloExcluir="Excluir texto" />
    </div>
  )
}

/* --------------------------------- forma --------------------------------- */

export function InspetorForma({
  forma: f,
  onAlterar,
  onOrdem,
  onExcluir,
  onDuplicar,
}: {
  forma: FormaDoc
  onAlterar: (patch: Partial<FormaDoc>) => void
  onOrdem: (d: DirecaoOrdem) => void
  onExcluir: () => void
  onDuplicar: () => void
}) {
  return (
    <div className="space-y-5 p-4 text-sm">
      <Secao titulo={f.forma === 'linha' ? 'Linha' : f.forma === 'elipse' ? 'Elipse' : f.forma === 'ornamento' ? 'Ornamento' : 'Retângulo'}>
        {f.forma !== 'linha' ? <Cor rotulo="Preenchimento" valor={f.preenchimento} permitirNenhuma onMudar={(preenchimento) => onAlterar({ preenchimento })} /> : null}
        <Cor rotulo={f.forma === 'linha' ? 'Cor' : 'Contorno'} valor={f.contorno} permitirNenhuma={f.forma !== 'linha'} onMudar={(contorno) => onAlterar({ contorno: contorno ?? (f.forma === 'linha' ? '#171717' : null) })} />
        <Faixa rotulo="Espessura" valor={f.espessura} min={0} max={10} passo={0.1} sufixo=" mm" onMudar={(espessura) => onAlterar({ espessura })} />
        <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Camada">
          {(
            [
              ['tras', 'Atrás das fotos'],
              ['frente', 'Na frente'],
            ] as const
          ).map(([v, r]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={f.camada === v}
              onClick={() => onAlterar({ camada: v })}
              className={cn('rounded-md py-1.5 text-xs', f.camada === v ? 'bg-white text-[#171717]' : 'bg-white/10 text-white')}
            >
              {r}
            </button>
          ))}
        </div>
      </Secao>
      <PosicaoTamanho e={f} comAltura={f.forma !== 'linha'} onAlterar={onAlterar} />
      <Ordem onOrdem={onOrdem} onExcluir={onExcluir} onDuplicar={onDuplicar} rotuloExcluir="Excluir elemento" />
    </div>
  )
}

/* --------------------------- vários selecionados --------------------------- */

export type CaixaSelecionada = { id: string; tipo: 'quadro' | 'texto' | 'forma'; x: number; y: number; w: number; h: number }

/**
 * Vários elementos selecionados: igualar tamanhos (pelo último clicado) e
 * escalar todos juntos — cada um em torno do próprio centro. Alinhar e
 * distribuir ficam na barra acima.
 */
export type PatchDeLote = { borda?: Quadro['borda']; raio?: number; opacidade?: number; sombra?: boolean; ajustesPb?: boolean }

export function InspetorMultiplo({
  itens,
  onAlterarVarios,
  onLote,
  onExcluir,
  onDuplicar,
}: {
  /** Propriedades de lote dos quadros de foto (nunca o enquadramento). */
  onLote?: (patch: PatchDeLote, rotulo: string) => void
  itens: CaixaSelecionada[]
  onAlterarVarios: (patches: { id: string; tipo: CaixaSelecionada['tipo']; patch: { x?: number; y?: number; w?: number; h?: number } }[], rotulo: string) => void
  onExcluir: () => void
  onDuplicar: () => void
}) {
  const [escala, setEscala] = useState('100')
  const [corLote, setCorLote] = useState('#ffffff')
  const [espLote, setEspLote] = useState(2)
  const [raioLote, setRaioLote] = useState(0)
  const [opacLote, setOpacLote] = useState(100)
  const ref = itens[itens.length - 1]
  const comAltura = (i: CaixaSelecionada) => i.tipo !== 'texto'
  const igualar = (modo: 'largura' | 'altura' | 'tamanho') =>
    onAlterarVarios(
      itens.map((i) => {
        const w = modo === 'altura' ? i.w : ref.w
        const h = modo === 'largura' || !comAltura(i) ? i.h : ref.h
        return { id: i.id, tipo: i.tipo, patch: { w, ...(comAltura(i) ? { h } : {}), x: i.x + (i.w - w) / 2, y: i.y + (i.h - h) / 2 } }
      }),
      modo === 'tamanho' ? 'Igualado o tamanho' : modo === 'largura' ? 'Igualada a largura' : 'Igualada a altura',
    )
  const aplicarEscala = () => {
    const f = Number(escala.replace(',', '.')) / 100
    if (!(f > 0.05 && f < 20)) return
    onAlterarVarios(
      itens.map((i) => {
        const w = Math.max(5, i.w * f)
        const h = comAltura(i) ? Math.max(1, i.h * f) : i.h
        return { id: i.id, tipo: i.tipo, patch: { w, ...(comAltura(i) ? { h } : {}), x: i.x + (i.w - w) / 2, y: i.y + (i.h - h) / 2 } }
      }),
      `Escalados ${itens.length} elementos (${Math.round(f * 100)}%)`,
    )
    setEscala('100')
  }
  return (
    <div className="space-y-5 p-4 text-sm">
      <Secao titulo={`${itens.length} elementos selecionados`}>
        <p className="text-xs text-white/60">Arraste qualquer um para mover todos. Os cantos redimensionam e giram o conjunto. Shift+clique tira ou põe na seleção.</p>
      </Secao>
      {onLote ? (
        <Secao titulo="Em lote (só os quadros de foto)">
          <p className="text-[11px] text-white/50">Cada foto mantém o próprio enquadramento — aqui só muda o que for escolhido.</p>
          <div className="flex items-center justify-between gap-2 text-xs text-white/80">
            Borda
            <span className="flex items-center gap-1.5">
              <button type="button" onClick={() => onLote({ borda: null }, 'Bordas removidas')} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                Nenhuma
              </button>
              <input type="color" defaultValue="#ffffff" onChange={(e) => setCorLote(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-white/20 bg-transparent" aria-label="Cor da borda" />
            </span>
          </div>
          <Faixa rotulo="Espessura da borda" valor={espLote} min={0.2} max={15} passo={0.1} sufixo=" mm" onMudar={setEspLote} />
          <button type="button" className={BOTAO} onClick={() => onLote({ borda: { cor: corLote, espessura: espLote } }, 'Borda aplicada em lote')}>
            Aplicar borda em todos
          </button>
          <Faixa rotulo="Cantos arredondados" valor={raioLote} min={0} max={40} passo={0.5} sufixo=" mm" onMudar={(v) => (setRaioLote(v), onLote({ raio: v }, 'Cantos em lote'))} />
          <Faixa rotulo="Opacidade" valor={opacLote} min={0} max={100} sufixo="%" onMudar={(v) => (setOpacLote(v), onLote({ opacidade: v / 100 }, 'Opacidade em lote'))} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={BOTAO} onClick={() => onLote({ sombra: true }, 'Sombra em lote')}>
              Com sombra
            </button>
            <button type="button" className={BOTAO} onClick={() => onLote({ sombra: false }, 'Sem sombra em lote')}>
              Sem sombra
            </button>
            <button type="button" className={BOTAO} onClick={() => onLote({ ajustesPb: true }, 'P&B em lote')}>
              Preto e branco
            </button>
            <button type="button" className={BOTAO} onClick={() => onLote({ ajustesPb: false }, 'Cor em lote')}>
              Colorido
            </button>
          </div>
        </Secao>
      ) : null}
      <Secao titulo="Igualar ao último selecionado">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className={BOTAO} onClick={() => igualar('largura')}>
            Largura
          </button>
          <button type="button" className={BOTAO} onClick={() => igualar('altura')}>
            Altura
          </button>
          <button type="button" className={BOTAO} onClick={() => igualar('tamanho')}>
            Tamanho
          </button>
        </div>
        <p className="text-[11px] text-white/50">
          Referência: {Math.round(ref.w)} × {Math.round(ref.h)} mm
        </p>
      </Secao>
      <Secao titulo="Escalar todos">
        <div className="flex items-end gap-2">
          <label className="block flex-1 text-[11px] text-white/60">
            Escala (%)
            <input
              inputMode="decimal"
              value={escala}
              onChange={(e) => setEscala(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && aplicarEscala()}
              className="mt-0.5 block w-full rounded-md border border-white/20 bg-white/5 px-2 py-1 text-sm tabular-nums text-white"
            />
          </label>
          <button type="button" onClick={aplicarEscala} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#171717]">
            Aplicar
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[90, 95, 105, 110].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setEscala(String(v))
                const f = v / 100
                onAlterarVarios(
                  itens.map((i) => {
                    const w = Math.max(5, i.w * f)
                    const h = comAltura(i) ? Math.max(1, i.h * f) : i.h
                    return { id: i.id, tipo: i.tipo, patch: { w, ...(comAltura(i) ? { h } : {}), x: i.x + (i.w - w) / 2, y: i.y + (i.h - h) / 2 } }
                  }),
                  `Escalados ${itens.length} elementos (${v}%)`,
                )
              }}
              className="rounded bg-white/10 py-1 text-[11px] hover:bg-white/20"
            >
              {v}%
            </button>
          ))}
        </div>
      </Secao>
      <section className="space-y-2">
        <button type="button" className={BOTAO} onClick={onDuplicar}>
          <Copy className="h-4 w-4" aria-hidden /> Duplicar seleção (Ctrl+D)
        </button>
        <button type="button" className={cn(BOTAO, 'text-red-300')} onClick={onExcluir}>
          <Trash2 className="h-4 w-4" aria-hidden /> Excluir seleção
        </button>
      </section>
    </div>
  )
}
