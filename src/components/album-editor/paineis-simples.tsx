'use client'

import { useState } from 'react'
import { Circle, Copy, Eraser, LayoutGrid, Minus, Plus, Square, SquareDashed, Trash2 } from 'lucide-react'
import { MiniaturaLamina } from '@/components/album-editor/miniatura-lamina'
import type { FotoNoCanvas } from '@/components/album-editor/tipos'
import { familiaDe } from '@/lib/album/fontes'
import { rotuloDaLamina, type FormaDoc, type Geometria, type LaminaDoc, type TextoDoc, type Textura } from '@/lib/album/documento'
import { ORNAMENTOS } from '@/lib/album/ornamentos'
import { TEXTURAS } from '@/lib/album/texturas'
import { urlParaMiniatura } from '@/components/album-editor/tipos'
import type { FotoDoEditor } from '@/lib/supabase/queries'
import { cn } from '@/lib/utils'

const TITULO = 'text-xs font-semibold uppercase tracking-wide text-white/50'
const CAMPO = 'mt-1 block w-full rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white'

/* --------------------------------- Fundos --------------------------------- */

const PALETA = ['#ffffff', '#fbfaf8', '#f5f0ea', '#e8e1d8', '#d9cfc1', '#b8a38a', '#8a7b6a', '#3f3a34', '#1c1c1c', '#000000', '#e9eef6', '#dfe8df', '#f3e1e1']

const GRADIENTES: { de: string; para: string; angulo: number }[] = [
  { de: '#ffffff', para: '#e8e1d8', angulo: 90 },
  { de: '#f7f3ec', para: '#d9cfc1', angulo: 45 },
  { de: '#1c1c1c', para: '#3f3a34', angulo: 90 },
  { de: '#e9eef6', para: '#ffffff', angulo: 90 },
  { de: '#f3e1e1', para: '#fbfaf8', angulo: 0 },
  { de: '#000000', para: '#1c1c1c', angulo: 135 },
]

export function PainelFundos({
  lamina,
  fotos,
  somenteLeitura,
  onCor,
  onImagem,
  onGradiente,
  onTextura,
}: {
  lamina: LaminaDoc
  fotos: FotoDoEditor[]
  somenteLeitura: boolean
  onCor: (cor: string, todas: boolean) => void
  onImagem: (fundo: LaminaDoc['fundoImagem'], todas: boolean) => void
  onGradiente: (g: LaminaDoc['fundoGradiente'], todas: boolean) => void
  onTextura: (t: LaminaDoc['textura'], todas: boolean) => void
}) {
  const [todas, setTodas] = useState(false)
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
      <label className="flex items-center gap-2 text-xs text-white/80">
        <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="accent-white" />
        Aplicar em todas as lâminas
      </label>
      <section className="space-y-2">
        <p className={TITULO}>Cor de fundo</p>
        <div className="grid grid-cols-7 gap-1.5">
          {PALETA.map((c) => (
            <button
              key={c}
              type="button"
              disabled={somenteLeitura}
              onClick={() => onCor(c, todas)}
              aria-label={`Fundo ${c}`}
              className={cn('h-7 rounded-md ring-1 ring-white/20', lamina.fundo === c && 'ring-2 ring-sky-400')}
              style={{ background: c }}
            />
          ))}
        </div>
        <label className="flex items-center justify-between text-xs text-white/80">
          Outra cor
          <input type="color" value={lamina.fundo} disabled={somenteLeitura} onChange={(e) => onCor(e.target.value, todas)} className="h-8 w-12 cursor-pointer rounded border border-white/20 bg-transparent" />
        </label>
      </section>
      <section className="space-y-2">
        <p className={TITULO}>Degradê</p>
        <div className="grid grid-cols-6 gap-1.5">
          {GRADIENTES.map((gr, i) => (
            <button
              key={i}
              type="button"
              disabled={somenteLeitura}
              onClick={() => onGradiente(gr, todas)}
              aria-label={`Degradê ${gr.de} a ${gr.para}`}
              className="h-7 rounded-md ring-1 ring-white/20"
              style={{ background: `linear-gradient(${gr.angulo + 90}deg, ${gr.de}, ${gr.para})` }}
            />
          ))}
        </div>
        {lamina.fundoGradiente ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-white/80">
              Cores
              <span className="flex gap-1">
                <input type="color" value={lamina.fundoGradiente.de} disabled={somenteLeitura} onChange={(e) => onGradiente({ ...lamina.fundoGradiente!, de: e.target.value }, todas)} className="h-7 w-9 rounded border border-white/20 bg-transparent" aria-label="Cor inicial" />
                <input type="color" value={lamina.fundoGradiente.para} disabled={somenteLeitura} onChange={(e) => onGradiente({ ...lamina.fundoGradiente!, para: e.target.value }, todas)} className="h-7 w-9 rounded border border-white/20 bg-transparent" aria-label="Cor final" />
              </span>
            </div>
            <label className="block text-xs text-white/70">
              Ângulo ({lamina.fundoGradiente.angulo}°)
              <input type="range" min={0} max={360} value={lamina.fundoGradiente.angulo} disabled={somenteLeitura} onChange={(e) => onGradiente({ ...lamina.fundoGradiente!, angulo: Number(e.target.value) }, todas)} className="mt-1 block w-full accent-white" />
            </label>
            <button type="button" disabled={somenteLeitura} onClick={() => onGradiente(null, todas)} className="text-xs text-red-300 underline">
              Tirar degradê
            </button>
          </div>
        ) : null}
      </section>
      <section className="space-y-2">
        <p className={TITULO}>Textura</p>
        <div className="grid grid-cols-3 gap-1.5">
          {TEXTURAS.map((t) => (
            <button
              key={t.tipo}
              type="button"
              disabled={somenteLeitura}
              onClick={() => onTextura(lamina.textura?.tipo === t.tipo ? null : { tipo: t.tipo as Textura, opacidade: lamina.textura?.opacidade ?? 0.35 }, todas)}
              aria-pressed={lamina.textura?.tipo === t.tipo}
              className={cn('rounded-md px-2 py-1.5 text-[11px]', lamina.textura?.tipo === t.tipo ? 'bg-white text-[#171717]' : 'bg-white/10 text-white/80 hover:bg-white/20')}
            >
              {t.nome}
            </button>
          ))}
        </div>
        {lamina.textura ? (
          <label className="block text-xs text-white/70">
            Intensidade ({Math.round(lamina.textura.opacidade * 100)}%)
            <input type="range" min={0.05} max={1} step={0.05} value={lamina.textura.opacidade} disabled={somenteLeitura} onChange={(e) => onTextura({ ...lamina.textura!, opacidade: Number(e.target.value) }, todas)} className="mt-1 block w-full accent-white" />
          </label>
        ) : null}
      </section>
      <section className="space-y-2">
        <p className={TITULO}>Foto de fundo (sangrando a lâmina)</p>
        {lamina.fundoImagem ? (
          <>
            <label className="block text-xs text-white/70">
              Opacidade ({Math.round(lamina.fundoImagem.opacidade * 100)}%)
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={lamina.fundoImagem.opacidade}
                disabled={somenteLeitura}
                onChange={(e) => onImagem({ ...lamina.fundoImagem!, opacidade: Number(e.target.value) }, todas)}
                className="mt-1 block w-full accent-white"
              />
            </label>
            <button type="button" disabled={somenteLeitura} onClick={() => onImagem(null, todas)} className="text-xs text-red-300 underline">
              Tirar foto de fundo
            </button>
          </>
        ) : null}
        <ul className="grid grid-cols-3 gap-1">
          {fotos.slice(0, 60).map((f) => (
            <li key={f.id}>
              <button
                type="button"
                disabled={somenteLeitura}
                onClick={() => onImagem({ fotoId: f.id, opacidade: lamina.fundoImagem?.opacidade ?? 0.35 }, todas)}
                className={cn('block aspect-square w-full overflow-hidden rounded bg-white/5', lamina.fundoImagem?.fotoId === f.id && 'ring-2 ring-sky-400')}
                aria-label={`Usar ${f.nome} como fundo`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- link assinado do Storage. */}
                <img src={urlParaMiniatura(f)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/* --------------------------------- Textos --------------------------------- */

type ModeloTexto = { rotulo: string; amostra: string } & Partial<TextoDoc>

const TEXTOS: ModeloTexto[] = [
  { rotulo: 'Título', amostra: 'Ana & João', fonte: 'serifa', tamanho: 54, peso: 400 },
  { rotulo: 'Subtítulo', amostra: '12 de outubro de 2026', fonte: 'sans', tamanho: 14, peso: 500, entreLetras: 200 },
  { rotulo: 'Corpo', amostra: 'Um dia para guardar para sempre.', fonte: 'classica', tamanho: 18, peso: 400 },
  { rotulo: 'Legenda', amostra: 'Cerimônia — Igreja Matriz', fonte: 'sans-leve', tamanho: 10, peso: 400, alinhamento: 'left' },
  { rotulo: 'Manuscrito', amostra: 'com amor', fonte: 'manuscrita', tamanho: 40, peso: 400 },
  { rotulo: 'Editorial', amostra: 'O começo', fonte: 'editorial', tamanho: 64, peso: 300, italico: true },
]

export function PainelTextos({ somenteLeitura, onAdicionar }: { somenteLeitura: boolean; onAdicionar: (modelo: Partial<TextoDoc> & { texto: string }) => void }) {
  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      <p className="text-xs text-white/60">Clique para pôr na lâmina. Edite o texto e o estilo no painel da direita.</p>
      {TEXTOS.map((t) => (
        <button
          key={t.rotulo}
          type="button"
          disabled={somenteLeitura}
          onClick={() => {
            const { rotulo: _rotulo, amostra, ...estilo } = t
            void _rotulo
            onAdicionar({ ...estilo, texto: amostra })
          }}
          className="block w-full rounded-lg bg-white/5 p-3 text-left hover:bg-white/10 disabled:opacity-50"
        >
          <span className="block text-[10px] uppercase tracking-wide text-white/40">{t.rotulo}</span>
          <span
            className="block truncate text-white"
            style={{
              fontFamily: familiaDe(t.fonte ?? 'editorial'),
              fontWeight: t.peso,
              fontStyle: t.italico ? 'italic' : undefined,
              fontSize: Math.min(28, Math.max(12, (t.tamanho ?? 20) * 0.5)),
              letterSpacing: t.entreLetras ? `${t.entreLetras / 1000}em` : undefined,
            }}
          >
            {t.amostra}
          </span>
        </button>
      ))}
    </div>
  )
}

/* -------------------------------- Elementos -------------------------------- */

export function PainelElementos({ somenteLeitura, onAdicionar }: { somenteLeitura: boolean; onAdicionar: (forma: FormaDoc['forma'], estilo?: Partial<FormaDoc>) => void }) {
  const ornamentos = ORNAMENTOS
  const itens: { rotulo: string; icone: typeof Square; forma: FormaDoc['forma']; estilo?: Partial<FormaDoc> }[] = [
    { rotulo: 'Retângulo', icone: Square, forma: 'retangulo' },
    { rotulo: 'Círculo / elipse', icone: Circle, forma: 'elipse' },
    { rotulo: 'Linha', icone: Minus, forma: 'linha' },
    { rotulo: 'Moldura', icone: SquareDashed, forma: 'retangulo', estilo: { preenchimento: null, contorno: '#171717', espessura: 0.7, camada: 'frente' } },
    { rotulo: 'Faixa de cor', icone: Square, forma: 'retangulo', estilo: { preenchimento: '#1c1c1c', camada: 'tras' } },
  ]
  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      <p className="text-xs text-white/60">Formas para compor a lâmina: atrás das fotos (fundos, faixas) ou na frente (molduras, linhas).</p>
      <div className="grid grid-cols-2 gap-2">
        {itens.map((i) => (
          <button
            key={i.rotulo}
            type="button"
            disabled={somenteLeitura}
            onClick={() => onAdicionar(i.forma, i.estilo)}
            className="flex flex-col items-center gap-1.5 rounded-lg bg-white/5 p-3 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            <i.icone className="h-6 w-6" aria-hidden />
            {i.rotulo}
          </button>
        ))}
      </div>
      <p className={cn(TITULO, 'pt-2')}>Ícones e ornamentos</p>
      <div className="grid grid-cols-4 gap-2">
        {ornamentos.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={somenteLeitura}
            onClick={() =>
              onAdicionar('ornamento', { ornamento: o.id, preenchimento: o.preenchido ? '#8A7B6A' : null, contorno: o.preenchido ? null : '#8A7B6A', espessura: 0.6, camada: 'frente' })
            }
            title={o.nome}
            aria-label={o.nome}
            className="flex aspect-square items-center justify-center rounded-lg bg-white/5 p-2 hover:bg-white/10 disabled:opacity-50"
          >
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <path d={o.d} fill={o.preenchido ? '#d9cfc1' : 'none'} stroke={o.preenchido ? 'none' : '#d9cfc1'} strokeWidth={5} />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- Páginas --------------------------------- */

export function PainelPaginas({
  laminas,
  geometria,
  fotos,
  ativa,
  primeiraEhCapa,
  somenteLeitura,
  onIr,
  onDuplicar,
  onLimpar,
  onExcluir,
  onInserir,
  onLayoutVazio,
}: {
  laminas: LaminaDoc[]
  geometria: Geometria
  fotos: Map<string, FotoNoCanvas>
  ativa: number
  primeiraEhCapa: boolean
  somenteLeitura: boolean
  onIr: (i: number) => void
  onDuplicar: (i: number) => void
  onLimpar: (i: number) => void
  onExcluir: (i: number) => void
  /** Nova lâmina depois da ativa: vazia, com N quadros, ou cópia da anterior. */
  onInserir: (tipo: 'vazia' | 'layout' | 'duplicar', quadros?: number) => void
  onLayoutVazio: (i: number, quadros: number) => void
}) {
  const [qtd, setQtd] = useState(3)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {!somenteLeitura ? (
        <section className="mb-3 space-y-1.5 rounded-lg bg-white/5 p-2">
          <p className={TITULO}>Adicionar lâmina (página dupla)</p>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={() => onInserir('vazia')} className="flex items-center justify-center gap-1 rounded-md bg-white/10 px-2 py-1.5 text-[11px] hover:bg-white/20">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Vazia
            </button>
            <button type="button" onClick={() => onInserir('duplicar')} className="flex items-center justify-center gap-1 rounded-md bg-white/10 px-2 py-1.5 text-[11px] hover:bg-white/20">
              <Copy className="h-3.5 w-3.5" aria-hidden /> Duplicar anterior
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onInserir('layout', qtd)} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-white/10 px-2 py-1.5 text-[11px] hover:bg-white/20">
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Com layout de
            </button>
            <select value={qtd} onChange={(e) => setQtd(Number(e.target.value))} className="rounded-md border border-white/20 bg-[#1c1c1c] px-1 py-1 text-[11px]" aria-label="Fotos no layout">
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n} foto{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-white/40">Modelos de lâmina: aba Modelos.</p>
        </section>
      ) : null}
      <p className="mb-2 text-xs text-white/60">{laminas.length} lâmina(s). Para reordenar, arraste aqui na fita de baixo.</p>
      <ul className="space-y-3">
        {laminas.map((l, i) => (
          <li key={l.id} className={cn('rounded-lg p-1.5', i === ativa ? 'bg-white/15 ring-1 ring-white/50' : 'hover:bg-white/5')}>
            <button type="button" onClick={() => onIr(i)} className="block w-full text-left">
              <MiniaturaLamina lamina={l} geometria={geometria} fotos={fotos} largura={236} />
              <span className="mt-1 block text-[11px] text-white/70">{rotuloDaLamina(i, primeiraEhCapa)}</span>
            </button>
            {!somenteLeitura ? (
              <div className="mt-1 flex gap-1">
                <button type="button" onClick={() => onDuplicar(i)} className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-white/70 hover:bg-white/10">
                  <Copy className="h-3 w-3" aria-hidden /> Duplicar
                </button>
                <button type="button" onClick={() => onLimpar(i)} className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-white/70 hover:bg-white/10">
                  <Eraser className="h-3 w-3" aria-hidden /> Limpar
                </button>
                <button type="button" onClick={() => onLayoutVazio(i, qtd)} className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-white/70 hover:bg-white/10" title={`Aplicar layout vazio de ${qtd} foto(s)`}>
                  <LayoutGrid className="h-3 w-3" aria-hidden /> Layout
                </button>
                <button
                  type="button"
                  onClick={() => onExcluir(i)}
                  disabled={laminas.length === 1}
                  className="ml-auto flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-red-300 hover:bg-white/10 disabled:opacity-30"
                >
                  <Trash2 className="h-3 w-3" aria-hidden /> Excluir
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------ Configurações ------------------------------ */

export function PainelConfiguracoes({
  avulso,
  nome,
  clienteNome,
  tipo,
  formato,
  orientacao,
  sangria,
  margem,
  primeiraEhCapa,
  mostrarGuias,
  somenteLeitura,
  onSalvarDados,
  onCapa,
  onGuias,
}: {
  avulso: boolean
  nome: string
  clienteNome: string | null
  tipo: string | null
  formato: string
  orientacao: string
  sangria: number
  margem: number
  primeiraEhCapa: boolean
  mostrarGuias: boolean
  somenteLeitura: boolean
  onSalvarDados: (d: { nome?: string; clienteNome?: string | null; tipo?: string | null; sangriaMm?: number; margemSeguraMm?: number }) => Promise<string | null>
  onCapa: (v: boolean) => void
  onGuias: (v: boolean) => void
}) {
  const [form, setForm] = useState({ nome, cliente: clienteNome ?? '', tipo: tipo ?? '', sangria: String(sangria), margem: String(margem) })
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    const erro = await onSalvarDados({
      ...(avulso ? { nome: form.nome, clienteNome: form.cliente || null } : {}),
      tipo: form.tipo || null,
      sangriaMm: Number(form.sangria.replace(',', '.')),
      margemSeguraMm: Number(form.margem.replace(',', '.')),
    })
    setSalvando(false)
    setMsg(erro ?? 'Configurações salvas.')
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 text-sm">
      <section className="space-y-2">
        <p className={TITULO}>Álbum</p>
        {avulso ? (
          <>
            <label className="block text-xs text-white/80">
              Nome
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className={CAMPO} />
            </label>
            <label className="block text-xs text-white/80">
              Cliente
              <input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} className={CAMPO} />
            </label>
          </>
        ) : null}
        <label className="block text-xs text-white/80">
          Tipo de álbum
          <input value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} className={CAMPO} placeholder="Casamento, 15 anos…" />
        </label>
        <p className="text-xs text-white/50">
          Formato {formato} · {orientacao}
        </p>
      </section>
      <section className="space-y-2">
        <p className={TITULO}>Impressão</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-white/80">
            Sangria (mm)
            <input inputMode="decimal" value={form.sangria} onChange={(e) => setForm((f) => ({ ...f, sangria: e.target.value }))} className={CAMPO} />
          </label>
          <label className="block text-xs text-white/80">
            Área segura (mm)
            <input inputMode="decimal" value={form.margem} onChange={(e) => setForm((f) => ({ ...f, margem: e.target.value }))} className={CAMPO} />
          </label>
        </div>
      </section>
      {!somenteLeitura ? (
        <button type="button" onClick={salvar} disabled={salvando} className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#171717] disabled:opacity-60">
          {salvando ? 'Salvando…' : 'Salvar configurações'}
        </button>
      ) : null}
      {msg ? <p className="text-xs text-white/70">{msg}</p> : null}
      <section className="space-y-2 border-t border-white/10 pt-3">
        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={primeiraEhCapa} disabled={somenteLeitura} onChange={(e) => onCapa(e.target.checked)} className="accent-white" />
          A 1ª lâmina é a capa
        </label>
        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={mostrarGuias} onChange={(e) => onGuias(e.target.checked)} className="accent-white" />
          Mostrar guias (sangria, corte, área segura e dobra)
        </label>
      </section>
    </div>
  )
}
