'use client'

import { useCallback, useEffect, useRef, useState, startTransition } from 'react'
import { consultarDesignSelecao, criarAlbumDaSelecao } from '@/lib/actions/design-selecao'
import {
  albunsDaRevisao,
  DESCRICAO_DESTINO,
  destinoSugerido,
  ROTULO_DESTINO,
  type DestinoAlbum,
} from '@/lib/design-selecao/contrato'
import { avisoDeOrcamentoDaSelecao } from '@/lib/album/orcamento'
import { acaoDaTecla, focoAoFechar, focoInicial } from '@/lib/design-selecao/acessibilidade'
import type { DesignSelecaoResumo } from '@/types/database'

export type EntregaResumida = { id: string; revisao: number; total: number }

/** Prefixos de id: o gatilho da revisão N e os controles do formulário aberto. */
export const PREFIXO_GATILHO = 'criar-album-gatilho'
export const PREFIXO_FORM = 'criar-album'

/**
 * Parte visual do formulário, sem estado: recebe tudo por props para poder ser
 * testada (rótulos, papéis, ordem de foco) sem navegador.
 */
export function FormularioCriarAlbum(props: {
  revisao: number
  total: number
  destino: DestinoAlbum
  temAlbumProjeto: boolean
  nome: string
  precisaFormato: boolean
  formato: string
  orientacao: string
  ocupado: boolean
  erro: string | null
  onDestino: (d: DestinoAlbum) => void
  onNome: (v: string) => void
  onFormato: (v: string) => void
  onOrientacao: (v: string) => void
  onEnviar: () => void
  onCancelar: () => void
}) {
  const p = PREFIXO_FORM
  const titulo = `${p}-titulo`
  return (
    <form
      id={`${p}-form-${props.revisao}`}
      aria-labelledby={titulo}
      className="space-y-3 rounded-xl bg-secondary p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!props.ocupado) props.onEnviar()
      }}
      onKeyDown={(e) => {
        if (acaoDaTecla(e.key, { ocupado: props.ocupado }) === 'cancelar') {
          e.stopPropagation()
          props.onCancelar()
        }
      }}
    >
      <h3 id={titulo} className="font-medium">
        Criar álbum da revisão {props.revisao} ({props.total} fotos)
      </h3>
      <p className="text-sm text-muted-foreground">
        O álbum guarda esta revisão exata. Mudanças posteriores na seleção não alteram um álbum já criado nem uma prova publicada.
      </p>
      {avisoDeOrcamentoDaSelecao(props.total) ? (
        <p role="note" className="text-sm text-amber-800">
          {avisoDeOrcamentoDaSelecao(props.total)}
        </p>
      ) : null}
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Tipo de álbum</legend>
        {(['projeto', 'avulso'] as const).map((d) => {
          const bloqueado = d === 'projeto' && props.temAlbumProjeto
          return (
            <div key={d} className="flex min-h-11 items-start gap-2">
              <input
                type="radio"
                id={`${p}-destino-${d}`}
                name={`${p}-destino-${props.revisao}`}
                value={d}
                checked={props.destino === d}
                disabled={bloqueado || props.ocupado}
                aria-describedby={`${p}-destino-${d}-ajuda`}
                onChange={() => props.onDestino(d)}
                className="mt-1 h-5 w-5"
              />
              <label htmlFor={`${p}-destino-${d}`} className="text-sm">
                <span className="font-medium">{ROTULO_DESTINO[d]}</span>
                <span id={`${p}-destino-${d}-ajuda`} className="block text-muted-foreground">
                  {bloqueado ? 'Indisponível: este projeto já tem um álbum.' : DESCRICAO_DESTINO[d]}
                </span>
              </label>
            </div>
          )
        })}
      </fieldset>
      {props.destino === 'avulso' ? (
        <div className="space-y-1">
          <label htmlFor={`${p}-nome`} className="block text-sm font-medium">
            Nome do álbum
          </label>
          <input
            id={`${p}-nome`}
            type="text"
            maxLength={120}
            value={props.nome}
            disabled={props.ocupado}
            onChange={(e) => props.onNome(e.target.value)}
            placeholder={`Seleção ${props.revisao}`}
            className="min-h-11 w-full rounded-lg border px-3"
          />
        </div>
      ) : null}
      {props.precisaFormato ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <label htmlFor={`${p}-formato`} className="block text-sm font-medium">
              Formato do álbum (cm)
            </label>
            <input
              id={`${p}-formato`}
              type="text"
              inputMode="decimal"
              value={props.formato}
              disabled={props.ocupado}
              aria-describedby={`${p}-formato-ajuda`}
              onChange={(e) => props.onFormato(e.target.value.toLowerCase().replace('×', 'x').replace(/\s|cm/g, ''))}
              className="min-h-11 w-40 rounded-lg border px-3"
            />
            <p id={`${p}-formato-ajuda`} className="text-xs text-muted-foreground">
              Largura x altura, por exemplo 30x30.
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${p}-orientacao`} className="block text-sm font-medium">
              Orientação
            </label>
            <select
              id={`${p}-orientacao`}
              value={props.orientacao}
              disabled={props.ocupado}
              onChange={(e) => props.onOrientacao(e.target.value)}
              className="min-h-11 rounded-lg border px-3"
            >
              <option value="quadrado">Quadrado</option>
              <option value="vertical">Retrato</option>
              <option value="horizontal">Paisagem</option>
            </select>
          </div>
        </div>
      ) : null}
      {props.erro ? (
        <p role="alert" className="text-sm text-destructive">
          {props.erro}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button id={`${p}-criar`} type="submit" disabled={props.ocupado} className="min-h-11 rounded-lg border px-3">
          {props.ocupado ? 'Criando…' : 'Criar álbum'}
        </button>
        <button id={`${p}-cancelar`} type="button" disabled={props.ocupado} className="min-h-11 underline" onClick={props.onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/**
 * Bloco "Criar álbum" da tela de seleção/compartilhar (D02). Só aparece para
 * quem pode criar (decisão do banco); o cliente final nunca o vê. Reaproveita o
 * editor: depois de criado, o link abre o editor normal.
 */
export function CriarAlbumDaSelecao({ projetoId, entregas }: { projetoId: string; entregas: EntregaResumida[] }) {
  const [resumo, setResumo] = useState<DesignSelecaoResumo | null>(null)
  const [aberta, setAberta] = useState<number | null>(null)
  const [destino, setDestino] = useState<DestinoAlbum>('projeto')
  const [nome, setNome] = useState('')
  const [precisaFormato, setPrecisaFormato] = useState(false)
  const [formato, setFormato] = useState('30x30')
  const [orientacao, setOrientacao] = useState('quadrado')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aberto, setAberto] = useState<{ endereco: string | null } | null>(null)
  const chave = useRef<string | null>(null)

  const carregar = useCallback(async () => {
    const r = await consultarDesignSelecao(projetoId)
    setResumo(r.ok ? r.resumo : null)
  }, [projetoId])
  useEffect(() => {
    startTransition(async () => {
      await carregar()
    })
  }, [carregar, entregas.length])

  // Foco: ao abrir vai para o destino marcado; ao fechar volta para o gatilho.
  useEffect(() => {
    if (aberta !== null) document.getElementById(focoInicial(PREFIXO_FORM, destino))?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, [aberta])

  if (!resumo?.pode_criar || entregas.length === 0) return null

  const abrir = (revisao: number) => {
    chave.current = crypto.randomUUID()
    setDestino(destinoSugerido(resumo))
    setNome('')
    setErro(null)
    setAviso(null)
    setAberto(null)
    setPrecisaFormato(false)
    setAberta(revisao)
  }
  const fechar = () => {
    const revisao = aberta
    setAberta(null)
    setErro(null)
    if (revisao !== null) queueMicrotask(() => document.getElementById(focoAoFechar(PREFIXO_GATILHO, revisao))?.focus())
  }

  async function enviar() {
    const entrega = entregas.find((e) => e.revisao === aberta)
    if (!entrega || ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      chave.current ??= crypto.randomUUID()
      const r = await criarAlbumDaSelecao({
        selecaoId: entrega.id,
        destino,
        chave: chave.current,
        ...(destino === 'avulso' && nome.trim() ? { nome: nome.trim() } : {}),
        ...(precisaFormato ? { formato, orientacao } : {}),
      })
      if (!r.ok) {
        setErro(r.erro)
        if ('precisaFormato' in r && r.precisaFormato) {
          setPrecisaFormato(true)
          if (r.sugestao) setFormato(r.sugestao)
        }
        if ('jaTemAlbum' in r && r.jaTemAlbum) {
          chave.current = crypto.randomUUID()
          setDestino('avulso')
          await carregar()
        }
        return
      }
      setAviso(r.criacao.criado ? `Álbum criado com a revisão ${r.criacao.revisao} (${r.criacao.total} fotos).` : 'Este álbum já existia: nada foi duplicado.')
      setAberto({ endereco: resumo?.pode_abrir_editor ? r.endereco : null })
      const revisao = aberta
      setAberta(null)
      await carregar()
      if (revisao !== null) queueMicrotask(() => document.getElementById(focoAoFechar(PREFIXO_GATILHO, revisao))?.focus())
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section aria-labelledby="criar-album-secao" className="space-y-2 border-t pt-3">
      <h3 id="criar-album-secao" className="font-medium">
        Álbum a partir da seleção
      </h3>
      {entregas.map((e) => {
        const existentes = albunsDaRevisao(resumo, e.revisao)
        const formAberto = aberta === e.revisao
        return (
          <div key={e.id} className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Revisão {e.revisao} · {e.total} fotos
                {existentes.length ? ` · ${existentes.length} ${existentes.length === 1 ? 'álbum criado' : 'álbuns criados'}` : ''}
              </span>
              <button
                id={`${PREFIXO_GATILHO}-${e.revisao}`}
                type="button"
                aria-expanded={formAberto}
                aria-controls={`${PREFIXO_FORM}-form-${e.revisao}`}
                aria-label={`Criar álbum da revisão ${e.revisao}, com ${e.total} fotos`}
                disabled={ocupado}
                className="min-h-11 rounded-lg border px-3"
                onClick={() => (formAberto ? fechar() : abrir(e.revisao))}
              >
                Criar álbum
              </button>
            </div>
            {formAberto ? (
              <FormularioCriarAlbum
                revisao={e.revisao}
                total={e.total}
                destino={destino}
                temAlbumProjeto={resumo.tem_album_projeto}
                nome={nome}
                precisaFormato={precisaFormato}
                formato={formato}
                orientacao={orientacao}
                ocupado={ocupado}
                erro={erro}
                onDestino={setDestino}
                onNome={setNome}
                onFormato={setFormato}
                onOrientacao={setOrientacao}
                onEnviar={() => startTransition(async () => { await enviar() })}
                onCancelar={fechar}
              />
            ) : null}
          </div>
        )
      })}
      <div aria-live="polite" role="status" className="text-sm">
        {aviso}
        {aberto?.endereco ? (
          <>
            {' '}
            <a href={aberto.endereco} className="inline-flex min-h-11 items-center underline">
              Abrir no editor
            </a>
          </>
        ) : null}
      </div>
    </section>
  )
}
