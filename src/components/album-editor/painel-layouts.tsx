'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, Sparkles, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MiniaturaLamina } from '@/components/album-editor/miniatura-lamina'
import type { FotoNoCanvas } from '@/components/album-editor/tipos'
import { ESTILOS, MAX_FOTOS_POR_LAMINA, tipoDaComposicao, type Agrupamento, type EstiloId, type Reutilizacao, type Variante } from '@/lib/album/modelos'
import { compatibilidade, filtrarTemplates, quadrosDoTemplate, type FiltroTemplates, type TemplateLamina } from '@/lib/album/templates'
import { novaLamina, type FotoEditor, type Geometria } from '@/lib/album/documento'
import { cn } from '@/lib/utils'

export type PedidoPreenchimento = {
  laminas: number
  capa: boolean
  estilo: EstiloId
  /** Só as fotos selecionadas na biblioteca. */
  soSelecionadas: boolean
  /** Completar os quadros vazios do modelo em vez de refazer as lâminas. */
  usarQuadrosDoModelo: boolean
  agrupar: Agrupamento
  reutilizacao: Reutilizacao
  respeitarOrdem: boolean
}

const TITULO = 'text-xs font-semibold uppercase tracking-wide text-white/50'
const SEM_FOTOS = new Map<string, FotoNoCanvas>()

const NIVEL_COMPAT = {
  exata: { rotulo: 'Encaixe exato', cor: 'bg-emerald-500/80' },
  proporcao: { rotulo: 'Mesmas orientações', cor: 'bg-sky-500/70' },
  quantidade: { rotulo: 'Corta mais', cor: 'bg-amber-500/70' },
  incompativel: { rotulo: '', cor: '' },
} as const

/**
 * Layouts: sugestões do Smart Layout (com ordem e "Reorganizar"), a
 * biblioteca de templates (padrão + salvos pela equipe) e a montagem
 * automática do álbum (Auto Build).
 */
export function PainelLayouts({
  geometria,
  fotosMapa,
  variantes,
  origem,
  selecionadas,
  fotosSelecionadas,
  totalFotos,
  sugestaoLaminas,
  estiloInicial,
  temConteudo,
  temQuadrosVazios,
  somenteLeitura,
  respeitarOrdem,
  assinatura,
  reorganizacoes,
  templates,
  podeSalvarTemplate,
  onRespeitarOrdem,
  onReordenar,
  onAplicar,
  onAplicarTemplate,
  onFavoritarTemplate,
  onExcluirTemplate,
  onSalvarTemplate,
  onPreencher,
}: {
  geometria: Geometria
  fotosMapa: Map<string, FotoNoCanvas>
  variantes: Variante[]
  origem: 'selecao' | 'lamina' | null
  selecionadas: number
  fotosSelecionadas: FotoEditor[]
  totalFotos: number
  sugestaoLaminas: number
  estiloInicial: EstiloId
  temConteudo: boolean
  temQuadrosVazios: boolean
  somenteLeitura: boolean
  respeitarOrdem: boolean
  /** Assinatura das fotos escolhidas (P-L-P), na ordem. */
  assinatura: string | null
  reorganizacoes: { ordem: string[]; assinatura: string; exatos: number }[]
  templates: TemplateLamina[]
  podeSalvarTemplate: boolean
  onRespeitarOrdem: (v: boolean) => void
  onReordenar: (ordem: string[]) => void
  onAplicar: (v: Variante) => void
  onAplicarTemplate: (t: TemplateLamina) => void
  onFavoritarTemplate: (t: TemplateLamina) => void
  onExcluirTemplate: (t: TemplateLamina) => void
  onSalvarTemplate: () => void
  onPreencher: (p: PedidoPreenchimento) => void
}) {
  const [aba, setAba] = useState<'sugestoes' | 'biblioteca' | 'montar'>('sugestoes')
  const [filtro, setFiltro] = useState<FiltroTemplates>({ aba: 'todos', nFotos: null, orientacao: null })
  const [laminas, setLaminas] = useState(String(sugestaoLaminas))
  const [capa, setCapa] = useState(false)
  const [estilo, setEstilo] = useState<EstiloId>(estiloInicial)
  const [soSelecionadas, setSoSelecionadas] = useState(false)
  const [usarQuadros, setUsarQuadros] = useState(temQuadrosVazios)
  const [agrupar, setAgrupar] = useState<Agrupamento>('captura')
  const [reutilizacao, setReutilizacao] = useState<Reutilizacao>('media')
  const n = Number(laminas)
  const fotosDoPreenchimento = soSelecionadas ? selecionadas : totalFotos

  // Com fotos escolhidas, a biblioteca abre filtrada pela quantidade delas e ordenada por compatibilidade.
  const nFiltro = filtro.nFotos ?? (fotosSelecionadas.length > 0 ? fotosSelecionadas.length : null)
  const lista = useMemo(() => {
    const base = filtrarTemplates(templates, { ...filtro, nFotos: nFiltro })
    if (fotosSelecionadas.length === 0) return base.map((t) => ({ t, c: null }))
    const ordem = { exata: 0, proporcao: 1, quantidade: 2, incompativel: 3 }
    return base
      .map((t) => ({ t, c: compatibilidade(t, fotosSelecionadas, geometria) }))
      .sort((a, b) => ordem[a.c.nivel] - ordem[b.c.nivel] || a.c.custo - b.c.custo)
  }, [templates, filtro, nFiltro, fotosSelecionadas, geometria])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-3 border-b border-white/10 text-[11px]" role="tablist">
        {(
          [
            ['sugestoes', 'Sugestões'],
            ['biblioteca', 'Biblioteca'],
            ['montar', 'Montar álbum'],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={aba === v}
            onClick={() => setAba(v)}
            className={cn('py-2 font-medium', aba === v ? 'border-b-2 border-white text-white' : 'text-white/60 hover:text-white')}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {aba === 'sugestoes' ? (
          <>
            <p className="text-xs text-white/60">
              {origem === 'selecao'
                ? `${variantes.length} composições para as ${selecionadas} foto(s) selecionadas.`
                : origem === 'lamina'
                  ? 'Rearranjos das fotos que já estão nesta lâmina. Selecione fotos na aba Fotos para outras combinações.'
                  : `Selecione de 1 a ${MAX_FOTOS_POR_LAMINA} fotos na aba Fotos (ou ponha fotos na lâmina).`}
            </p>
            {assinatura ? (
              <div className="space-y-2 rounded-lg bg-white/5 p-2">
                <p className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Assinatura</span>
                  <code className="rounded bg-white/10 px-1.5 py-0.5 font-semibold tracking-wider">{assinatura}</code>
                </p>
                <label className="flex items-start gap-2 text-xs text-white/80">
                  <input type="checkbox" checked={respeitarOrdem} onChange={(e) => onRespeitarOrdem(e.target.checked)} className="mt-0.5 accent-white" />
                  Respeitar a ordem das fotos (1ª foto no 1º quadro — a sequência da história manda)
                </label>
                {origem === 'selecao' && reorganizacoes.length > 1 ? (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1 text-[11px] text-white/60">
                      <ArrowLeftRight className="h-3 w-3" aria-hidden /> Reorganizar a ordem
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {reorganizacoes.map((r) => (
                        <button
                          key={r.assinatura}
                          type="button"
                          onClick={() => onReordenar(r.ordem)}
                          className={cn('rounded px-1.5 py-0.5 text-[11px]', r.assinatura === assinatura ? 'bg-white text-[#171717]' : 'bg-white/10 hover:bg-white/20')}
                          title={`${r.exatos} template(s) com encaixe exato`}
                        >
                          {r.assinatura} <span className="opacity-60">· {r.exatos}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2">
              {variantes.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={somenteLeitura}
                  onClick={() => onAplicar(v)}
                  className="rounded-lg p-1.5 text-left ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/40 disabled:opacity-50"
                  aria-label={`Aplicar a composição ${i + 1} na lâmina atual`}
                >
                  <MiniaturaLamina lamina={{ ...novaLamina(), id: v.id, quadros: v.quadros }} geometria={geometria} fotos={fotosMapa} largura={236} />
                  <span className="mt-1 flex justify-between text-[11px] text-white/60">
                    <span>Composição {String(i + 1).padStart(2, '0')}</span>
                    <span className="rounded bg-white/10 px-1.5">{tipoDaComposicao(v)}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : aba === 'biblioteca' ? (
          <>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['todos', 'Todos'],
                  ['favoritos', 'Favoritos'],
                  ['recentes', 'Recentes'],
                  ['personalizados', 'Personalizados'],
                ] as const
              ).map(([v, r]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFiltro((f) => ({ ...f, aba: v }))}
                  className={cn('rounded-full px-2.5 py-1 text-[11px]', filtro.aba === v ? 'bg-white text-[#171717]' : 'bg-white/10 text-white/80 hover:bg-white/20')}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={nFiltro ?? ''}
                onChange={(e) => setFiltro((f) => ({ ...f, nFotos: e.target.value ? Number(e.target.value) : null }))}
                className="rounded-md border border-white/20 bg-[#1c1c1c] px-1 py-1 text-[11px]"
                aria-label="Quantidade de fotos"
              >
                <option value="">Qualquer quantidade</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((k) => (
                  <option key={k} value={k}>
                    {k} foto{k > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
              <select
                value={filtro.orientacao ?? ''}
                onChange={(e) => setFiltro((f) => ({ ...f, orientacao: (e.target.value || null) as FiltroTemplates['orientacao'] }))}
                className="rounded-md border border-white/20 bg-[#1c1c1c] px-1 py-1 text-[11px]"
                aria-label="Orientação"
              >
                <option value="">Qualquer orientação</option>
                <option value="P">Retrato (P)</option>
                <option value="L">Paisagem (L)</option>
                <option value="S">Quadrada (S)</option>
                <option value="misto">Mista</option>
              </select>
            </div>
            {podeSalvarTemplate && !somenteLeitura ? (
              <Button size="sm" variant="outline" className="w-full border-white/20 bg-transparent text-white hover:bg-white/10" onClick={onSalvarTemplate}>
                <Star className="h-4 w-4" aria-hidden /> Salvar lâmina atual como template
              </Button>
            ) : null}
            {lista.length === 0 ? (
              <p className="p-3 text-center text-xs text-white/50">
                {filtro.aba === 'personalizados' ? 'Nenhum template salvo ainda — monte uma lâmina e use “Salvar como template”.' : 'Nenhum template neste filtro.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {lista.slice(0, 60).map(({ t, c }) => (
                  <li key={t.id} className="rounded-lg p-1.5 ring-1 ring-white/10 hover:ring-white/30">
                    <button type="button" disabled={somenteLeitura} onClick={() => onAplicarTemplate(t)} className="block w-full text-left disabled:opacity-50" aria-label={`Aplicar ${t.nome}`}>
                      <MiniaturaLamina lamina={{ ...novaLamina(), id: t.id, quadros: quadrosDoTemplate(t, geometria) }} geometria={geometria} fotos={SEM_FOTOS} largura={236} />
                    </button>
                    <div className="mt-1 flex items-center gap-1 text-[11px]">
                      <span className="min-w-0 flex-1 truncate text-white/80" title={t.nome}>
                        {t.nome}
                      </span>
                      <code className="rounded bg-white/10 px-1 text-[10px]">{t.assinatura}</code>
                      {c && c.nivel !== 'incompativel' ? <span className={cn('rounded px-1 text-[10px] text-white', NIVEL_COMPAT[c.nivel].cor)}>{NIVEL_COMPAT[c.nivel].rotulo}</span> : null}
                      <button type="button" onClick={() => onFavoritarTemplate(t)} className={cn('rounded p-0.5', t.favorito ? 'text-amber-300' : 'text-white/40 hover:text-white')} aria-label={t.favorito ? 'Tirar dos favoritos' : 'Favoritar'} aria-pressed={Boolean(t.favorito)}>
                        <Star className="h-3.5 w-3.5" fill={t.favorito ? 'currentColor' : 'none'} />
                      </button>
                      {t.origem === 'personalizado' && !somenteLeitura ? (
                        <button type="button" onClick={() => onExcluirTemplate(t)} className="rounded p-0.5 text-white/40 hover:text-red-300" aria-label={`Excluir ${t.nome}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-white/40">
              Clique para aplicar na lâmina atual{fotosSelecionadas.length > 0 ? ' com as fotos selecionadas' : ' (quadros vazios)'}. Templates guardam só a geometria — valem em
              qualquer formato.
            </p>
          </>
        ) : (
          <section className="space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Montar o álbum automaticamente
            </p>
            <p className="text-xs text-white/60">Fotos → grupos → lâminas → templates. O resultado é um RASCUNHO: revise rostos, cortes, sequência e repetições.</p>
            {temQuadrosVazios ? (
              <label className="flex items-start gap-2 text-xs text-white/80">
                <input type="checkbox" checked={usarQuadros} onChange={(e) => setUsarQuadros(e.target.checked)} className="mt-0.5 accent-white" />
                Só completar os quadros vazios do modelo (mantém as lâminas como estão)
              </label>
            ) : null}
            {!usarQuadros || !temQuadrosVazios ? (
              <>
                <fieldset className="space-y-1">
                  <legend className={TITULO}>Estilo</legend>
                  {ESTILOS.map((e) => (
                    <label key={e.id} className={cn('flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-xs', estilo === e.id ? 'bg-white/15' : 'hover:bg-white/5')}>
                      <input type="radio" name="estilo" checked={estilo === e.id} onChange={() => setEstilo(e.id)} className="mt-0.5 accent-white" />
                      <span>
                        <span className="font-medium text-white">{e.nome}</span>
                        <span className="block text-white/50">{e.descricao}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="block text-xs text-white/80">
                  Agrupar por
                  <select value={agrupar} onChange={(e) => setAgrupar(e.target.value as Agrupamento)} className="mt-1 block w-full rounded-md border border-white/20 bg-[#1c1c1c] px-2 py-1.5 text-sm">
                    <option value="captura">Momento (horário da câmera e cenas)</option>
                    <option value="pasta">Pasta da biblioteca</option>
                    <option value="cor">Cor × preto e branco</option>
                    <option value="nenhum">Sem agrupar</option>
                  </select>
                </label>
                <fieldset className="space-y-1">
                  <legend className="text-xs text-white/80">Reutilização de templates</legend>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ['baixa', 'Baixa', 'Variedade'],
                        ['media', 'Média', 'Equilíbrio'],
                        ['alta', 'Alta', 'Consistência'],
                      ] as const
                    ).map(([v, r, d]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setReutilizacao(v)}
                        aria-pressed={reutilizacao === v}
                        className={cn('rounded-md px-1 py-1 text-[11px] leading-tight', reutilizacao === v ? 'bg-white text-[#171717]' : 'bg-white/10 hover:bg-white/20')}
                      >
                        {r}
                        <span className="block opacity-60">{d}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-xs text-white/80">
                  Lâminas
                  <input type="number" min={1} max={200} value={laminas} onChange={(e) => setLaminas(e.target.value)} className="mt-1 block w-full rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white" />
                </label>
                <label className="flex items-center gap-2 text-xs text-white/80">
                  <input type="checkbox" checked={capa} onChange={(e) => setCapa(e.target.checked)} className="accent-white" />
                  Reservar a 1ª lâmina para a capa
                </label>
              </>
            ) : null}
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={soSelecionadas} onChange={(e) => setSoSelecionadas(e.target.checked)} disabled={selecionadas === 0} className="accent-white" />
              Usar só as {selecionadas} foto(s) selecionadas
            </label>
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={respeitarOrdem} onChange={(e) => onRespeitarOrdem(e.target.checked)} className="accent-white" />
              Respeitar a ordem das fotos
            </label>
            <p className="text-xs text-white/50">
              {fotosDoPreenchimento} foto(s){!usarQuadros || !temQuadrosVazios ? ` em ${Number.isFinite(n) ? n : '—'} lâmina(s)` : ' nos quadros vazios'}.
            </p>
            {temConteudo && (!usarQuadros || !temQuadrosVazios) ? <p className="text-xs text-amber-300">Substitui o que já está no álbum — dá para desfazer (Ctrl+Z).</p> : null}
            <Button
              size="sm"
              variant="brand"
              className="w-full"
              disabled={somenteLeitura || fotosDoPreenchimento === 0 || ((!usarQuadros || !temQuadrosVazios) && !(n >= 1 && n <= 200))}
              onClick={() =>
                onPreencher({
                  laminas: Math.floor(n) || 1,
                  capa,
                  estilo,
                  soSelecionadas,
                  usarQuadrosDoModelo: usarQuadros && temQuadrosVazios,
                  agrupar,
                  reutilizacao,
                  respeitarOrdem,
                })
              }
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Montar automaticamente
            </Button>
          </section>
        )}
      </div>
    </div>
  )
}
